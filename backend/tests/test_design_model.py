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


def test_subnets_per_zone_and_pinned_zones_are_valid():
    d = dm.sample_design()
    d["nets"] = [{"id": "NET1", "name": "Private · application", "tier": "app", "std": True, "off": 10, "region": "A"},
                 {"id": "NET2", "name": "Isolated · data", "tier": "data", "azs": ["a", "b"],
                  "cidrs": {"a": "10.0.20.0/24", "b": "10.0.21.0/24"}, "region": "A"}]
    d["nodes"]["SVC1"].update({"net": "NET1", "az": "b"})
    d["nodes"]["DNS1"] = {"id": "DNS1", "type": "dns", "name": "Route 53", "parent": "root", "policy": "failover",
                          "health": True, "hcInterval": 10, "hcThreshold": 3, "ttl": 10, "hcType": "alarm"}
    d["settings"] = {**d.get("settings", {}), "view": {"azLayout": "side", "propPos": {"l": "100px", "t": "80px"}}}
    assert dm.validate(d) == []


def test_messaging_channels_and_connections_are_valid():
    d = dm.sample_design()
    d["nodes"]["NT1"] = {"id": "NT1", "type": "notify", "name": "Order events", "parent": "root", "flavor": "topic",
                         "channels": [{"id": "orders", "fifo": False}]}
    d["nodes"]["Q9"] = {"id": "Q9", "type": "queue", "name": "Stream", "parent": "root", "flavor": "kafka",
                        "channels": [{"id": "orders", "partitions": 12, "rf": 3, "minIsr": 2, "key": "orderId", "ordered": True}]}
    d["edges"] += [{"from": "SVC1", "to": "Q9", "proto": "Kafka/TLS", "via": "net", "ch": "orders", "key": "orderId", "outbox": True},
                   {"from": "Q9", "to": "SVC1", "proto": "Kafka/TLS", "via": "net", "ch": "orders", "group": "billing", "idem": True, "retries": 5},
                   {"from": "NT1", "to": "SVC1", "proto": "HTTPS", "via": "net", "ch": "orders", "protocol": "https", "filter": "type = order"}]
    d["nodes"]["SVC1"]["cfgReview"] = {"model": "x", "items": {}}
    assert dm.validate(d) == []
