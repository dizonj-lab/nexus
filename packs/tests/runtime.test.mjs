// Pack tests: run with  node --test packs/tests/*.test.mjs
// Each test is a small design that must (or must not) raise a finding, or must place a component a certain way.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { loadPacks, block } from "../build.mjs";
const NP = createRequire(import.meta.url)("../runtime.js");
NP.load({ packs: loadPacks() });

const base = (over = {}) => ({
  provider: "aws", zones: ["a", "b"], multiRegion: false, req: null, load: {}, managed: {}, ipsNeeded: {},
  nets: [
    { id: "NET1", name: "public", tier: "dmz", azs: ["a", "b"], cidrs: { a: "10.0.0.0/24", b: "10.0.1.0/24" }, region: "A" },
    { id: "NET2", name: "app", tier: "app", azs: ["a", "b"], cidrs: { a: "10.0.10.0/24", b: "10.0.11.0/24" }, region: "A" },
    { id: "NET3", name: "data", tier: "data", azs: ["a", "b"], cidrs: { a: "10.0.20.0/24", b: "10.0.21.0/24" }, region: "A" },
    { id: "NET4", name: "tiny", tier: "app", azs: ["a"], cidr: "10.0.30.0/28", region: "A" },
    { id: "NET9", name: "app-B", tier: "app", azs: ["a", "b"], cidrs: { a: "10.1.10.0/24" }, region: "B" },
  ],
  nodes: {
    U1: { id: "U1", type: "user", name: "Customers" },
    CDN1: { id: "CDN1", type: "cdn", name: "Edge" },
    LB1: { id: "LB1", type: "lb", name: "ALB", net: "NET1", region: "A" },
    SVC1: { id: "SVC1", type: "svc", name: "Claims", net: "NET2", region: "A" },
    DB1: { id: "DB1", type: "db", name: "Claims DB", net: "NET3", region: "A" },
    Q1: { id: "Q1", type: "queue", name: "Events", region: "A" },
    DNS1: { id: "DNS1", type: "dns", name: "Route 53", policy: "failover", health: true, ttl: 60 },
  },
  edges: [{ from: "U1", to: "DNS1" }, { from: "DNS1", to: "CDN1" }, { from: "CDN1", to: "LB1" }, { from: "LB1", to: "SVC1" }, { from: "SVC1", to: "DB1" }, { from: "SVC1", to: "Q1" }],
  ...over,
});

test("facts: CloudFront allows 250,000 rps per distribution by default, adjustable", () => {
  const q = NP.simQuota("cdn", "aws");
  assert.equal(q.rps, 250000);
  assert.equal(q.fact.adjustable, true);
  assert.match(q.fact.source, /^https:\/\/docs\.aws\.amazon\.com\//);
});
test("facts: Lambda concurrency 1,000 plans as 5,000 rps", () => assert.equal(NP.simQuota("fn", "aws").rps, 5000));
test("facts: every fact has a source and a check date", () => {
  for (const p of NP.bundle().packs) for (const f of p.facts || []) { assert.ok(f.source, `${p.id}.${f.id} source`); assert.match(f.checked, /^\d{4}-\d{2}-\d{2}$/); }
});
test("range: 20 read replicas is above the RDS quota of 15 (adjustable, so a warning)", () => {
  const d = base(); d.nodes.DB1.readReplicas = 20;
  const f = NP.evaluate(d).find((x) => x.id === "limit.aws.db.replicas");
  assert.equal(f.sev, "warn"); assert.match(f.why, /request an increase/);
});
test("range: 70,000 GiB is above the RDS hard limit (critical)", () => {
  const d = base(); d.nodes.DB1.sizeGB = 70000;
  assert.equal(NP.evaluate(d).find((x) => x.id === "limit.aws.db.storage").sev, "crit");
});
test("range: an API gateway rate limit of 12,000 needs a quota increase", () => {
  const d = base(); d.nodes.GW1 = { id: "GW1", type: "gw", name: "API", rateLimit: 12000 };
  assert.match(NP.evaluate(d).find((x) => x.id === "limit.aws.gw.rps").why, /Service Quotas/);
});
test("placement: a database in the isolated data subnet is the best fit", () => assert.equal(NP.placeSubnet(base(), "DB1", "NET3").fit, "best"));
test("placement: a database in a public subnet is allowed but poor, with the reason", () => {
  const r = NP.placeSubnet(base(), "DB1", "NET1");
  assert.equal(r.fit, "poor"); assert.ok(r.cons.some((c) => /public address/.test(c)));
});
test("placement: an internet-facing load balancer cannot go into a private subnet", () => {
  const r = NP.placeSubnet(base(), "LB1", "NET2");
  assert.equal(r.fit, "no"); assert.match(r.why, /internet gateway/);
});
test("placement: an internal load balancer can go into a private subnet", () => {
  const d = base(); d.edges = d.edges.filter((e) => e.to !== "LB1"); d.edges.push({ from: "SVC1", to: "LB1" });
  assert.equal(NP.placeSubnet(d, "LB1", "NET2").fit, "ok");
});
test("placement: a managed queue (SQS) cannot be put in a subnet", () => {
  const d = base(); d.managed.Q1 = true;
  const r = NP.placeSubnet(d, "Q1", "NET3"); assert.equal(r.fit, "no"); assert.match(r.why, /regional service outside your VPC/);
});
test("placement: a self-hosted queue (Kafka on VMs) can go in the data subnet", () => assert.equal(NP.placeSubnet(base(), "Q1", "NET3").fit, "best"));
test("placement: DNS and CDN never go in a subnet", () => {
  assert.equal(NP.placeSubnet(base(), "DNS1", "NET1").fit, "no"); assert.equal(NP.placeSubnet(base(), "CDN1", "NET1").fit, "no");
});
test("placement: a subnet in another region is refused", () => assert.match(NP.placeSubnet(base(), "SVC1", "NET9").why, /region B/));
test("placement: a /28 holds 11 addresses on AWS; 20 instances do not fit", () => {
  const d = base(); d.ipsNeeded = { SVC1: 20 };
  assert.equal(NP.usableIPs("10.0.30.0/28", "aws"), 11);
  const r = NP.placeSubnet(d, "SVC1", "NET4"); assert.equal(r.fit, "no"); assert.match(r.why, /11 usable addresses/);
});
test("zones: an ALB cannot be pinned to one zone; a service can, with trade-offs", () => {
  assert.equal(NP.placeZone(base(), "LB1", "a").fit, "no");
  const r = NP.placeZone(base(), "SVC1", "b"); assert.equal(r.fit, "ok"); assert.ok(r.cons.length);
});
test("zones: a regional managed service cannot be pinned", () => { const d = base(); d.managed.Q1 = true; assert.equal(NP.placeZone(d, "Q1", "a").fit, "no"); });
test("zones: no zone c in a two-zone region", () => assert.equal(NP.placeZone(base(), "SVC1", "c").fit, "no"));
test("regions: DNS is global and has no region", () => assert.equal(NP.placeRegion(base(), "DNS1", "B").fit, "no"));
test("dns: failover without health checks is critical", () => {
  const d = base({ multiRegion: true }); d.nodes.DNS1.health = false;
  assert.equal(NP.evaluate(d).find((f) => f.id === "dns.failover-without-health").sev, "crit");
});
test("dns: defaults (30 s × 3 + 60 s TTL = 150 s) are slower than a 60 s RTO; the fix gets to 40 s", () => {
  const d = base({ multiRegion: true, req: { rto: 1 } });
  const f = NP.evaluate(d).find((x) => x.id === "dns.failover-slower-than-rto");
  assert.equal(f.detail.failover_s, 150); assert.deepEqual(f.fix.set, { hcInterval: 10, ttl: 10 }); assert.match(f.why, /about 40 s/);
});
test("dns: a 4-hour RTO is met by the defaults", () => assert.ok(!NP.evaluate(base({ multiRegion: true, req: { rto: 240 } })).some((f) => f.id === "dns.failover-slower-than-rto")));
test("dns: probing a private endpoint is flagged", () => {
  const d = base(); d.nodes.DNS1.hcType = "probe"; d.edges.push({ from: "DNS1", to: "SVC1" });
  assert.ok(NP.evaluate(d).some((f) => f.id === "dns.probe-private-endpoint"));
});
test("think: a component knows its facts, senses its subnet and region", () => {
  const t = NP.think(base(), "LB1");
  assert.equal(t.senses.subnet.name, "public"); assert.equal(t.senses.internetFacing, true); assert.ok(t.knows.some((f) => f.id === "targets"));
});
test("build: the canvas carries the current packs (run node packs/build.mjs after editing a pack)", () => {
  const html = readFileSync(new URL("../../poc/prototype/index.html", import.meta.url), "utf8");
  assert.ok(html.includes(block()), "canvas is out of date");
});

// ---------- messaging ----------
const msgDesign = (over = {}) => ({ provider: "aws", nodes: { Q1: { id: "Q1", type: "queue", flavor: "kafka" }, NT1: { id: "NT1", type: "notify", flavor: "topic" } }, edges: [],
  msg: { Q1: { id: "Q1", kind: "topic", flavor: "kafka", region: "A", brokers: 3, channels: [{ id: "orders", partitions: 6, rf: 3, minIsr: 2, ordered: true }],
    pubs: [{ from: "SVC1", ch: "orders", key: "", delivery: "idempotent", outbox: false, writesDb: true }],
    subs: [{ to: "SVC2", toType: "svc", ch: "orders", group: "billing", ack: "after", idem: false, dlq: true, retries: 3, order: "per-key", consumers: 8, rate: 100 }] },
   NT1: { id: "NT1", kind: "notif", flavor: "topic", region: "A", channels: [{ id: "events", fifo: true }], pubs: [{ from: "SVC1", ch: "events" }],
    subs: [{ to: "FN1", toType: "fn", ch: "events", protocol: "lambda", ack: "after", idem: true, dlq: true, retries: 3, rate: 50, filter: "a=1, b=2, c=3, d=4, e=5, f=6" }] } }, ...over });
const ids = (d) => NP.evaluateMessaging(d).map((f) => f.id);
test("messaging: ordering required but no key", () => assert.ok(ids(msgDesign()).includes("msg.order-without-key")));
test("messaging: at-least-once without idempotency", () => assert.ok(ids(msgDesign()).includes("msg.no-idempotency")));
test("messaging: database write and publish without an outbox", () => assert.ok(ids(msgDesign()).includes("msg.no-outbox")));
test("messaging: 8 consumers in a group for 6 partitions leaves 2 idle", () => assert.match(NP.evaluateMessaging(msgDesign()).find((f) => f.id === "msg.idle-consumers").why, /2 consumer\(s\) sit idle/));
test("messaging: an SNS FIFO topic cannot push to a function (technical constraint, cited)", () => { const f = NP.evaluateMessaging(msgDesign()).find((x) => x.id === "msg.fifo-protocol"); assert.equal(f.hard, true); assert.match(f.facts[0].source, /fifo-message-delivery/); });
test("messaging: an SNS filter with more than 5 attributes cannot be created", () => assert.equal(NP.evaluateMessaging(msgDesign()).find((x) => x.id === "msg.filter-keys").hard, true));
test("messaging: replication factor 2 is flagged with the MSK best practice", () => { const d = msgDesign(); d.msg.Q1.channels[0].rf = 2; const f = NP.evaluateMessaging(d).find((x) => x.id === "msg.replication"); assert.ok(f.facts.some((x) => x.id === "rf")); assert.deepEqual(f.fix.chan.set, { rf: 3, minIsr: 2 }); });
test("messaging: SNS default publish quota is 300 messages/s (adjustable)", () => { const q = NP.simQuota("notify", "aws", "topic"); assert.equal(q.rps, 300); assert.equal(q.fact.adjustable, true); assert.equal(NP.simQuota("notify", "aws", "bus").rps, 400); });
// ---------- disruption ----------
test("disruption: RDS Multi-AZ resize is a 60–120 s failover; Single-AZ has no documented duration", () => {
  const m = NP.disruption("db", "aws", "vertical", null, "multiaz"), s = NP.disruption("db", "aws", "vertical", null, "single");
  assert.equal(m.min, 60); assert.equal(m.max, 120); assert.equal(s.max, null); assert.match(s.source, /ModifyDBInstance/); });
test("disruption: adding MSK brokers has no outage; changing the broker size up to 2 minutes of client errors", () => {
  assert.equal(NP.disruption("queue", "aws", "brokers", "kafka").max, 0); assert.equal(NP.disruption("queue", "aws", "vertical", "kafka").max, 120); });
test("disruption: Azure PostgreSQL flexible scales with about 10–30 s at the cut-over", () => { const f = NP.disruption("db", "azure", "vertical"); assert.equal(f.min, 10); assert.equal(f.max, 30); });
