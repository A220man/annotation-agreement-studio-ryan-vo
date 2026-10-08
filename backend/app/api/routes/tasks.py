import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import require_role, AuthenticatedUser
from backend.app.models.entities import Task, Document, utc_now
from backend.app.api.deps import record_audit

router = APIRouter(prefix="/tasks", tags=["Tasks"])

class TaskCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    task_type: str = Field(..., pattern="^(classification|span)$")
    guidelines: Optional[str] = None
    labels_schema: List[str] = Field(default_factory=list)

class TaskResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    task_type: str
    guidelines: Optional[str] = None
    labels_schema: List[str]
    document_count: int = 0
    created_at: str
    updated_at: str

class DocumentCreate(BaseModel):
    text: str = Field(..., min_length=1)
    metadata: Optional[dict] = None

class BatchDocumentCreate(BaseModel):
    documents: List[DocumentCreate]

class DocumentResponse(BaseModel):
    id: str
    task_id: str
    text: str
    metadata: dict
    annotation_count: int = 0
    has_consensus: bool = False
    created_at: str

@router.get("", response_model=List[TaskResponse])
def list_tasks(
    task_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    query = db.query(Task)
    if task_type: query = query.filter(Task.task_type == task_type)
    if search: query = query.filter(Task.name.ilike(f"%{search}%"))
    tasks = query.order_by(Task.created_at.desc()).offset(offset).limit(limit).all()
    return [
        TaskResponse(
            id=t.id, name=t.name, description=t.description, task_type=t.task_type,
            guidelines=t.guidelines, labels_schema=json.loads(t.labels_schema or "[]"),
            document_count=db.query(Document).filter(Document.task_id == t.id).count(),
            created_at=t.created_at.isoformat(), updated_at=t.updated_at.isoformat(),
        )
        for t in tasks
    ]

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("analyst")),
):
    task = Task(
        id=str(uuid.uuid4()), name=payload.name, description=payload.description, task_type=payload.task_type,
        guidelines=payload.guidelines, labels_schema=json.dumps(payload.labels_schema),
        created_at=utc_now(), updated_at=utc_now(),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    record_audit(db, "TASK_CREATED", user, "Task", task.id, {"name": task.name})
    return TaskResponse(
        id=task.id, name=task.name, description=task.description, task_type=task.task_type,
        guidelines=task.guidelines, labels_schema=payload.labels_schema, document_count=0,
        created_at=task.created_at.isoformat(), updated_at=task.updated_at.isoformat(),
    )

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: str,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task: raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse(
        id=task.id, name=task.name, description=task.description, task_type=task.task_type,
        guidelines=task.guidelines, labels_schema=json.loads(task.labels_schema or "[]"),
        document_count=db.query(Document).filter(Document.task_id == task.id).count(),
        created_at=task.created_at.isoformat(), updated_at=task.updated_at.isoformat(),
    )

@router.delete("/{task_id}")
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("admin")),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task: raise HTTPException(status_code=404, detail="Task not found")
    record_audit(db, "TASK_DELETED", user, "Task", task.id)
    db.delete(task)
    db.commit()
    return {"status": "deleted"}

@router.post("/{task_id}/documents", status_code=status.HTTP_201_CREATED)
def add_documents_to_task(
    task_id: str,
    payload: BatchDocumentCreate,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("analyst")),
):
    created = []
    for doc in payload.documents:
        doc_obj = Document(id=str(uuid.uuid4()), task_id=task_id, text=doc.text, metadata_json=json.dumps(doc.metadata or {}), created_at=utc_now())
        db.add(doc_obj)
        created.append(doc_obj.id)
    db.commit()
    record_audit(db, "DOCUMENTS_IMPORTED", user, "Task", task_id, {"count": len(created)})
    return {"status": "created", "count": len(created), "document_ids": created}

@router.get("/{task_id}/documents", response_model=List[DocumentResponse])
def list_task_documents(
    task_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    docs = db.query(Document).filter(Document.task_id == task_id).order_by(Document.created_at.asc()).offset(offset).limit(limit).all()
    return [
        DocumentResponse(
            id=d.id, task_id=d.task_id, text=d.text, metadata=json.loads(d.metadata_json or "{}"),
            annotation_count=len(d.annotations), has_consensus=d.consensus is not None, created_at=d.created_at.isoformat(),
        )
        for d in docs
    ]
