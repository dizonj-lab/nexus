"""Request dependencies: who is calling, and what may they do here."""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Membership, Project, User
from .rbac import role_perms
from .security import COOKIE, read_token

SAFE = {"GET", "HEAD", "OPTIONS"}


def csrf_guard(request: Request) -> None:
    """Session cookies are SameSite=Lax; state-changing calls must also carry a header a cross-site form cannot set."""
    if request.method not in SAFE and request.headers.get("x-nexus-client") is None:
        raise HTTPException(403, "Missing X-Nexus-Client header")


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    tok = request.cookies.get(COOKIE)
    data = read_token(tok) if tok else None
    if not data:
        return None
    user = db.get(User, int(data["sub"]))
    if not user or not user.active or user.session_version != data.get("sv"):
        return None
    return user


def current_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(401, "Sign in required")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.system_role != "admin":
        raise HTTPException(403, "Administrators only")
    return user


@dataclass
class Access:
    user: User
    project: Project
    role: str | None
    perms: set[str]

    def require(self, perm: str) -> None:
        if perm not in self.perms:
            raise HTTPException(403, f"Your role here does not allow: {perm}")


def project_access(db: Session, user: User, project_id: int) -> Access:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    m = db.scalar(select(Membership).where(Membership.project_id == project_id, Membership.user_id == user.id))
    role = m.role if m else None
    if user.system_role == "admin":
        role = "owner"
    if role is None:
        # Do not reveal that the project exists.
        raise HTTPException(404, "Project not found")
    return Access(user, project, role, role_perms(role))


def access(perm: str):
    def dep(project_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Access:
        a = project_access(db, user, project_id)
        a.require(perm)
        return a
    return dep
