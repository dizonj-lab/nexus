"""The harness loop: plan → act → observe, inside the budget and the tool policy."""
import json
import re
import time

from sqlalchemy.orm import Session

from .. import audit
from ..models import AgentRun, Project, User
from .budget import Budget, BudgetExceeded
from .cards import AgentCard
from .model import ModelClient
from .policy import effective_tools
from .tools import REGISTRY, ToolContext

OBS_LIMIT = 6000

HARNESS_RULES = """You are an agent inside the NEXUS harness, helping an architect.
Rules you must follow:
- Use only the tools listed below. Ground every claim in tool results; never invent components.
- You cannot change the design. To suggest a change, call changeset.propose (if listed); a person decides.
- Rules decide, you explain: when rules.check reports a finding, say which rule and why it matters.
- Reply with exactly one JSON object and nothing else, in one of two forms:
  {"thought": "...", "action": "tool", "tool": "<name>", "args": {...}}
  {"thought": "...", "action": "final", "answer": "<short answer for the architect>"}"""


def _system(card: AgentCard, allowed: list[str]) -> str:
    tools = "\n".join(f"- {n}: {REGISTRY[n].description} args={json.dumps(REGISTRY[n].params)}" for n in allowed) or "- (none)"
    return f"{HARNESS_RULES}\n\nYour role: {card.name}.\n{card.role_prompt.strip()}\n\nTools you may use:\n{tools}"


def parse(text: str) -> dict:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    m = re.search(r"\{.*\}", text, flags=re.S)
    if not m:
        raise ValueError("no JSON object in reply")
    obj = json.loads(m.group(0))
    if obj.get("action") not in ("tool", "final"):
        raise ValueError('"action" must be "tool" or "final"')
    return obj


def _clip(obj) -> str:
    s = json.dumps(obj, default=str)
    return s if len(s) <= OBS_LIMIT else s[:OBS_LIMIT] + '…"(truncated)"'


def run_agent(db: Session, *, card: AgentCard, project: Project, user: User, perms: set[str], goal: str,
              model: ModelClient) -> AgentRun:
    allowed, denied = effective_tools(card, perms)
    run = AgentRun(project_id=project.id, agent_id=card.id, user_id=user.id, goal=goal[:4000], model=model.name,
                   allowed_tools=allowed, denied_tools=denied, status="running", trace=[])
    db.add(run)
    db.flush()
    trace: list[dict] = []
    budget = Budget(card.max_steps, card.max_tool_calls, card.max_tokens, card.timeout_s)
    ctx = ToolContext(db, project, user, run.id, card.id, [])
    messages = [{"role": "system", "content": _system(card, allowed)},
                {"role": "user", "content": f"Project: {project.name}\nGoal: {goal}"}]
    t0 = time.monotonic()
    status, answer = "failed", ""
    try:
        while True:
            budget.step()
            ts = time.monotonic()
            reply = model.complete(messages, timeout_s=budget.remaining_s())
            budget.charge(reply.tokens)
            messages.append({"role": "assistant", "content": reply.text})
            entry = {"step": budget.steps, "type": "model", "model": reply.model, "tokens": reply.tokens,
                     "ms": int((time.monotonic() - ts) * 1000)}
            try:
                act = parse(reply.text)
            except (ValueError, json.JSONDecodeError) as e:
                trace.append(entry | {"type": "error", "error": f"unreadable reply: {e}", "raw": reply.text[:500]})
                messages.append({"role": "user", "content": f"Your reply was not valid: {e}. Reply with one JSON object."})
                continue
            entry["thought"] = str(act.get("thought", ""))[:1000]
            if act["action"] == "final":
                answer = str(act.get("answer", ""))[:8000]
                trace.append(entry | {"type": "final", "answer": answer})
                status = "completed"
                break
            name, args = act.get("tool"), act.get("args") or {}
            if name not in allowed:
                why = next((d["reason"] for d in denied if d["tool"] == name), "not on this agent's card")
                trace.append(entry | {"type": "denied", "tool": name, "reason": why})
                messages.append({"role": "user", "content": f"Tool {name} is not available to you ({why}). Use another tool or finish."})
                continue
            budget.tool()
            ts = time.monotonic()
            try:
                result = REGISTRY[name].fn(ctx, args if isinstance(args, dict) else {})
            except Exception as e:  # a failing tool is reported to the agent, not raised
                result = {"error": f"{type(e).__name__}: {e}"}
            obs = _clip(result)
            trace.append(entry | {"type": "tool", "tool": name, "args": args,
                                  "result": result if len(obs) < OBS_LIMIT else obs,
                                  "tool_ms": int((time.monotonic() - ts) * 1000)})
            messages.append({"role": "user", "content": f"Result of {name}: {obs}"})
    except BudgetExceeded as e:
        status, answer = "budget_exceeded", f"Stopped: {e}."
        trace.append({"step": budget.steps, "type": "budget", "error": str(e)})
    except Exception as e:  # model server down, timeout, etc.
        status, answer = "error", f"The model could not be reached: {type(e).__name__}."
        trace.append({"step": budget.steps, "type": "error", "error": f"{type(e).__name__}: {e}"[:500]})
    run.status, run.answer, run.trace = status, answer, trace
    run.steps, run.tokens = budget.steps, budget.tokens
    run.duration_ms = int((time.monotonic() - t0) * 1000)
    audit.record(db, "agent.run", user_id=user.id, target=f"project:{project.id}",
                 detail={"run": run.id, "agent": card.id, "status": status, "proposals": ctx.proposals})
    db.commit()
    return run
