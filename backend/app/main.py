"""NEXUS API."""
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from sqlalchemy import select

from . import audit
from .config import get_settings
from .db import Base, SessionLocal, engine
from .deps import csrf_guard
from .models import User
from .routers import agents, auth, projects, users
from .security import hash_password, password_problem

log = logging.getLogger("nexus")


def bootstrap_admin() -> None:
    """Create the first administrator from NEXUS_ADMIN_EMAIL / NEXUS_ADMIN_PASSWORD when no user exists."""
    s = get_settings()
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)) is not None:
            return
        if not s.admin_email or not s.admin_password:
            log.warning("No users yet. Set NEXUS_ADMIN_EMAIL and NEXUS_ADMIN_PASSWORD, or run: python -m app.cli create-admin")
            return
        if problem := password_problem(s.admin_password):
            raise RuntimeError(f"NEXUS_ADMIN_PASSWORD is too weak: {problem}")
        u = User(email=s.admin_email.lower(), name=s.admin_name, password_hash=hash_password(s.admin_password),
                 system_role="admin")
        db.add(u)
        db.flush()
        audit.record(db, "user.bootstrap_admin", user_id=u.id, target=f"user:{u.id}")
        db.commit()
        log.warning("Created the first administrator %s", u.email)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if engine.url.get_backend_name() == "sqlite":
        Base.metadata.create_all(engine)  # development only; PostgreSQL uses Alembic migrations
    bootstrap_admin()
    yield


app = FastAPI(title="NEXUS API", version="0.2.9", lifespan=lifespan, dependencies=[Depends(csrf_guard)],
              docs_url="/api/docs", openapi_url="/api/openapi.json")
for r in (auth.router, users.router, projects.router, agents.router):
    app.include_router(r)


@app.get("/healthz", include_in_schema=False)
@app.get("/api/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok", "version": app.version}
