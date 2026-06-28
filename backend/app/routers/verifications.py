import uuid
import time
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from fastapi.responses import StreamingResponse
import io
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Application, Verification, AuditEvent, AgentDecision
from app.schemas import VerificationOut, UserInfo
from app.auth import get_current_user
from app.services import storage
from app.services.ocr import extract_label_fields
from app.services.field_matcher import run_verification
from app.services.pdf_parser import parse_cola_pdf

router = APIRouter(prefix="/verifications", tags=["verifications"])


@router.post("/", response_model=VerificationOut)
async def verify_label(
    pdf_file: UploadFile = File(...),
    image_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    if not pdf_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="pdf_file must be a PDF")

    pdf_bytes = await pdf_file.read()
    image_bytes = await image_file.read()

    # Parse PDF — extract COLA ID and application fields
    loop = asyncio.get_running_loop()
    cola_id, parsed = await loop.run_in_executor(None, parse_cola_pdf, pdf_bytes)

    if not cola_id:
        cola_id = f"UPLOAD-{uuid.uuid4().hex[:8].upper()}"

    # Save files
    pdf_path = await storage.save_file(pdf_bytes, f"{cola_id}_{uuid.uuid4().hex[:8]}.pdf", subfolder="pdfs")
    image_path = await storage.save_file(image_bytes, f"{cola_id}_{uuid.uuid4().hex[:8]}_{image_file.filename}", subfolder="labels")

    # Upsert application
    result = await db.execute(select(Application).where(Application.cola_id == cola_id))
    app = result.scalar_one_or_none()
    if app:
        # Delete old PDF from disk before replacing it
        if app.pdf_path and not app.pdf_path.startswith("gs://"):
            from pathlib import Path
            try:
                Path(app.pdf_path).unlink(missing_ok=True)
            except Exception:
                pass
        for k, v in parsed.items():
            if v is not None:
                setattr(app, k, v)
        app.pdf_path = pdf_path
    else:
        app = Application(cola_id=cola_id, pdf_path=pdf_path, **parsed)
        db.add(app)

    application_dict = {
        "brand_name": app.brand_name or parsed.get("brand_name"),
        "class_type": app.class_type or parsed.get("class_type"),
        "alcohol_content": app.alcohol_content or parsed.get("alcohol_content"),
        "net_contents": app.net_contents or parsed.get("net_contents"),
        "bottler_producer": app.bottler_producer or parsed.get("bottler_producer"),
        "country_of_origin": app.country_of_origin or parsed.get("country_of_origin"),
    }

    start = time.monotonic()
    label_fields = await loop.run_in_executor(None, extract_label_fields, image_bytes)
    field_results, overall_status = await loop.run_in_executor(
        None, run_verification, application_dict, label_fields
    )
    elapsed_ms = int((time.monotonic() - start) * 1000)

    verification = Verification(
        cola_id=cola_id,
        label_image_path=image_path,
        overall_status=overall_status,
        results=[r.model_dump() for r in field_results],
        processing_time_ms=elapsed_ms,
    )
    db.add(verification)
    db.add(AuditEvent(
        agent_email=user.email, action="verify_label", target_cola_id=cola_id,
        metadata_={"overall_status": overall_status, "processing_time_ms": elapsed_ms},
    ))
    await db.commit()

    # Re-fetch with relationships eagerly loaded
    refreshed = await db.execute(
        select(Verification)
        .options(selectinload(Verification.application), selectinload(Verification.decision))
        .where(Verification.id == verification.id)
    )
    return refreshed.scalar_one()


@router.get("/", response_model=list[VerificationOut])
async def list_verifications(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    result = await db.execute(
        select(Verification)
        .options(selectinload(Verification.application), selectinload(Verification.decision))
        .order_by(Verification.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.delete("/{verification_id}", status_code=204)
async def delete_verification(
    verification_id: int,
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    result = await db.execute(select(Verification).where(Verification.id == verification_id))
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")

    image_path = v.label_image_path
    await db.execute(delete(AgentDecision).where(AgentDecision.verification_id == verification_id))
    await db.delete(v)
    await db.commit()

    if image_path and not image_path.startswith("gs://"):
        from pathlib import Path
        try:
            Path(image_path).unlink(missing_ok=True)
        except Exception:
            pass

    return Response(status_code=204)


@router.get("/{verification_id}/label")
async def get_label_image(
    verification_id: int,
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    result = await db.execute(select(Verification).where(Verification.id == verification_id))
    v = result.scalar_one_or_none()
    if not v or not v.label_image_path:
        raise HTTPException(status_code=404, detail="Label image not found")
    image_bytes = await storage.read_file(v.label_image_path)
    media_type = "image/jpeg" if v.label_image_path.lower().endswith((".jpg", ".jpeg")) else "image/png"
    return StreamingResponse(io.BytesIO(image_bytes), media_type=media_type)


@router.get("/{verification_id}", response_model=VerificationOut)
async def get_verification(
    verification_id: int,
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    result = await db.execute(
        select(Verification).where(Verification.id == verification_id)
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")
    return v


@router.get("/by-cola/{cola_id}", response_model=list[VerificationOut])
async def list_verifications_for_cola(
    cola_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    result = await db.execute(
        select(Verification)
        .where(Verification.cola_id == cola_id)
        .order_by(Verification.created_at.desc())
    )
    return result.scalars().all()
