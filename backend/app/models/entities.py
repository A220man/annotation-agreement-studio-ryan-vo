import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String(50), nullable=False, default="classification")  # classification or span
    guidelines = Column(Text, nullable=True)
    labels_schema = Column(Text, nullable=False, default="[]")  # JSON list of allowed labels/classes
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    documents = relationship("Document", back_populates="task", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, index=True)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    task = relationship("Task", back_populates="documents")
    annotations = relationship("Annotation", back_populates="document", cascade="all, delete-orphan")
    consensus = relationship("Consensus", back_populates="document", uselist=False, cascade="all, delete-orphan")

class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(String(36), primary_key=True, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    annotator_id = Column(String(100), nullable=False, index=True)
    annotator_name = Column(String(255), nullable=False)
    task_type = Column(String(50), nullable=False)
    class_label = Column(String(100), nullable=True)
    spans_json = Column(Text, nullable=True, default="[]")  # JSON list of {start, end, label, text}
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    document = relationship("Document", back_populates="annotations")

    __table_args__ = (
        Index("idx_doc_annotator", "document_id", "annotator_id"),
    )

class Consensus(Base):
    __tablename__ = "consensus_records"

    id = Column(String(36), primary_key=True, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    reconciled_by = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="draft")  # draft, approved
    task_type = Column(String(50), nullable=False)
    class_label = Column(String(100), nullable=True)
    spans_json = Column(Text, nullable=True, default="[]")
    reconciliation_method = Column(String(50), nullable=False, default="manual")  # manual, majority_vote, union, intersection
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    document = relationship("Document", back_populates="consensus")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    user_email = Column(String(255), nullable=True)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(100), nullable=False)
    details_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
