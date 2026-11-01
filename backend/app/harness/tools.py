"""Tools the harness can give an agent.

Each tool declares the permission a person needs to use it. In WP1 these
calls move behind MCP servers (nexus-model, nexus-governance, nexus-simulator)
with the same names, so cards do not change.
"""
from dataclasses import dataclass
from typing import Any, Callable

from sqlalchemy.orm import Session

from .. import design as dm
from ..models import Changeset, Project, User


@dataclass
class ToolContext:
    db: Session
    project: Project
    user: User
    run_id: int
    agent_id: str
    proposals: list[int]


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    permission: str
    params: dict
    fn: Callable[[ToolContext, dict], Any]


def _design(ctx: ToolContext) -> dict:
    return ctx.project.design or dm.blank_design(ctx.project.name)


def t_read(ctx, args):
    return dm.summary(_design(ctx))


def t_find(ctx, args):
    q = str(args.get("query", "")).lower()
    typ = args.get("type")
    hits = [n for n in _design(ctx).get("nodes", {}).values()
            if (not typ or n["type"] == typ) and (not q or q in n["name"].lower() or q in n["id"].lower())]
    return [{k: n.get(k) for k in ("id", "type", "name", "parent", "rep")} for n in hits[:30]]


def t_component(ctx, args):
    n = _design(ctx).get("nodes", {}).get(args.get("id"))
    if not n:
        return {"error": f"No component {args.get('id')}"}
    flows = [e for e in _design(ctx).get("edges", []) if args["id"] in (e["from"], e["to"])]
    return {"component": n, "flows": flows}


def t_check(ctx, args):
    findings = dm.check(_design(ctx))
    return {"findings": findings, "count": len(findings),
            "note": "Rule subset from the prototype; the full governance server arrives in WP1."}


def t_propose(ctx, args):
    ops = args.get("ops") or []
    title = str(args.get("title") or "").strip()[:200]
    if not title or not isinstance(ops, list) or not ops:
        return {"error": "Give a title and a non-empty list of ops."}
    try:
        after = dm.apply_ops(_design(ctx), ops)  # dry run: must apply cleanly to the current design
    except dm.OpError as e:
        return {"error": f"Dry run failed: {e}"}
    before_f = {(f["rule"], f["node"]) for f in dm.check(_design(ctx))}
    after_f = dm.check(after)
    cs = Changeset(project_id=ctx.project.id, title=title, rationale=str(args.get("rationale") or "")[:4000],
                   ops=ops, base_version=ctx.project.design_version, proposed_by=ctx.user.id,
                   agent_id=ctx.agent_id, run_id=ctx.run_id)
    ctx.db.add(cs)
    ctx.db.flush()
    ctx.proposals.append(cs.id)
    return {"changeset": f"CS-{cs.id:04d}", "status": "proposed",
            "new_findings": [f for f in after_f if (f["rule"], f["node"]) not in before_f],
            "resolved": len(before_f - {(f["rule"], f["node"]) for f in after_f}),
            "note": "Waiting for a person with changeset:apply."}


OP_SCHEMA = {
    "type": "array",
    "items": {"type": "object", "description":
              "{op:add_node,node:{id,type,name,parent?,rep?}} | {op:update_node,id,set:{...}} | {op:remove_node,id} | "
              "{op:add_edge,from,to,proto?} | {op:remove_edge,from,to}"},
}

REGISTRY: dict[str, Tool] = {t.name: t for t in [
    Tool("design.read", "Summary of the current design: components, flows, principles and ground truth.",
         "project:read", {}, t_read),
    Tool("design.find", "Find components by name/id text and optional type.", "project:read",
         {"query": "string", "type": "string?"}, t_find),
    Tool("design.component", "One component with its settings and flows.", "project:read", {"id": "string"}, t_component),
    Tool("rules.check", "Check the design against ground truth, principles and technical constraints.",
         "project:read", {}, t_check),
    Tool("changeset.propose", "Propose a changeset. It is dry-run first and then waits for a person to apply it.",
         "design:propose", {"title": "string", "rationale": "string", "ops": OP_SCHEMA}, t_propose),
]}
