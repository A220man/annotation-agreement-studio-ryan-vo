import json
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import require_role, AuthenticatedUser
from app.models.entities import Document, Annotation
from app.services.llm_advisor import (
    AdvisoryRequest,
    AdvisoryResponse,
    request_advisory_explanation,
)
from app.api.deps import record_audit

router = APIRouter(prefix="/advisory", tags=["LLM Advisory"])

class DisputeDiagnoseRequest(BaseModel):
    document_id: Optional[str] = None
    custom_text: Optional[str] = None
    task_type: str = "span"
    conflicting_annotations: Optional[List[Dict[str, Any]]] = None
    guidelines: Optional[str] = None

@router.get("/status")
def get_advisory_status(user: AuthenticatedUser = Depends(require_role("viewer"))):
    """Returns operator LLM provider configuration without leaking credentials."""
    return {
        "enabled": bool(settings.LLM_API_KEY) or settings.LLM_PROVIDER == "ollama",
        "provider": settings.LLM_PROVIDER,
        "model": settings.LLM_MODEL,
        "timeout_seconds": settings.LLM_TIMEOUT_SECONDS,
        "disclaimer": "LLM advisory services are strictly opt-in and non-authoritative.",
    }

@router.post("/diagnose", response_model=AdvisoryResponse)
async def diagnose_annotation_dispute(
    payload: DisputeDiagnoseRequest,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("analyst")),
):
    """
    Generates advisory linguistic explanation for human annotator disagreements.
    Grounded in actual annotator labels and guideline definitions.
    """
    doc_text = payload.custom_text
    conflicts = payload.conflicting_annotations or []
    guidelines = payload.guidelines
    task_type = payload.task_type

    if payload.document_id:
        doc = db.query(Document).filter(Document.id == payload.document_id).first()
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        doc_text = doc.text
        task_type = doc.task.task_type
        guidelines = doc.task.guidelines

        if not conflicts:
            anns = db.query(Annotation).filter(Annotation.document_id == doc.id).all()
            conflicts = [
                {
                    "annotator_id": a.annotator_id,
                    "annotator_name": a.annotator_name,
                    "class_label": a.class_label,
                    "spans": json.loads(a.spans_json or "[]"),
                }
                for a in anns
            ]

    if not doc_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either document_id or custom_text must be provided",
        )

    req = AdvisoryRequest(
        document_text=doc_text,
        task_type=task_type,
        conflicting_annotations=conflicts,
        guidelines=guidelines,
    )

    response = await request_advisory_explanation(req)

    record_audit(
        db=db,
        event_type="LLM_ADVISORY_REQUESTED",
        user=user,
        entity_type="Advisory",
        entity_id=payload.document_id or "custom",
        details={"status": response.status, "provider": response.provider},
    )

    return response
