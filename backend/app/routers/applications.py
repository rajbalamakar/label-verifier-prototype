import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Application, AuditEvent
from app.schemas import ApplicationOut, UserInfo
from app.auth import get_current_user
from app.services import storage
from app.services.pdf_parser import parse_cola_pdf

router = APIRouter(prefix="/applications", tags=["applications"])


@router.post("/upload-pdf", response_model=ApplicationOut)
async def upload_cola_pdf(
    cola_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    filename = f"{cola_id}_{uuid.uuid4().hex[:8]}.pdf"
    pdf_path = await storage.save_file(pdf_bytes, filename, subfolder="pdfs")

    _, parsed = parse_cola_pdf(pdf_bytes)

    # Upsert: update if cola_id already exists
    result = await db.execute(select(Application).where(Application.cola_id == cola_id))
    app = result.scalar_one_or_none()

    if app:
        for k, v in parsed.items():
            if v is not None:
                setattr(app, k, v)
        app.pdf_path = pdf_path
    else:
        app = Application(cola_id=cola_id, pdf_path=pdf_path, **parsed)
        db.add(app)

    db.add(AuditEvent(agent_email=user.email, action="upload_pdf", target_cola_id=cola_id))
    await db.commit()
    await db.refresh(app)
    return app


@router.post("/manual", response_model=ApplicationOut)
async def create_application_manual(
    cola_id: str = Form(...),
    brand_name: str = Form(None),
    class_type: str = Form(None),
    alcohol_content: float = Form(None),
    net_contents: str = Form(None),
    bottler_producer: str = Form(None),
    address: str = Form(None),
    country_of_origin: str = Form(None),
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    result = await db.execute(select(Application).where(Application.cola_id == cola_id))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Application {cola_id} already exists")

    app = Application(
        cola_id=cola_id, brand_name=brand_name, class_type=class_type,
        alcohol_content=alcohol_content, net_contents=net_contents,
        bottler_producer=bottler_producer, address=address,
        country_of_origin=country_of_origin,
    )
    db.add(app)
    db.add(AuditEvent(agent_email=user.email, action="create_application", target_cola_id=cola_id))
    await db.commit()
    await db.refresh(app)
    return app


@router.get("/{cola_id}", response_model=ApplicationOut)
async def get_application(
    cola_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    result = await db.execute(select(Application).where(Application.cola_id == cola_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail=f"Application {cola_id} not found")
    return app


@router.get("/", response_model=list[ApplicationOut])
async def list_applications(
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    result = await db.execute(select(Application).order_by(Application.created_at.desc()).limit(100))
    return result.scalars().all()
