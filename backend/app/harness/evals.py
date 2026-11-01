"""Run harness evals: python -m app.harness.evals [--agent ID] [--model NAME].

Uses a throwaway in-memory database with the sample design, the real cards and
the configured model server, and prints a pass rate per agent.
"""
import argparse
import sys
from pathlib import Path

import yaml
from sqlalchemy.orm import sessionmaker

from .. import design as dm
from ..config import get_settings
from ..db import Base, make_engine
from ..models import Project, User
from ..rbac import role_perms
from .cards import load_cards
from .model import ModelClient, OpenAICompatible
from .runner import run_agent


def judge(run, expect: dict) -> list[str]:
    called = {t["tool"] for t in run.trace if t.get("type") == "tool"}
    fails = []
    if "status" in expect and run.status != expect["status"]:
        fails.append(f"status {run.status} != {expect['status']}")
    for t in expect.get("tools_called", []):
        if t not in called:
            fails.append(f"did not call {t}")
    for t in expect.get("tools_not_called", []):
        if t in called:
            fails.append(f"called {t}")
    if expect.get("proposal") and "changeset.propose" not in called:
        fails.append("no proposal")
    words = expect.get("answer_mentions_any")
    if words and not any(w.lower() in run.answer.lower() for w in words):
        fails.append(f"answer mentions none of {words}")
    return fails


def run_cases(cases: list[dict], model_for) -> list[dict]:
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    user = User(email="eval@nexus.local", name="Eval", password_hash="-", system_role="member")
    db.add(user)
    db.flush()
    cards = load_cards()
    results = []
    for case in cases:
        project = Project(name="Eval", design=dm.sample_design(), design_version=1, created_by=user.id)
        db.add(project)
        db.flush()
        run = run_agent(db, card=cards[case["agent"]], project=project, user=user, perms=role_perms("architect"),
                        goal=case["goal"], model=model_for(cards[case["agent"]]))
        fails = judge(run, case.get("expect", {}))
        results.append({"id": case["id"], "agent": case["agent"], "pass": not fails, "fails": fails,
                        "status": run.status, "steps": run.steps, "ms": run.duration_ms})
    return results


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent")
    ap.add_argument("--model", help="override the model name for every case")
    a = ap.parse_args(argv)
    s = get_settings()
    cases = []
    for f in sorted((s.agents_dir / "evals").glob("*.yaml")):
        cases += yaml.safe_load(Path(f).read_text())
    if a.agent:
        cases = [c for c in cases if c["agent"] == a.agent]

    def model_for(card) -> ModelClient:
        name = a.model or (s.llm_model if card.model == "llm" else s.slm_model)
        return OpenAICompatible(s.llm_base_url, name, s.llm_api_key)

    res = run_cases(cases, model_for)
    for r in res:
        print(f"{'PASS' if r['pass'] else 'FAIL'}  {r['id']:<18} {r['agent']:<13} {r['status']:<16} {r['steps']} steps {r['ms']} ms  {'; '.join(r['fails'])}")
    ok = sum(r["pass"] for r in res)
    print(f"\n{ok}/{len(res)} passed")
    return 0 if ok == len(res) else 1


if __name__ == "__main__":
    sys.exit(main())
