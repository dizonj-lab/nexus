from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import audit
from ..config import get_settings
from ..db import get_db
from ..deps import current_user, optional_user
from ..models import User
from ..rbac import matrix
from ..schemas import LoginIn, PasswordChange
from ..security import COOKIE, hash_password, make_token, password_problem, throttle, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
GENERIC = "Email or password is not correct."


def me_payload(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "system_role": u.system_role}


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = audit.client_ip(request)
    email = body.email.lower()
    if throttle.locked(email, ip):
        audit.record(db, "auth.locked", target=email, request=request)
        db.commit()
        raise HTTPException(429, "Too many failed attempts. Try again in a few minutes.")
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if not user or not user.active or not verify_password(body.password, user.password_hash):
        throttle.fail(email, ip)
        audit.record(db, "auth.failed", target=email, request=request)
        db.commit()
        raise HTTPException(401, GENERIC)
    throttle.clear(email, ip)
    user.last_login_at = datetime.now(timezone.utc)
    audit.record(db, "auth.login", user_id=user.id, request=request)
    db.commit()
    s = get_settings()
    response.set_cookie(COOKIE, make_token(user.id, user.session_version), httponly=True, secure=s.cookie_secure,
                        samesite="lax", max_age=s.session_hours * 3600, path="/")
    return me_payload(user)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, user: User | None = Depends(optional_user),
           db: Session = Depends(get_db)):
    if user:
        audit.record(db, "auth.logout", user_id=user.id, request=request)
        db.commit()
    response.delete_cookie(COOKIE, path="/")


@router.get("/me")
def me(user: User = Depends(current_user)):
    return me_payload(user)


@router.get("/check", status_code=204, include_in_schema=False)
def check(user: User = Depends(current_user)):
    """Used by nginx auth_request to protect /llm/, /c4/ and /prototype/."""
    return Response(status_code=204)


@router.post("/password", status_code=204)
def change_password(body: PasswordChange, request: Request, response: Response,
                    user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current, user.password_hash):
        raise HTTPException(400, "Current password is not correct.")
    if problem := password_problem(body.new):
        raise HTTPException(400, problem)
    user.password_hash = hash_password(body.new)
    user.session_version += 1
    audit.record(db, "auth.password_changed", user_id=user.id, request=request)
    db.commit()
    s = get_settings()
    response.set_cookie(COOKIE, make_token(user.id, user.session_version), httponly=True, secure=s.cookie_secure,
                        samesite="lax", max_age=s.session_hours * 3600, path="/")


@router.get("/roles")
def roles():
    """The permission matrix, public so the landing page can show it."""
    return matrix()
