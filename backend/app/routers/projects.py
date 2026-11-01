from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import audit
from .. import design as dm
from ..db import get_db
from ..deps import Access, access, current_user
from ..models import Changeset, DesignRevision, Membership, Project, User
from ..rbac import PROJECT_ROLES, outranks, role_perms
from ..schemas import ChangesetIn, Decision, DesignPut, MemberPut, ProjectCreate, ProjectPatch

router = APIRouter(prefix="/api/projects", tags=["projects"])


def project_out(p: Project, role: str | None, members: int | None = None) -> dict:
    return {"id": p.id, "name": p.name, "description": p.description, "archived": p.archived,
            "design_version": p.design_version, "updated_at": p.updated_at, "created_at": p.created_at,
            "role": role, "permissions": sorted(role_perms(role)), "members": members,
            "components": len((p.design or {}).get("nodes", {}))}


@router.get("")
def list_projects(user: User = Depends(current_user), db: Session = Depends(get_db)):
    counts = dict(db.execute(select(Membership.project_id, func.count()).group_by(Membership.project_id)).all())
    if user.system_role == "admin":
        rows = [(p, "owner") for p in db.scalars(select(Project).order_by(Project.updated_at.desc()))]
    else:
        q = (select(Project, Membership.role).join(Membership, Membership.project_id == Project.id)
             .where(Membership.user_id == user.id).order_by(Project.updated_at.desc()))
        rows = db.execute(q).all()
    return [project_out(p, r, counts.get(p.id, 0)) for p, r in rows]


@router.post("", status_code=201)
def create_project(body: ProjectCreate, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    design = dm.sample_design() if body.start == "sample" else dm.blank_design(body.name, body.deploy)
    design["project"] = body.name
    if body.start == "sample":
        design["deploy"] = body.deploy
    p = Project(name=body.name.strip(), description=body.description, design=dm.strip_secrets(design), design_version=1,
                created_by=user.id)
    db.add(p)
    db.flush()
    db.add(Membership(project_id=p.id, user_id=user.id, role="owner"))
    db.add(DesignRevision(project_id=p.id, version=1, design=p.design, author_id=user.id, source="create",
                          message=f"Created ({body.start})"))
    audit.record(db, "project.created", user_id=user.id, target=f"project:{p.id}", detail={"start": body.start}, request=request)
    db.commit()
    return project_out(p, "owner", 1)


@router.get("/{project_id}")
def get_project(a: Access = Depends(access("project:read"))):
    return project_out(a.project, a.role)


@router.patch("/{project_id}")
def patch_project(body: ProjectPatch, request: Request, a: Access = Depends(access("project:settings")),
                  db: Session = Depends(get_db)):
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(a.project, k, v.strip() if isinstance(v, str) else v)
    audit.record(db, "project.updated", user_id=a.user.id, target=f"project:{a.project.id}",
                 detail=body.model_dump(exclude_none=True), request=request)
    db.commit()
    return project_out(a.project, a.role)


@router.delete("/{project_id}", status_code=204)
def delete_project(request: Request, a: Access = Depends(access("project:delete")), db: Session = Depends(get_db)):
    audit.record(db, "project.deleted", user_id=a.user.id, target=f"project:{a.project.id}",
                 detail={"name": a.project.name}, request=request)
    db.delete(a.project)
    db.commit()


# ---------- design ----------
@router.get("/{project_id}/design")
def get_design(a: Access = Depends(access("project:read"))):
    return {"design": a.project.design, "version": a.project.design_version}


@router.put("/{project_id}/design")
def put_design(body: DesignPut, request: Request, a: Access = Depends(access("design:edit")), db: Session = Depends(get_db)):
    p = a.project
    if body.base_version != p.design_version:
        raise HTTPException(409, {"message": "Someone saved a newer version. Reload to continue.",
                                  "version": p.design_version})
    design = dm.strip_secrets(body.design)
    if errors := dm.validate(design):
        raise HTTPException(422, {"message": "The design is not valid.", "errors": errors})
    p.design, p.design_version = design, p.design_version + 1
    p.updated_at = datetime.now(timezone.utc)
    db.add(DesignRevision(project_id=p.id, version=p.design_version, design=design, author_id=a.user.id,
                          source="workbench", message=body.message))
    audit.record(db, "design.saved", user_id=a.user.id, target=f"project:{p.id}", detail={"version": p.design_version},
                 request=request)
    db.commit()
    return {"version": p.design_version}


@router.get("/{project_id}/revisions")
def revisions(a: Access = Depends(access("project:read")), db: Session = Depends(get_db)):
    rows = db.execute(select(DesignRevision.version, DesignRevision.source, DesignRevision.message,
                             DesignRevision.created_at, User.name)
                      .join(User, User.id == DesignRevision.author_id)
                      .where(DesignRevision.project_id == a.project.id)
                      .order_by(DesignRevision.version.desc()).limit(100)).all()
    return [{"version": v, "source": s, "message": m, "at": t, "author": n} for v, s, m, t, n in rows]


@router.get("/{project_id}/findings")
def findings(a: Access = Depends(access("project:read"))):
    return dm.check(a.project.design or {})


# ---------- members ----------
@router.get("/{project_id}/members")
def members(a: Access = Depends(access("project:read")), db: Session = Depends(get_db)):
    rows = db.execute(select(Membership, User).join(User, User.id == Membership.user_id)
                      .where(Membership.project_id == a.project.id).order_by(User.name)).all()
    return [{"user_id": u.id, "name": u.name, "email": u.email, "role": m.role,
             "role_label": PROJECT_ROLES[m.role]["label"], "added_at": m.added_at} for m, u in rows]


def _owners(db: Session, pid: int) -> int:
    return db.scalar(select(func.count()).select_from(Membership).where(Membership.project_id == pid,
                                                                         Membership.role == "owner"))


@router.put("/{project_id}/members")
def put_member(body: MemberPut, request: Request, a: Access = Depends(access("members:manage")),
               db: Session = Depends(get_db)):
    if not outranks(a.role, body.role):
        raise HTTPException(403, "You cannot grant a role above your own.")
    u = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if not u or not u.active:
        raise HTTPException(404, "No active user with that email. Ask an administrator to add them.")
    m = db.scalar(select(Membership).where(Membership.project_id == a.project.id, Membership.user_id == u.id))
    if m and not outranks(a.role, m.role):
        raise HTTPException(403, "You cannot change someone whose role is above your own.")
    if m and m.role == "owner" and body.role != "owner" and _owners(db, a.project.id) <= 1:
        raise HTTPException(400, "A project needs at least one owner.")
    before = m.role if m else None
    if m:
        m.role = body.role
    else:
        db.add(Membership(project_id=a.project.id, user_id=u.id, role=body.role))
    audit.record(db, "member.set", user_id=a.user.id, target=f"project:{a.project.id}",
                 detail={"user": u.id, "from": before, "to": body.role}, request=request)
    db.commit()
    return {"user_id": u.id, "role": body.role}


@router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_member(user_id: int, request: Request, a: Access = Depends(access("members:manage")),
                  db: Session = Depends(get_db)):
    m = db.scalar(select(Membership).where(Membership.project_id == a.project.id, Membership.user_id == user_id))
    if not m:
        raise HTTPException(404, "Not a member")
    if not outranks(a.role, m.role):
        raise HTTPException(403, "You cannot remove someone whose role is above your own.")
    if m.role == "owner" and _owners(db, a.project.id) <= 1:
        raise HTTPException(400, "A project needs at least one owner.")
    db.delete(m)
    audit.record(db, "member.removed", user_id=a.user.id, target=f"project:{a.project.id}",
                 detail={"user": user_id, "role": m.role}, request=request)
    db.commit()


# ---------- changesets ----------
def cs_out(c: Changeset, names: dict[int, str]) -> dict:
    return {"id": c.id, "ref": f"CS-{c.id:04d}", "title": c.title, "rationale": c.rationale, "ops": c.ops,
            "status": c.status, "base_version": c.base_version, "proposed_by": names.get(c.proposed_by),
            "agent": c.agent_id, "run_id": c.run_id, "decided_by": names.get(c.decided_by) if c.decided_by else None,
            "decided_at": c.decided_at, "decision_note": c.decision_note, "created_at": c.created_at}


def _names(db: Session) -> dict[int, str]:
    return {u.id: u.name for u in db.scalars(select(User))}


@router.get("/{project_id}/changesets")
def list_changesets(a: Access = Depends(access("project:read")), db: Session = Depends(get_db)):
    rows = db.scalars(select(Changeset).where(Changeset.project_id == a.project.id).order_by(Changeset.id.desc())).all()
    names = _names(db)
    return [cs_out(c, names) for c in rows]


@router.post("/{project_id}/changesets", status_code=201)
def propose(body: ChangesetIn, request: Request, a: Access = Depends(access("design:propose")), db: Session = Depends(get_db)):
    try:
        dm.apply_ops(a.project.design or {}, body.ops)
    except dm.OpError as e:
        raise HTTPException(422, f"Dry run failed: {e}")
    c = Changeset(project_id=a.project.id, title=body.title, rationale=body.rationale, ops=body.ops,
                  base_version=a.project.design_version, proposed_by=a.user.id)
    db.add(c)
    db.flush()
    audit.record(db, "changeset.proposed", user_id=a.user.id, target=f"project:{a.project.id}", detail={"cs": c.id},
                 request=request)
    db.commit()
    return cs_out(c, _names(db))


def _pending(db: Session, a: Access, cid: int) -> Changeset:
    c = db.get(Changeset, cid)
    if not c or c.project_id != a.project.id:
        raise HTTPException(404, "Changeset not found")
    if c.status != "proposed":
        raise HTTPException(409, f"Changeset is already {c.status}.")
    return c


@router.post("/{project_id}/changesets/{cid}/apply")
def apply_changeset(cid: int, body: Decision, request: Request, a: Access = Depends(access("changeset:apply")),
                    db: Session = Depends(get_db)):
    c = _pending(db, a, cid)
    p = a.project
    try:
        new = dm.apply_ops(p.design or {}, c.ops)  # applies to the current design, even if it moved on
    except dm.OpError as e:
        raise HTTPException(409, f"No longer applies to the current design: {e}")
    p.design, p.design_version = new, p.design_version + 1
    p.updated_at = datetime.now(timezone.utc)
    c.status, c.decided_by, c.decided_at, c.decision_note = "applied", a.user.id, datetime.now(timezone.utc), body.note
    db.add(DesignRevision(project_id=p.id, version=p.design_version, design=new, author_id=a.user.id,
                          source=f"changeset:{c.id}", message=c.title[:300]))
    audit.record(db, "changeset.applied", user_id=a.user.id, target=f"project:{p.id}",
                 detail={"cs": c.id, "version": p.design_version, "agent": c.agent_id}, request=request)
    db.commit()
    return cs_out(c, _names(db)) | {"version": p.design_version}


@router.post("/{project_id}/changesets/{cid}/reject")
def reject_changeset(cid: int, body: Decision, request: Request, a: Access = Depends(access("changeset:apply")),
                     db: Session = Depends(get_db)):
    c = _pending(db, a, cid)
    c.status, c.decided_by, c.decided_at, c.decision_note = "rejected", a.user.id, datetime.now(timezone.utc), body.note
    audit.record(db, "changeset.rejected", user_id=a.user.id, target=f"project:{a.project.id}", detail={"cs": c.id},
                 request=request)
    db.commit()
    return cs_out(c, _names(db))
