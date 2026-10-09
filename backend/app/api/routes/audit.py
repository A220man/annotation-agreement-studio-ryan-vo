import json
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_role, AuthenticatedUser
from app.models.entities import AuditLog

router = APIRouter(prefix="/audit", tags=["Audit Log"])

class AuditLogResponse(BaseModel):
    id: str
    event_type: str
    user_id: str
    user_email: Optional[str] = None
    entity_type: str
    entity_id: str
    details: dict
    created_at: str

@router.get("", response_model=List[AuditLogResponse])
def list_audit_logs(
    event_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    """Retrieves paginated immutable audit logs of system mutations."""
    query = db.query(AuditLog)
    if event_type:
        query = query.filter(AuditLog.event_type == event_type)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    out = []
    for log in logs:
        details = json.loads(log.details_json) if log.details_json else {}
        out.append(
            AuditLogResponse(
                id=log.id,
                event_type=log.event_type,
                user_id=log.user_id,
                user_email=log.user_email,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                details=details,
                created_at=log.created_at.isoformat(),
            )
        )
    return out
