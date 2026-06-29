from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class ApplicationCreate(BaseModel):
    cola_id: str
    brand_name: Optional[str] = None
    class_type: Optional[str] = None
    alcohol_content: Optional[float] = None
    net_contents: Optional[str] = None
    bottler_producer: Optional[str] = None
    address: Optional[str] = None
    country_of_origin: Optional[str] = None
    govt_warning_required: bool = True


class ApplicationOut(ApplicationCreate):
    id: int
    pdf_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FieldResult(BaseModel):
    field: str
    expected: Optional[Any] = None
    extracted: Optional[Any] = None
    status: str          # pass, review, fail, missing
    confidence: float
    detail: Optional[str] = None


class VerificationOut(BaseModel):
    id: int
    cola_id: str
    overall_status: str
    results: list[FieldResult]
    processing_time_ms: int
    created_at: datetime
    application: Optional[ApplicationOut] = None
    decision: Optional['DecisionOut'] = None

    class Config:
        from_attributes = True


class DecisionCreate(BaseModel):
    decision: str        # approve, reject, hold
    notes: Optional[str] = None


class DecisionOut(DecisionCreate):
    id: int
    verification_id: int
    agent_email: str
    decided_at: datetime

    class Config:
        from_attributes = True


class UserInfo(BaseModel):
    email: str
    name: Optional[str] = None
