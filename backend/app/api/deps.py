import json
from typing import Optional
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, AuthenticatedUser
from backend.app.models.entities import AuditLog, utc_now

def record_audit(
    db: Session,
    event_type: str,
    user: AuthenticatedUser,
    entity_type: str,
    entity_id: str,
    details: Optional[dict] = None,
) -> AuditLog:
    """Helper to record immutable audit log entry."""
    entry = AuditLog(
        id=f"audit-{utc_now().strftime('%Y%m%d%H%M%S%f')}",
        event_type=event_type,
        user_id=user.user_id,
        user_email=user.email,
        entity_type=entity_type,
        entity_id=entity_id,
        details_json=json.dumps(details or {}),
        created_at=utc_now(),
    )
    db.add(entry)
    db.commit()
    return entry
