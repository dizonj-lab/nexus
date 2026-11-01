"""Tables. The design itself is stored as JSON validated against schema/design-model.schema.json."""
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

Json = JSON().with_variant(JSONB(), "postgresql")


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    system_role: Mapped[str] = mapped_column(String(20), default="member")  # admin | member
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Bumped on password, role or status change: every older session becomes invalid.
    session_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text, default="")
    design: Mapped[dict | None] = mapped_column(Json, nullable=True)
    design_version: Mapped[int] = mapped_column(Integer, default=0)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    members: Mapped[list["Membership"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    project: Mapped[Project] = relationship(back_populates="members")
    user: Mapped[User] = relationship()


class DesignRevision(Base):
    """Every saved design version. Becomes the event log in WP1."""
    __tablename__ = "design_revisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    design: Mapped[dict] = mapped_column(Json)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    source: Mapped[str] = mapped_column(String(40), default="workbench")  # workbench | changeset:<id>
    message: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Changeset(Base):
    """A proposed change. Agents and people propose; someone with changeset:apply applies."""
    __tablename__ = "changesets"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    rationale: Mapped[str] = mapped_column(Text, default="")
    ops: Mapped[list] = mapped_column(Json)
    status: Mapped[str] = mapped_column(String(20), default="proposed")  # proposed | applied | rejected
    base_version: Mapped[int] = mapped_column(Integer)
    proposed_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    agent_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    run_id: Mapped[int | None] = mapped_column(ForeignKey("agent_runs.id"), nullable=True)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AgentRun(Base):
    """One harness run: who started it, which agent, the tools it could use, every step, and the outcome."""
    __tablename__ = "agent_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    agent_id: Mapped[str] = mapped_column(String(60))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    goal: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(120), default="")
    allowed_tools: Mapped[list] = mapped_column(Json, default=list)
    denied_tools: Mapped[list] = mapped_column(Json, default=list)
    status: Mapped[str] = mapped_column(String(30), default="running")
    answer: Mapped[str] = mapped_column(Text, default="")
    trace: Mapped[list] = mapped_column(Json, default=list)
    steps: Mapped[int] = mapped_column(Integer, default=0)
    tokens: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    target: Mapped[str] = mapped_column(String(120), default="")
    detail: Mapped[dict] = mapped_column(Json, default=dict)
    ip: Mapped[str] = mapped_column(String(64), default="")
