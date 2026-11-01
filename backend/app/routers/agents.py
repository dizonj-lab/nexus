from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Access, access, current_user
from ..harness.cards import load_cards
from ..harness.model import ModelClient, route
from ..harness.policy import effective_tools
from ..harness.runner import run_agent
from ..harness.tools import REGISTRY
from ..models import AgentRun, User
from ..schemas import RunIn

router = APIRouter(tags=["agents"])


def get_model_factory():
    """Overridden in tests with a scripted model."""
    return route


@router.get("/api/agents")
def catalogue(user: User = Depends(current_user)):
    return {"agents": [c.public() for c in load_cards().values()],
            "tools": [{"name": t.name, "description": t.description, "permission": t.permission}
                      for t in REGISTRY.values()]}


@router.get("/api/projects/{project_id}/agents")
def project_agents(a: Access = Depends(access("project:read"))):
    out = []
    for c in load_cards().values():
        allowed, denied = effective_tools(c, a.perms)
        out.append({"id": c.id, "name": c.name, "purpose": c.purpose, "model": c.model,
                    "can_run": c.run_permission in a.perms, "run_permission": c.run_permission,
                    "allowed_tools": allowed, "denied_tools": denied,
                    "budget": {"steps": c.max_steps, "tool_calls": c.max_tool_calls, "tokens": c.max_tokens,
                               "seconds": c.timeout_s}})
    return out


def run_out(r: AgentRun, names: dict[int, str] | None = None) -> dict:
    return {"id": r.id, "agent": r.agent_id, "goal": r.goal, "status": r.status, "answer": r.answer,
            "model": r.model, "allowed_tools": r.allowed_tools, "denied_tools": r.denied_tools, "trace": r.trace,
            "steps": r.steps, "tokens": r.tokens, "duration_ms": r.duration_ms, "created_at": r.created_at,
            "user": (names or {}).get(r.user_id)}


@router.post("/api/projects/{project_id}/agents/{agent_id}/runs", status_code=201)
def start_run(agent_id: str, body: RunIn, a: Access = Depends(access("project:read")), db: Session = Depends(get_db),
              model_factory=Depends(get_model_factory)):
    card = load_cards().get(agent_id)
    if not card:
        raise HTTPException(404, "No such agent")
    a.require(card.run_permission)
    if card.model == "llm":
        a.require("model:escalate")
    model: ModelClient = model_factory(card.model)
    run = run_agent(db, card=card, project=a.project, user=a.user, perms=a.perms, goal=body.goal, model=model)
    return run_out(run, {a.user.id: a.user.name})


@router.get("/api/projects/{project_id}/runs")
def list_runs(a: Access = Depends(access("project:read")), db: Session = Depends(get_db)):
    names = {u.id: u.name for u in db.scalars(select(User))}
    rows = db.scalars(select(AgentRun).where(AgentRun.project_id == a.project.id).order_by(AgentRun.id.desc()).limit(50))
    return [run_out(r, names) for r in rows]
