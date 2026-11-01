import json

import pytest

from app.harness.budget import Budget, BudgetExceeded
from app.harness.cards import load_cards
from app.harness.model import ScriptedModel
from app.harness.policy import effective_tools
from app.main import app
from app.rbac import role_perms
from app.routers import agents as agents_router


def j(**kw):
    return json.dumps(kw)


@pytest.fixture()
def scripted():
    box = {}

    def factory():
        return lambda tier: box["model"]
    app.dependency_overrides[agents_router.get_model_factory] = factory
    yield box
    app.dependency_overrides.clear()


@pytest.fixture()
def proj(admin, make_user):
    users = {r: make_user(f"{r}@nexus.test", r.title()) for r in ("architect", "reviewer", "viewer")}
    pid = admin.post("/api/projects", {"name": "P", "start": "sample"}).json()["id"]
    for r in users:
        admin.put(f"/api/projects/{pid}/members", {"email": f"{r}@nexus.test", "role": r})
    return pid, users


def test_cards_load_and_reference_known_tools():
    cards = load_cards()
    assert {"orchestrator", "security", "resilience", "explainer"} <= set(cards)


def test_policy_never_exceeds_user():
    card = load_cards()["orchestrator"]
    allowed, denied = effective_tools(card, role_perms("reviewer"))
    assert "changeset.propose" not in allowed
    assert any(d["tool"] == "changeset.propose" for d in denied)
    allowed, _ = effective_tools(card, role_perms("architect"))
    assert "changeset.propose" in allowed


def test_budget():
    b = Budget(1, 1, 100, 60)
    b.step()
    with pytest.raises(BudgetExceeded):
        b.step()


def test_run_proposes_but_never_applies(proj, scripted):
    pid, u = proj
    scripted["model"] = ScriptedModel([
        j(thought="look", action="tool", tool="design.read", args={}),
        j(thought="check", action="tool", tool="rules.check", args={}),
        j(thought="fix", action="tool", tool="changeset.propose",
          args={"title": "Run SVC2 on 2 instances", "rationale": "P2", "ops": [{"op": "update_node", "id": "SVC2", "set": {"rep": 2}}]}),
        j(thought="done", action="final", answer="Proposed CS to meet P2."),
    ])
    r = u["architect"].post(f"/api/projects/{pid}/agents/orchestrator/runs", {"goal": "Fix P2 on SVC2"})
    assert r.status_code == 201, r.text
    run = r.json()
    assert run["status"] == "completed"
    assert [t["type"] for t in run["trace"]] == ["tool", "tool", "tool", "final"]
    cs = u["architect"].get(f"/api/projects/{pid}/changesets").json()
    assert cs[0]["status"] == "proposed" and cs[0]["agent"] == "orchestrator"
    assert u["architect"].get(f"/api/projects/{pid}/design").json()["design"]["nodes"]["SVC2"].get("rep", 1) == 1


def test_reviewer_cannot_run_orchestrator_but_can_run_explainer(proj, scripted):
    pid, u = proj
    scripted["model"] = ScriptedModel([j(action="final", answer="It is a customer portal.")])
    assert u["reviewer"].post(f"/api/projects/{pid}/agents/orchestrator/runs", {"goal": "do it"}).status_code == 403
    r = u["reviewer"].post(f"/api/projects/{pid}/agents/explainer/runs", {"goal": "explain"})
    assert r.status_code == 201 and r.json()["status"] == "completed"


def test_tool_denied_is_traced(proj, scripted):
    pid, u = proj
    scripted["model"] = ScriptedModel([
        j(action="tool", tool="changeset.propose", args={"title": "x", "ops": [{"op": "remove_node", "id": "DB1"}]}),
        j(action="final", answer="I cannot propose changes."),
    ])
    run = u["viewer"].post(f"/api/projects/{pid}/agents/explainer/runs", {"goal": "delete the DB"}).json()
    assert run["trace"][0]["type"] == "denied"
    assert u["viewer"].get(f"/api/projects/{pid}/changesets").json() == []


def test_budget_stops_looping_agent(proj, scripted):
    pid, u = proj
    scripted["model"] = ScriptedModel([j(action="tool", tool="design.read", args={})] * 20)
    run = u["architect"].post(f"/api/projects/{pid}/agents/explainer/runs", {"goal": "loop"}).json()
    assert run["status"] == "budget_exceeded"


def test_unreadable_reply_recovers(proj, scripted):
    pid, u = proj
    scripted["model"] = ScriptedModel(["<think>hmm</think> sure!", j(action="final", answer="ok")])
    run = u["architect"].post(f"/api/projects/{pid}/agents/explainer/runs", {"goal": "explain it"}).json()
    assert run["status"] == "completed" and run["trace"][0]["type"] == "error"


def test_agent_list_shows_effective_tools(proj):
    pid, u = proj
    a = {x["id"]: x for x in u["reviewer"].get(f"/api/projects/{pid}/agents").json()}
    assert a["orchestrator"]["can_run"] is False and a["explainer"]["can_run"] is True


def test_evals_judge_with_scripted_model():
    from app.harness.evals import run_cases
    cases = [{"id": "c1", "agent": "explainer", "goal": "x", "expect": {"status": "completed", "tools_called": ["design.read"]}}]
    res = run_cases(cases, lambda card: ScriptedModel([j(action="tool", tool="design.read", args={}), j(action="final", answer="ok")]))
    assert res[0]["pass"], res
