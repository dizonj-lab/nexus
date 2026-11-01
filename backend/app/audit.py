from fastapi import Request
from sqlalchemy.orm import Session

from .models import AuditEvent


def client_ip(request: Request | None) -> str:
    if request is None:
        return ""
    fwd = request.headers.get("x-forwarded-for", "")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else ""))[:64]


def record(db: Session, action: str, *, user_id: int | None = None, target: str = "", detail: dict | None = None,
           request: Request | None = None) -> None:
    db.add(AuditEvent(user_id=user_id, action=action, target=target, detail=detail or {}, ip=client_ip(request)))
