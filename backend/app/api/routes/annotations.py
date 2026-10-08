import json
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import require_role, AuthenticatedUser
from backend.app.models.entities import Annotation, Document, Task, utc_now
from backend.app.api.deps import record_audit

router = APIRouter(prefix="/annotations", tags=["Annotations"])

class SpanInput(BaseModel):
    start: int = Field(..., ge=0)
    end: int = Field(..., gt=0)
    label: str = Field(..., min_length=1)
    text: Optional[str] = None

class AnnotationCreate(BaseModel):
    document_id: str
    annotator_id: str
    annotator_name: str
    task_type: str = Field(..., pattern="^(classification|span)$")
    class_label: Optional[str] = None
    spans: Optional[List[SpanInput]] = None
    notes: Optional[str] = None

class BatchAnnotationItem(BaseModel):
    document_id: str
    annotator_id: str
    annotator_name: str
    task_type: str
    class_label: Optional[str] = None
    spans: Optional[List[SpanInput]] = None
    notes: Optional[str] = None

class BatchAnnotationCreate(BaseModel):
    task_id: str
    annotations: List[BatchAnnotationItem]

class AnnotationResponse(BaseModel):
    id: str
    document_id: str
    task_id: str
    annotator_id: str
    annotator_name: str
    task_type: str
    class_label: Optional[str] = None
    spans: List[Dict[str, Any]]
    notes: Optional[str] = None
    created_at: str
    updated_at: str

@router.post("", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED)
def submit_annotation(
    payload: AnnotationCreate,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("analyst")),
):
    doc = db.query(Document).filter(Document.id == payload.document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    spans_data = [s.model_dump() for s in (payload.spans or [])]
    for s in spans_data:
        if s["start"] >= s["end"] or s["end"] > len(doc.text):
            raise HTTPException(status_code=400, detail="Invalid span offset")
        if not s.get("text"): s["text"] = doc.text[s["start"]:s["end"]]

    existing = db.query(Annotation).filter(Annotation.document_id == payload.document_id, Annotation.annotator_id == payload.annotator_id).first()
    if existing:
        existing.class_label = payload.class_label
        existing.spans_json = json.dumps(spans_data)
        existing.notes = payload.notes
        existing.updated_at = utc_now()
        ann_obj = existing
    else:
        ann_obj = Annotation(
            id=str(uuid.uuid4()), document_id=doc.id, task_id=doc.task_id, annotator_id=payload.annotator_id,
            annotator_name=payload.annotator_name, task_type=payload.task_type, class_label=payload.class_label,
            spans_json=json.dumps(spans_data), notes=payload.notes, created_at=utc_now(), updated_at=utc_now(),
        )
        db.add(ann_obj)

    db.commit()
    db.refresh(ann_obj)
    record_audit(db, "ANNOTATION_SUBMITTED", user, "Annotation", ann_obj.id, {"document_id": doc.id})
    return AnnotationResponse(
        id=ann_obj.id, document_id=ann_obj.document_id, task_id=ann_obj.task_id, annotator_id=ann_obj.annotator_id,
        annotator_name=ann_obj.annotator_name, task_type=ann_obj.task_type, class_label=ann_obj.class_label,
        spans=json.loads(ann_obj.spans_json or "[]"), notes=ann_obj.notes, created_at=ann_obj.created_at.isoformat(), updated_at=ann_obj.updated_at.isoformat(),
    )

@router.get("", response_model=List[AnnotationResponse])
def list_annotations(
    task_id: Optional[str] = None,
    document_id: Optional[str] = None,
    annotator_id: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    q = db.query(Annotation)
    if task_id: q = q.filter(Annotation.task_id == task_id)
    if document_id: q = q.filter(Annotation.document_id == document_id)
    if annotator_id: q = q.filter(Annotation.annotator_id == annotator_id)
    anns = q.order_by(Annotation.created_at.desc()).offset(offset).limit(limit).all()
    return [
        AnnotationResponse(
            id=a.id, document_id=a.document_id, task_id=a.task_id, annotator_id=a.annotator_id,
            annotator_name=a.annotator_name, task_type=a.task_type, class_label=a.class_label,
            spans=json.loads(a.spans_json or "[]"), notes=a.notes, created_at=a.created_at.isoformat(), updated_at=a.updated_at.isoformat(),
        )
        for a in anns
    ]

@router.post("/batch", status_code=status.HTTP_201_CREATED)
def batch_import_annotations(
    payload: BatchAnnotationCreate,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("analyst")),
):
    ids = []
    for item in payload.annotations:
        spans_data = [s.model_dump() for s in (item.spans or [])]
        ann = Annotation(
            id=str(uuid.uuid4()), document_id=item.document_id, task_id=payload.task_id, annotator_id=item.annotator_id,
            annotator_name=item.annotator_name, task_type=item.task_type, class_label=item.class_label,
            spans_json=json.dumps(spans_data), notes=item.notes, created_at=utc_now(), updated_at=utc_now(),
        )
        db.add(ann)
        ids.append(ann.id)
    db.commit()
    record_audit(db, "BATCH_ANNOTATIONS_IMPORTED", user, "Task", payload.task_id, {"count": len(ids)})
    return {"status": "imported", "count": len(ids)}

@router.delete("/{annotation_id}")
def delete_annotation(
    annotation_id: str,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("admin")),
):
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann: raise HTTPException(status_code=404, detail="Not found")
    db.delete(ann)
    db.commit()
    record_audit(db, "ANNOTATION_DELETED", user, "Annotation", annotation_id)
    return {"status": "deleted"}
