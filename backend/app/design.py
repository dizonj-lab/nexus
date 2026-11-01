"""Design model: validation, secret stripping, changeset operations and a first set of rules.

The full governance engine moves to the nexus-governance MCP server in WP1; the
checks here are the subset the harness needs from day one.
"""
import copy
import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator

from .config import ROOT

SCHEMA_PATH = ROOT.parent / "schema" / "design-model.schema.json"
SAMPLE_PATH = ROOT.parent / "schema" / "sample-design.json"
# Fallback for container images that copy schema/ next to app/.
if not SCHEMA_PATH.exists():
    SCHEMA_PATH = ROOT / "schema" / "design-model.schema.json"
    SAMPLE_PATH = ROOT / "schema" / "sample-design.json"

MAX_DESIGN_BYTES = 2_000_000
SECRET_KEYS = {"key", "apiKey", "api_key", "token", "password", "secret"}


@lru_cache
def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(SCHEMA_PATH.read_text()))


def sample_design() -> dict:
    return json.loads(SAMPLE_PATH.read_text())


def blank_design(name: str, deploy: str = "aws") -> dict:
    """An empty canvas that still carries the organisation's standards from the sample."""
    s = sample_design()
    return {**{k: s[k] for k in ("caps", "ea", "gt", "ver") if k in s},
            "schema": s.get("schema", 3), "project": name[:80], "deploy": deploy, "mult": 1,
            "nodes": {}, "edges": [], "adrs": [], "files": [], "history": [], "versions": [], "log": []}


def validate(design: dict) -> list[str]:
    errors = []
    if len(json.dumps(design)) > MAX_DESIGN_BYTES:
        return [f"Design is larger than {MAX_DESIGN_BYTES // 1000} kB"]
    for e in sorted(_validator().iter_errors(design), key=lambda e: list(e.path))[:20]:
        where = "/".join(str(p) for p in e.path) or "(root)"
        errors.append(f"{where}: {e.message}")
    nodes = design.get("nodes", {}) if isinstance(design.get("nodes"), dict) else {}
    for nid, n in nodes.items():
        if isinstance(n, dict) and n.get("id") != nid:
            errors.append(f"nodes/{nid}: id must equal its key")
        if isinstance(n, dict) and n.get("parent") not in (None, "root") and n["parent"] not in nodes:
            errors.append(f"nodes/{nid}: parent {n['parent']} does not exist")
    for i, e in enumerate(design.get("edges", []) if isinstance(design.get("edges"), list) else []):
        for end in ("from", "to"):
            if isinstance(e, dict) and e.get(end) not in nodes:
                errors.append(f"edges/{i}: {end} {e.get(end)} does not exist")
    return errors[:20]


def strip_secrets(obj):
    """API keys typed into the workbench settings stay in that browser; they are never stored or shared."""
    if isinstance(obj, dict):
        return {k: ("" if k in SECRET_KEYS and isinstance(v, str) else strip_secrets(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [strip_secrets(v) for v in obj]
    return obj


# ---------- changeset operations ----------
OPS = {"add_node", "update_node", "remove_node", "add_edge", "remove_edge"}
IMMUTABLE = {"id"}


class OpError(ValueError):
    pass


def apply_ops(design: dict, ops: list[dict]) -> dict:
    d = copy.deepcopy(design)
    nodes, edges = d.setdefault("nodes", {}), d.setdefault("edges", [])
    for i, op in enumerate(ops):
        kind = op.get("op")
        if kind not in OPS:
            raise OpError(f"op {i}: unknown op {kind!r}")
        if kind == "add_node":
            n = dict(op.get("node") or {})
            if not n.get("id") or n["id"] in nodes:
                raise OpError(f"op {i}: node id missing or already used ({n.get('id')})")
            n.setdefault("name", n["id"])
            n.setdefault("x", 100)
            n.setdefault("y", 100)
            n.setdefault("parent", "root")
            if n["parent"] not in ("root", None) and n["parent"] not in nodes:
                raise OpError(f"op {i}: parent {n['parent']} does not exist")
            nodes[n["id"]] = n
        elif kind == "update_node":
            nid = op.get("id")
            if nid not in nodes:
                raise OpError(f"op {i}: node {nid} does not exist")
            changes = {k: v for k, v in (op.get("set") or {}).items() if k not in IMMUTABLE}
            nodes[nid].update(changes)
        elif kind == "remove_node":
            nid = op.get("id")
            if nid not in nodes:
                raise OpError(f"op {i}: node {nid} does not exist")
            gone = {nid}
            changed = True
            while changed:  # children of removed nodes go too
                more = {k for k, v in nodes.items() if v.get("parent") in gone} - gone
                changed = bool(more)
                gone |= more
            for k in gone:
                nodes.pop(k, None)
            d["edges"] = edges = [e for e in edges if e["from"] not in gone and e["to"] not in gone]
        elif kind == "add_edge":
            a, b = op.get("from"), op.get("to")
            if a not in nodes or b not in nodes or a == b:
                raise OpError(f"op {i}: both ends must exist and differ ({a} → {b})")
            if any(e["from"] == a and e["to"] == b for e in edges):
                raise OpError(f"op {i}: flow {a} → {b} already exists")
            edge = {"from": a, "to": b, "proto": op.get("proto") or "HTTPS"}
            if op.get("via"):
                edge["via"] = op["via"]
            edges.append(edge)
        elif kind == "remove_edge":
            a, b = op.get("from"), op.get("to")
            before = len(edges)
            d["edges"] = edges = [e for e in edges if not (e["from"] == a and e["to"] == b)]
            if len(edges) == before:
                raise OpError(f"op {i}: flow {a} → {b} does not exist")
    errs = validate(d)
    if errs:
        raise OpError("Result is not a valid design: " + "; ".join(errs[:3]))
    return d


# ---------- rules (subset; full engine in nexus-governance, WP1) ----------
EDGE_ENTRY = {"waf", "cdn"}
INSTANCE_TYPES = {"svc", "vm", "api", "adp"}


def check(design: dict) -> list[dict]:
    nodes, edges = design.get("nodes", {}), [e for e in design.get("edges", []) if e.get("kind") != "dep"]
    out = []

    def f(rule, sev, node, msg):
        out.append({"rule": rule, "severity": sev, "node": node, "message": msg})

    for e in edges:
        a, b = nodes.get(e["from"]), nodes.get(e["to"])
        if not a or not b:
            continue
        if a["type"] == "user" and b["type"] not in EDGE_ENTRY:
            f("GT3", "high", b["id"], f"Internet users reach {b['id']} ({b['name']}) without a WAF or CDN in front.")
        if a["type"] == "gw" and b["type"] == "db":
            f("TC-CONNECT", "block", b["id"], f"{a['id']} → {b['id']}: an API gateway cannot call a database; route through a service.")
        if (e.get("proto") or "").upper() == "HTTP":
            f("GT1", "medium", e["to"], f"{e['from']} → {e['to']} uses plain HTTP; TLS 1.2+ is required on every flow.")
    for n in nodes.values():
        if n["type"] in INSTANCE_TYPES and int(n.get("rep") or 1) < 2 and n.get("parent") in (None, "root"):
            f("P2", "medium", n["id"], f"{n['id']} ({n['name']}) runs one instance; run 2+ across zones.")
    for db in (n for n in nodes.values() if n["type"] == "db"):
        writers = {e["from"] for e in edges if e["to"] == db["id"] and nodes.get(e["from"], {}).get("type") in INSTANCE_TYPES}
        if len(writers) > 1:
            f("P8", "medium", db["id"], f"{db['id']} is shared by {', '.join(sorted(writers))}; each service should own its data.")
    return out


def summary(design: dict, limit: int = 60) -> dict:
    nodes = list(design.get("nodes", {}).values())
    return {
        "project": design.get("project"),
        "provider": design.get("deploy"),
        "components": [{k: n.get(k) for k in ("id", "type", "name", "parent", "rep") if n.get(k) is not None} for n in nodes[:limit]],
        "flows": [f"{e['from']}->{e['to']}" + (f" ({e.get('proto')})" if e.get("proto") else "") for e in design.get("edges", [])[: limit * 2]],
        "counts": {"components": len(nodes), "flows": len(design.get("edges", []))},
        "principles": [p["id"] + ": " + p["t"][:120] for p in design.get("ea", [])],
        "ground_truth": [g["id"] + ": " + g["t"] for g in design.get("gt", [])],
    }
