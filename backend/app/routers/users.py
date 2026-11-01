from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import audit
from ..db import get_db
from ..deps import require_admin
from ..models import AuditEvent, User
from ..schemas import UserCreate, UserOut, UserPatch
from ..security import hash_password, password_problem

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.name)).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.scalar(select(User).where(func.lower(User.email) == body.email.lower())):
        raise HTTPException(409, "A user with that email already exists.")
    if problem := password_problem(body.password):
        raise HTTPException(400, problem)
    u = User(email=body.email.lower(), name=body.name.strip(), password_hash=hash_password(body.password),
             system_role=body.system_role)
    db.add(u)
    db.flush()
    audit.record(db, "user.created", user_id=admin.id, target=f"user:{u.id}", detail={"role": u.system_role}, request=request)
    db.commit()
    return u


@router.patch("/users/{user_id}", response_model=UserOut)
def patch_user(user_id: int, body: UserPatch, request: Request, admin: User = Depends(require_admin),
               db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    revoke = False
    if u.id == admin.id and (body.active is False or body.system_role == "member"):
        raise HTTPException(400, "You cannot remove your own administrator access.")
    if body.name is not None:
        u.name = body.name.strip()
    if body.system_role is not None and body.system_role != u.system_role:
        u.system_role, revoke = body.system_role, True
    if body.active is not None and body.active != u.active:
        u.active, revoke = body.active, True
    if body.password:
        if problem := password_problem(body.password):
            raise HTTPException(400, problem)
        u.password_hash, revoke = hash_password(body.password), True
    if revoke:
        u.session_version += 1  # signs the user out everywhere
    audit.record(db, "user.updated", user_id=admin.id, target=f"user:{u.id}",
                 detail={k: v for k, v in body.model_dump(exclude_none=True).items() if k != "password"}
                 | ({"password": "reset"} if body.password else {}), request=request)
    db.commit()
    return u


@router.get("/audit")
def audit_log(limit: int = 200, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(min(limit, 1000))).all()
    names = {u.id: u.name for u in db.scalars(select(User)).all()}
    return [{"id": r.id, "at": r.at, "user": names.get(r.user_id), "action": r.action, "target": r.target,
             "detail": r.detail, "ip": r.ip} for r in rows]
