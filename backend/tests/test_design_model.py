"""The design schema accepts what the canvas produces today."""
from app import design as dm


def test_multi_region_ai_design_is_valid():
    d = dm.sample_design()
    d["nodes"]["DNS1"] = {"id": "DNS1", "type": "dns", "name": "DNS traffic steering", "parent": "root", "policy": "failover"}
    d["nodes"]["GENAI1"] = {"id": "GENAI1", "type": "llm", "name": "Generative AI", "parent": "root",
                            "prov": {"_new": {"by": "ai", "model": "qwen2.5:7b-instruct", "conf": 0.7}}}
    d["nodes"]["ML1"] = {"id": "ML1", "type": "ml", "name": "ML platform", "parent": "root"}
    d["nodes"]["DB1B"] = {"id": "DB1B", "type": "db", "name": "Orders DB · B", "parent": "root", "region": "B", "twin": "DB1"}
    d["edges"] += [{"from": "DB1", "to": "DB1B", "kind": "repl", "proto": "sync", "via": "xregion"},
                   {"from": "SVC1", "to": "GENAI1", "proto": "HTTPS", "via": "privatelink"}]
    d["req"] = {"avail": "99.99", "rto": 240, "rpo": 30, "res": "ap"}
    assert dm.validate(d) == []


def test_unknown_type_is_still_rejected():
    d = dm.sample_design()
    d["nodes"]["X1"] = {"id": "X1", "type": "teleporter", "name": "X", "parent": "root"}
    assert any("X1" in e for e in dm.validate(d))
