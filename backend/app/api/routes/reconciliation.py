import json
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import require_role, AuthenticatedUser
from backend.app.models.entities import Task, Document, Annotation, Consensus, utc_now
from backend.app.services.reconciliation_engine import (
    reconcile_classification, reconcile_spans, export_to_jsonl, export_to_conll, export_to_huggingface,
)
from backend.app.api.deps import record_audit

router = APIRouter(prefix="/reconciliation", tags=["Reconciliation"])

class AutoReconcileRequest(BaseModel):
    strategy: str = Field("majority_vote", pattern="^(majority_vote|union|intersection|expert_priority)$")
    priority_annotator_id: Optional[str] = None
    min_overlap_ratio: float = Field(0.5, ge=0.1, le=1.0)
    auto_approve: bool = False

class ManualConsensusRequest(BaseModel):
    status: str = Field("approved", pattern="^(draft|approved)$")
    class_label: Optional[str] = None
    spans: Optional[List[Dict[str, Any]]] = None
    reconciliation_method: str = "manual"
    notes: Optional[str] = None

class ConsensusResponse(BaseModel):
    id: str
    document_id: str
    task_id: str
    reconciled_by: str
    status: str
    task_type: str
    class_label: Optional[str] = None
    spans: List[Dict[str, Any]]
    reconciliation_method: str
    notes: Optional[str] = None
    created_at: str
    updated_at: str

@router.post("/auto/{task_id}")
def auto_reconcile_task(
    task_id: str,
    payload: AutoReconcileRequest,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("analyst")),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    docs = db.query(Document).filter(Document.task_id == task_id).all()
    count = 0
    rec_status = "approved" if payload.auto_approve else "draft"

    for doc in docs:
        anns = db.query(Annotation).filter(Annotation.document_id == doc.id).all()
        if not anns: continue
        ann_dicts = [{"annotator_id": a.annotator_id, "class_label": a.class_label, "spans": json.loads(a.spans_json or "[]")} for a in anns]

        if task.task_type == "classification":
            res = reconcile_classification(ann_dicts, strategy=payload.strategy, priority_annotator_id=payload.priority_annotator_id)
            final_class, final_spans = res.class_label, []
        else:
            res = reconcile_spans(ann_dicts, doc.text, strategy=payload.strategy, priority_annotator_id=payload.priority_annotator_id, min_overlap_ratio=payload.min_overlap_ratio)
            final_class, final_spans = None, res.spans

        existing = db.query(Consensus).filter(Consensus.document_id == doc.id).first()
        if existing:
            existing.reconciled_by = user.user_id
            existing.status = rec_status
            existing.class_label = final_class
            existing.spans_json = json.dumps(final_spans)
            existing.reconciliation_method = res.strategy_used
            existing.notes = res.notes
            existing.updated_at = utc_now()
        else:
            db.add(Consensus(
                id=str(uuid.uuid4()), document_id=doc.id, task_id=task_id, reconciled_by=user.user_id,
                status=rec_status, task_type=task.task_type, class_label=final_class,
                spans_json=json.dumps(final_spans), reconciliation_method=res.strategy_used,
                notes=res.notes, created_at=utc_now(), updated_at=utc_now(),
            ))
        count += 1

    db.commit()
    record_audit(db, "AUTO_RECONCILIATION_RUN", user, "Task", task_id, {"strategy": payload.strategy, "count": count})
    return {"status": "completed", "task_id": task_id, "reconciled_documents": count}

@router.post("/documents/{document_id}", response_model=ConsensusResponse)
def reconcile_single_document(
    document_id: str,
    payload: ManualConsensusRequest,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("analyst")),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    spans_data = payload.spans or []
    for s in spans_data:
        if not s.get("text") and 0 <= s["start"] < s["end"] <= len(doc.text):
            s["text"] = doc.text[s["start"]:s["end"]]

    existing = db.query(Consensus).filter(Consensus.document_id == document_id).first()
    if existing:
        existing.reconciled_by = user.user_id
        existing.status = payload.status
        existing.class_label = payload.class_label
        existing.spans_json = json.dumps(spans_data)
        existing.reconciliation_method = payload.reconciliation_method
        existing.notes = payload.notes
        existing.updated_at = utc_now()
        db.commit()
        db.refresh(existing)
        cons_obj = existing
    else:
        cons_obj = Consensus(
            id=str(uuid.uuid4()), document_id=doc.id, task_id=doc.task_id, reconciled_by=user.user_id,
            status=payload.status, task_type=doc.task.task_type, class_label=payload.class_label,
            spans_json=json.dumps(spans_data), reconciliation_method=payload.reconciliation_method,
            notes=payload.notes, created_at=utc_now(), updated_at=utc_now(),
        )
        db.add(cons_obj)
        db.commit()
        db.refresh(cons_obj)

    record_audit(db, "CONSENSUS_SAVED", user, "Consensus", cons_obj.id, {"document_id": document_id})
    return ConsensusResponse(
        id=cons_obj.id, document_id=cons_obj.document_id, task_id=cons_obj.task_id,
        reconciled_by=cons_obj.reconciled_by, status=cons_obj.status, task_type=cons_obj.task_type,
        class_label=cons_obj.class_label, spans=json.loads(cons_obj.spans_json or "[]"),
        reconciliation_method=cons_obj.reconciliation_method, notes=cons_obj.notes,
        created_at=cons_obj.created_at.isoformat(), updated_at=cons_obj.updated_at.isoformat(),
    )

@router.get("/tasks/{task_id}", response_model=List[ConsensusResponse])
def list_task_consensus(
    task_id: str,
    status_filter: Optional[str] = Query(None, pattern="^(draft|approved)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    query = db.query(Consensus).filter(Consensus.task_id == task_id)
    if status_filter: query = query.filter(Consensus.status == status_filter)
    records = query.order_by(Consensus.updated_at.desc()).offset(offset).limit(limit).all()
    return [
        ConsensusResponse(
            id=c.id, document_id=c.document_id, task_id=c.task_id, reconciled_by=c.reconciled_by,
            status=c.status, task_type=c.task_type, class_label=c.class_label,
            spans=json.loads(c.spans_json or "[]"), reconciliation_method=c.reconciliation_method,
            notes=c.notes, created_at=c.created_at.isoformat(), updated_at=c.updated_at.isoformat(),
        )
        for c in records
    ]

@router.get("/export/{task_id}")
def export_gold_dataset(
    task_id: str,
    format: str = Query("jsonl", pattern="^(jsonl|conll|huggingface)$"),
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    consensus_list = db.query(Consensus).filter(Consensus.task_id == task_id).all()
    if not consensus_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No consensus records to export")

    export_records = []
    for c in consensus_list:
        doc = db.query(Document).filter(Document.id == c.document_id).first()
        export_records.append({
            "id": c.document_id, "text": doc.text if doc else "",
            "class_label": c.class_label, "spans": json.loads(c.spans_json or "[]"),
            "status": c.status, "method": c.reconciliation_method,
        })

    if format == "jsonl":
        return Response(content=export_to_jsonl(export_records), media_type="application/x-ndjson")
    elif format == "conll":
        return Response(content=export_to_conll(export_records), media_type="text/plain")
    return {"dataset": export_to_huggingface(export_records), "task_id": task_id}
