from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True)
    cola_id = Column(String, unique=True, nullable=False, index=True)
    pdf_path = Column(String)

    # Expected values from COLA PDF
    brand_name = Column(String)
    class_type = Column(String)
    alcohol_content = Column(Float)
    net_contents = Column(String)
    bottler_producer = Column(String)
    address = Column(String)
    country_of_origin = Column(String)
    govt_warning_required = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    verifications = relationship("Verification", back_populates="application")


class Verification(Base):
    __tablename__ = "verifications"

    id = Column(Integer, primary_key=True)
    cola_id = Column(String, ForeignKey("applications.cola_id"), nullable=False)
    label_image_path = Column(String)
    overall_status = Column(String)  # pass, warn, fail
    results = Column(JSON)           # per-field results
    processing_time_ms = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("Application", back_populates="verifications")
    decision = relationship("AgentDecision", back_populates="verification", uselist=False)


class AgentDecision(Base):
    __tablename__ = "agent_decisions"

    id = Column(Integer, primary_key=True)
    verification_id = Column(Integer, ForeignKey("verifications.id"), nullable=False)
    agent_email = Column(String, nullable=False)
    decision = Column(String, nullable=False)  # approve, reject, hold
    notes = Column(Text)
    decided_at = Column(DateTime(timezone=True), server_default=func.now())

    verification = relationship("Verification", back_populates="decision")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True)
    agent_email = Column(String, nullable=False)
    action = Column(String, nullable=False)
    target_cola_id = Column(String)
    metadata_ = Column("metadata", JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
