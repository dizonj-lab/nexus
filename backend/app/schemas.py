from datetime import datetime

from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field


def _email(v: str) -> str:
    v = v.strip().lower()
    local, _, domain = v.partition("@")
    if not local or "." not in domain or " " in v or len(v) > 254:
        raise ValueError("Enter an email address like name@example.com")
    return v


# Internal domains (.local, .lan, .test) are allowed: NEXUS often runs on a home or corporate network.
EmailStr = Annotated[str, AfterValidator(_email)]


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    system_role: str
    active: bool
    created_at: datetime
    last_login_at: datetime | None = None


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=200)
    system_role: str = Field(default="member", pattern="^(admin|member)$")


class UserPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    system_role: str | None = Field(default=None, pattern="^(admin|member)$")
    active: bool | None = None
    password: str | None = Field(default=None, min_length=1, max_length=200)


class PasswordChange(BaseModel):
    current: str = Field(max_length=200)
    new: str = Field(max_length=200)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=2000)
    start: str = Field(default="blank", pattern="^(blank|sample)$")
    deploy: str = Field(default="aws", pattern="^(aws|azure|gcp|vmware|local|hybrid)$")


class ProjectPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=2000)
    archived: bool | None = None


class DesignPut(BaseModel):
    design: dict
    base_version: int
    message: str = Field(default="", max_length=300)


class MemberPut(BaseModel):
    email: EmailStr
    role: str = Field(pattern="^(viewer|reviewer|security|architect|lead|owner)$")


class ChangesetIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    rationale: str = Field(default="", max_length=4000)
    ops: list[dict] = Field(min_length=1, max_length=200)


class Decision(BaseModel):
    note: str = Field(default="", max_length=2000)


class RunIn(BaseModel):
    goal: str = Field(min_length=3, max_length=4000)
