// Service Pack rule tests: every SP rule has a design that must raise it and one that must not.
// Run: node --test packs/tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPacks } from "../build.mjs";
const NP = createRequire(import.meta.url)("../runtime.js");
NP.load({ packs: loadPacks() });

const svc = (id, o = {}) => ({ id, type: "svc", name: id, parent: "root", rep: 2, ...o });
const call = (from, to, o = {}) => ({ from, to, proto: "gRPC", ...o });
const D = (nodes, edges = [], o = {}) => ({ provider: "aws", zones: ["a", "b", "c"], req: o.req || null, nodes: Object.fromEntries(nodes.map((n) => [n.id, n])), edges, msg: o.msg || {}, sp: { on: { "sp.microservice": true, "sp.kafka": true, "sp.aurora": true }, policy: o.policy || {} }, aurora: o.aurora || {} });
const raised = (d, id) => NP.evaluateSP(d).filter((f) => f.id === id && !f.accepted);
// Kafka: one cluster Q1 with topics, publishers and subscribers
const topic = (id, o = {}) => ({ id, kind: "topic", partitions: 6, rf: 3, minIsr: 2, retentionH: 168, cleanup: "delete", ordered: false, msgKB: 1, ...o });
const sub = (to, ch, o = {}) => ({ to, toType: "svc", ch, group: to.toLowerCase(), ack: "after", idem: true, dlq: true, retries: 3, consumers: 2, rate: 100, procMs: 20, ...o });
const pub = (from, ch, o = {}) => ({ from, fromType: "svc", ch, key: "order_id", delivery: "idempotent", outbox: true, writesDb: false, rate: 100, ...o });
const cl = (o = {}) => ({ size: "kafka.m5.large", storageGiB: 1000, auth: "iam", tls: true, unclean: false, autoCreate: false, offsetRetH: 168, zones: 3, ...o });
const K = (o = {}, req = null, policy) => D([svc("P1"), svc("C1"), { id: "Q1", type: "queue", flavor: "kafka", parent: "root" }], [], { req, policy,
  msg: { Q1: { id: "Q1", kind: "topic", flavor: "kafka", brokers: o.brokers ?? 3, cluster: cl(o.cluster), channels: o.channels || [topic("orders")], pubs: o.pubs || [pub("P1", "orders")], subs: o.subs || [sub("C1", "orders")] } } });

// Aurora: the canvas computes the cluster state; these build it directly
const rd = (i, az, o = {}) => ({ name: `DB1-reader-${i}`, az, tier: 1, i, util: 0.2, ...o });
const AS = (o = {}) => { const readers = o.readers ?? [rd(1, "b")]; const target = o.target !== undefined ? o.target : [...readers].sort((a, b) => a.tier - b.tier)[0] || null;
  return D([svc("A"), { id: "DB1", type: "db", parent: "root" }], [{ from: "A", to: "DB1" }], { aurora: { DB1: { id: "DB1", secondary: false, writer: { name: "DB1-writer", az: "a", util: 0.4, wUtil: 0.2 }, readers, reads: 800, readsToReaders: 600, readsOnWriter: 200, writes: 200, lagMs: 25, target, as: { on: false, min: 1, max: 4, target: 60 }, wanted: readers.length, ...o, readers } } }); };
const CASES = [
  ["ms.call-loop", D([svc("A"), svc("B")], [call("A", "B"), call("B", "A")]), D([svc("A"), svc("B")], [call("A", "B")])],
  ["ms.sync-chain", D([svc("A"), svc("B"), svc("C"), svc("E")], [call("A", "B"), call("B", "C"), call("C", "E")]), D([svc("A"), svc("B"), svc("C")], [call("A", "B"), call("B", "C")])],
  ["ms.deadline-order", D([svc("A"), svc("B"), svc("C")], [call("A", "B", { deadline: 500 }), call("B", "C", { deadline: 800 })]), D([svc("A"), svc("B"), svc("C")], [call("A", "B", { deadline: 800 }), call("B", "C", { deadline: 300 })])],
  ["ms.no-deadline", D([svc("A"), svc("B")], [call("A", "B", { deadline: 0 })]), D([svc("A"), svc("B")], [call("A", "B")])],
  ["ms.retry-unsafe", D([svc("A"), svc("B")], [call("A", "B", { op: "write", retries: 2 })]), D([svc("A"), svc("B")], [call("A", "B", { op: "write", retries: 2, idem: true })])],
  ["ms.retry-amplification", D([svc("A"), svc("B"), svc("C")], [call("A", "B", { retries: 2 }), call("B", "C", { retries: 2 })]), D([svc("A"), svc("B"), svc("C")], [call("A", "B", { retries: 2 }), call("B", "C", { retries: 0 })])],
  ["ms.shared-db", D([svc("A"), svc("B"), { id: "DB1", type: "db", parent: "root" }], [{ from: "A", to: "DB1" }, { from: "B", to: "DB1" }]), D([svc("A"), { id: "DB1", type: "db", parent: "root" }], [{ from: "A", to: "DB1" }])],
  ["ms.min-copies", D([svc("A", { rep: 1 })]), D([svc("A", { auto: { min: 2, max: 6 } })])],
  ["ms.stateful-scale", D([svc("A", { stateless: false, rep: 3 })]), D([svc("A", { stateless: false, rep: 1 })])],
  ["ms.singleton-work", D([svc("A", { jobs: "in-process", rep: 3 })]), D([svc("A", { jobs: "scheduler", rep: 3 })])],
  ["ms.contract", D([svc("A"), svc("B")], [call("A", "B", { contract: "" })]), D([svc("A"), svc("B")], [call("A", "B", { contract: "b.v1.proto" })])],
  ["ms.grpc-edge", D([{ id: "U1", type: "user" }, svc("A")], [{ from: "U1", to: "A", proto: "gRPC" }]), D([{ id: "U1", type: "user" }, svc("A")], [{ from: "U1", to: "A", proto: "HTTPS" }])],
  ["ms.slo-chain", D([svc("A"), svc("B"), svc("C")], [call("A", "B"), call("A", "C")]), D([svc("A"), svc("B"), svc("C", { slo: { avail: 99.99 } })], [call("A", "B")])],
  ["kafka.zones", K({ brokers: 4 }), K({ brokers: 6 })],
  ["kafka.replication", K({ channels: [topic("orders", { rf: 2, minIsr: 1 })] }), K()],
  ["kafka.unclean-election", K({ cluster: { unclean: true } }), K()],
  ["kafka.partitions-per-broker", K({ channels: [topic("orders", { partitions: 600 })] }), K()],
  ["kafka.broker-ceiling", K({ pubs: [pub("P1", "orders", { rate: 20000 })], channels: [topic("orders", { msgKB: 4 })] }, null, { "sp.kafka": { brokerMBps: { "kafka.m5.large": 50 } } }), K({ pubs: [pub("P1", "orders", { rate: 20000 })], channels: [topic("orders", { msgKB: 4 })] })],
  ["kafka.storage", K({ pubs: [pub("P1", "orders", { rate: 5000 })], channels: [topic("orders", { msgKB: 2 })] }), K()],
  ["kafka.retention-outage", K({ channels: [topic("orders", { retentionH: 6 })] }), K()],
  ["kafka.offset-retention", K({ cluster: { offsetRetH: 12 } }), K()],
  ["kafka.lag-rto", K({ subs: [sub("C1", "orders", { rate: 400, consumers: 1, procMs: 2 })] }, { rto: 0.1 }), K({ subs: [sub("C1", "orders", { consumers: 4 })] }, { rto: 1 })],
  ["kafka.producer-durability", K({ pubs: [pub("P1", "orders", { delivery: "acks1" })] }), K()],
  ["kafka.consumer-idempotency", K({ subs: [sub("C1", "orders", { idem: false })] }), K()],
  ["kafka.dead-letter", K({ subs: [sub("C1", "orders", { dlq: false })] }), K()],
  ["kafka.dlq-retention", K({ subs: [sub("C1", "orders", { dlqRetH: 24 })] }), K()],
  ["kafka.dlq-ordering", K({ channels: [topic("orders", { ordered: true })], subs: [sub("C1", "orders", { onFail: "skip" })] }), K({ channels: [topic("orders", { ordered: true })] })],
  ["kafka.ordering-key", K({ channels: [topic("orders", { ordered: true })], pubs: [pub("P1", "orders", { key: "" })] }), K({ channels: [topic("orders", { ordered: true })] })],
  ["kafka.idle-consumers", K({ subs: [sub("C1", "orders", { consumers: 8 })] }), K()],
  ["kafka.hot-partition", K({ channels: [topic("orders", { hotKey: 40 })] }), K({ channels: [topic("orders", { hotKey: 20 })] })],
  ["kafka.auth-encryption", K({ cluster: { auth: "none" } }), K()],
  ["kafka.auto-create", K({ cluster: { autoCreate: true } }), K()],
  ["kafka.pii-retention", K({ channels: [topic("customers", { pii: true, retentionH: 2000 })], pubs: [pub("P1", "customers")], subs: [sub("C1", "customers")] }), K({ channels: [topic("customers", { pii: true, retentionH: 168 })], pubs: [pub("P1", "customers")], subs: [sub("C1", "customers")] })],
  ["kafka.outbox", K({ pubs: [pub("P1", "orders", { writesDb: true, outbox: false })] }), K({ pubs: [pub("P1", "orders", { writesDb: true, outbox: true })] })],
  ["aurora.ha", AS({ readers: [] }), AS()],
  ["aurora.target-zone", AS({ readers: [rd(1, "a", { tier: 0 }), rd(2, "b")] }), AS({ readers: [rd(1, "b", { tier: 0 }), rd(2, "a")] })],
  ["aurora.idle-readers", AS({ readsToReaders: 0 }), AS()],
  ["aurora.lag", AS({ lagMs: 180 }), AS({ lagMs: 30 })],
  ["aurora.max-readers", AS({ wanted: 18 }), AS()],
  ["aurora.as-secondary", AS({ secondary: true, as: { on: true, min: 1, max: 4, target: 60 } }), AS({ secondary: true })],
  ["aurora.writer-hot", AS({ writer: { name: "DB1-writer", az: "a", util: 0.9, wUtil: 0.8 } }), AS()],
];
test("every SP rule has a must-raise and a must-not case", () => {
  const ids = NP.sps().flatMap((p) => p.rules.map((r) => r.id)).sort();
  assert.deepEqual(CASES.map((c) => c[0]).sort(), ids);
});
for (const [id, bad, good] of CASES) {
  test(`${id}: raised on the bad design`, () => assert.ok(raised(bad, id).length > 0, `${id} not raised`));
  test(`${id}: not raised on the good design`, () => assert.deepEqual(raised(good, id).map((f) => f.title), []));
}
test("a starter-like design raises no SP finding", () => {
  const d = D([svc("A"), svc("B"), { id: "DB1", type: "db", parent: "root" }, { id: "DB2", type: "db", parent: "root" }, { id: "Q1", type: "queue", flavor: "kafka", parent: "root" }],
    [call("A", "B"), { from: "A", to: "DB1" }, { from: "B", to: "DB2" }],
    { msg: { Q1: { id: "Q1", kind: "topic", flavor: "kafka", brokers: 3, cluster: cl(), channels: [topic("orders")], pubs: [pub("A", "orders", { writesDb: true })], subs: [sub("B", "orders")] } } });
  assert.deepEqual(NP.evaluateSP(d).map((f) => f.id), []);
});
test("an accepted finding is kept but marked accepted", () => {
  const d = D([svc("A"), svc("B"), svc("C"), svc("E")], [call("A", "B"), call("B", "C"), call("C", "E")]);
  d.nodes.B.spEx = { "ms.sync-chain|A>B>C>E": { reason: "Payment needs an answer at the till", by: "Architect" } };
  const f = NP.evaluateSP(d).find((x) => x.id === "ms.sync-chain");
  assert.equal(f.accepted.reason, "Payment needs an answer at the till");
});
test("SP off: no SP findings", () => {
  const d = D([svc("A"), svc("B")], [call("A", "B"), call("B", "A")]); d.sp.on = {};
  assert.equal(NP.evaluateSP(d).length, 0);
});
test("SP-Kafka on: the legacy messaging rules it replaces stay quiet for topics", () => {
  const d = K({ channels: [topic("orders", { rf: 2, minIsr: 1 })] });
  assert.equal(NP.evaluateMessaging(d).filter((f) => f.id === "msg.replication").length, 0);
  d.sp.on = {}; assert.ok(NP.evaluateMessaging(d).some((f) => f.id === "msg.replication"));
});
test("load per broker counts replication and every group's reads; DLQ partitions count", () => {
  const d = K({ pubs: [pub("P1", "orders", { rate: 1024 })], channels: [topic("orders", { msgKB: 1, partitions: 6 })] });
  const L = NP.kafkaLoad(d.msg.Q1);
  assert.equal(L.inMB.toFixed(2), (1 * 3 / 3).toFixed(2)); // 1 MB/s × RF 3 over 3 brokers
  assert.equal(L.parts, (6 * 3 + 6 * 3) / 3); // topic + its DLQ
  assert.equal(NP.dlqName("orders", "loyalty"), "orders.loyalty.dlq");
});
test("partition facts by broker size match the MSK best-practices table", () => {
  const p = NP.sp("sp.kafka"), f = (id) => p.facts.find((x) => x.id === id).default;
  assert.deepEqual([f("partitions_t3_small"), f("partitions_m5_large"), f("partitions_max_m5_large"), f("partitions_m7g_2xlarge"), f("partitions_max_m5_24xlarge")], [300, 1000, 1500, 2000, 6000]);
});
