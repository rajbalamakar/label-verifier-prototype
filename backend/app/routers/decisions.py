from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Verification, AgentDecision, AuditEvent
from app.schemas import DecisionCreate, DecisionOut, UserInfo
from app.auth import get_current_user

router = APIRouter(prefix="/decisions", tags=["decisions"])

VALID_DECISIONS = {"approve", "reject", "hold"}


@router.post("/{verification_id}", response_model=DecisionOut)
async def submit_decision(
    verification_id: int,
    payload: DecisionCreate,
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    if payload.decision not in VALID_DECISIONS:
        raise HTTPException(status_code=400, detail=f"Decision must be one of: {VALID_DECISIONS}")

    result = await db.execute(select(Verification).where(Verification.id == verification_id))
    verification = result.scalar_one_or_none()
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")

    decision = AgentDecision(
        verification_id=verification_id,
        agent_email=user.email,
        decision=payload.decision,
        notes=payload.notes,
    )
    db.add(decision)
    db.add(AuditEvent(
        agent_email=user.email,
        action=payload.decision,
        target_cola_id=verification.cola_id,
        metadata_={"verification_id": verification_id, "notes": payload.notes},
    ))
    await db.commit()
    await db.refresh(decision)
    return decision


@router.get("/{verification_id}", response_model=DecisionOut)
async def get_decision(
    verification_id: int,
    db: AsyncSession = Depends(get_db),
    user: UserInfo = Depends(get_current_user),
):
    result = await db.execute(
        select(AgentDecision).where(AgentDecision.verification_id == verification_id)
    )
    decision = result.scalar_one_or_none()
    if not decision:
        raise HTTPException(status_code=404, detail="No decision recorded yet")
    return decision
