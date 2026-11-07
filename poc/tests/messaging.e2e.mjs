// Browser check: queues, streams, notification topics and event buses with channels, producers and consumers.
// Run: node poc/tests/messaging.e2e.mjs
import { open, newDesign, ok, summary, consoleText } from "./lib.mjs";
const { b, p } = await open();
await newDesign(p);
const run = async (t) => { await p.evaluate((t) => __nx.run(t), t); await p.waitForTimeout(150); if (await p.isVisible("#guard")) { if (await p.isHidden("#gApply")) { await p.click("#gCancel"); return; } if (await p.isDisabled("#gApply")) await p.fill("#gJust", "Automated messaging test design."); await p.click("#gApply"); await p.waitForTimeout(200); } };
const st = () => p.evaluate(() => ({ nodes: __nx.S.nodes, edges: __nx.S.edges.filter((e) => !e.kind || e.kind === "flow").map(({ _pts, _rpts, _wsep, _g, _drawn, _acc, _racc, ...e }) => e), f: __nx.findings.map((x) => ({ key: x.key, title: x.title, target: x.target, fix: x.fix, basis: x.basis })) }));
// Kafka (the new design's event bus is MSK). With SP-Kafka on (the default) its rules replace the legacy msg.* ones for topics.
let s = await st(); ok(s.nodes.Q1 && s.nodes.Q1.flavor === "kafka", "the new design has a Kafka cluster (Q1)");
await run("add topic orders to Q1 partitions 12 key orderId ordered");
s = await st(); ok(s.nodes.Q1.channels && s.nodes.Q1.channels.some((c) => c.id === "orders" && c.partitions === 12 && c.ordered), "add topic: orders with 12 partitions, ordering required");
await run("publish SVC1 to Q1/orders event \"OrderPlaced v1\"");
await run("subscribe SVC2 to Q1/orders group billing");
s = await st();
const pub = s.edges.find((e) => e.from === "SVC1" && e.to === "Q1"), sub = s.edges.find((e) => e.from === "Q1" && e.to === "SVC2");
ok(pub && pub.ch === "orders" && pub.event === "OrderPlaced v1", "publish: SVC1 → Q1/orders with its event");
ok(sub && sub.ch === "orders" && sub.group === "billing", "subscribe: SVC2 reads Q1/orders in group billing");
ok(s.f.some((f) => /msg\.order-without-key|kafka\.ordering-key/.test(f.key)), "rule: ordering required but SVC1 sends no key");
ok(s.f.some((f) => /msg\.no-idempotency|kafka\.consumer-idempotency/.test(f.key) && f.target === "SVC2"), "rule: at-least-once delivery without idempotent processing (SVC2)");
ok(s.f.some((f) => /msg\.no-outbox|kafka\.outbox/.test(f.key) && f.target === "SVC1"), "rule: SVC1 writes its database and publishes without an outbox");
await run("publish SVC1 to Q1/orders key orderId outbox");
s = await st(); ok(!s.f.some((f) => /msg\.order-without-key|msg\.no-outbox|kafka\.ordering-key|kafka\.outbox/.test(f.key)), "with a key and an outbox both findings clear");
// apply a fix from the Advisor: idempotent processing
const fi = await p.evaluate(() => __nx.findings.findIndex((f) => /msg\.no-idempotency|kafka\.consumer-idempotency/.test(f.key)));
await p.evaluate((i) => document.querySelector(`[data-fix="${i}"]`)?.click(), fi); await p.waitForTimeout(200); if (await p.isVisible("#guard")) await p.click("#gApply"); await p.waitForTimeout(200);
s = await st(); ok(s.edges.find((e) => e.from === "Q1" && e.to === "SVC2").idem === true, "the Advisor fix sets idempotent processing on the connection");
// replication factor rule and fix on the channel
await p.evaluate(() => { const q = __nx.S.nodes.Q1; q.channels = q.channels.map((c) => c.id === "orders" ? { ...c, rf: 2 } : c); }); await p.evaluate(() => __nx.refresh()); await p.waitForTimeout(100);
s = await st(); const rf = s.f.find((f) => /msg\.replication|kafka\.replication/.test(f.key));
ok(rf && /replication factor 2/.test(rf.title), "rule: replication factor below 3 (MSK best practice, cited)");
// notification topic (SNS) with fan-out
await run("add sns named \"Order events\"");
s = await st(); const nt = Object.values(s.nodes).find((n) => n.type === "notify");
ok(nt && nt.flavor === "topic", "a notification topic (Amazon SNS) is added: " + (nt && nt.id));
await run(`add topic orders to ${nt.id}`);
await run(`publish SVC1 to ${nt.id}/orders`);
await run(`subscribe SVC2 to ${nt.id}/orders protocol https`);
await run("add function named \"Mailer\""); s = await st(); const fn = Object.values(s.nodes).find((n) => n.type === "fn");
await run(`subscribe ${fn.id} to ${nt.id}/orders protocol lambda`);
s = await st();
const rates = await p.evaluate((id) => { const pk = __nx.packDesign(); return pk.msg[id].subs.map((s) => Math.round(s.rate)); }, nt.id);
const inRate = await p.evaluate((id) => Math.round(__nx.F[id].served), nt.id);
ok(rates.length >= 2 && rates.every((r) => Math.abs(r - inRate) <= 1), `fan-out: every subscription receives every message the topic accepts (${inRate}/s → ${rates.join(", ")}/s each)`);
const q300 = await p.evaluate((id) => __nx.findings.find((f) => f.key === "quota:" + id), nt.id);
ok(q300 && /300/.test(q300.why) && /Service Quotas/.test(q300.why), "SNS's default publish quota (300 messages/s in most Regions) is flagged, with how to raise it");
ok(s.f.some((f) => /msg\.no-filter/.test(f.key)), "rule: no filter policy, so every subscriber gets everything");
// FIFO topic cannot push to HTTPS or Lambda
await p.evaluate((id) => { const n = __nx.S.nodes[id]; n.channels = n.channels.map((c) => ({ ...c, fifo: true })); }, nt.id); await p.evaluate(() => __nx.refresh()); await p.waitForTimeout(100);
s = await st(); const ff = s.f.filter((f) => /msg\.fifo-protocol/.test(f.key));
ok(ff.length >= 1 && ff.every((f) => f.basis.includes("Technical constraint")), "rule: a FIFO topic delivers only to SQS (technical constraint)");
await p.evaluate((id) => { const n = __nx.S.nodes[id]; n.channels = n.channels.map((c) => ({ ...c, fifo: false })); }, nt.id); await p.evaluate(() => __nx.refresh()); await p.waitForTimeout(100);
// SNS → Lambda at high volume: insert a queue
await run("load 5000"); s = await st();
const ld = s.f.find((f) => /msg\.lambda-direct/.test(f.key));
ok(ld && ld.fix && ld.fix.insertQueue, "rule: SNS pushing straight to a function at volume; fix: insert a queue");
if (ld) { const i = await p.evaluate(() => __nx.findings.findIndex((f) => /msg\.lambda-direct/.test(f.key))); await p.evaluate((i) => document.querySelector(`[data-fix="${i}"]`)?.click(), i); await p.waitForTimeout(200); if (await p.isVisible("#guard")) { if (await p.isDisabled("#gApply")) await p.fill("#gJust", "Automated messaging test design."); await p.click("#gApply"); } await p.waitForTimeout(300);
  s = await st(); const q2 = Object.values(s.nodes).find((n) => n.type === "queue" && /buffer/.test(n.name));
  ok(q2 && s.edges.some((e) => e.from === nt.id && e.to === q2.id) && s.edges.some((e) => e.from === q2.id && e.to === fn.id), `the fix inserts ${q2 && q2.id}: ${nt.id} → queue → ${fn.id}`); }
await run("load 1000");
// competing consumers on an SQS queue share the work
await run("add queue named \"Work\""); s = await st(); const wq = Object.values(s.nodes).filter((n) => n.type === "queue" && n.flavor === "native").pop();
await run(`publish SVC1 to ${wq.id}`); await run(`subscribe SVC2 to ${wq.id}`); await run(`subscribe ${fn.id} to ${wq.id}`);
const share = await p.evaluate((id) => { const m = __nx.packDesign().msg[id]; return { in: Math.round(m.pubs.reduce((a, x) => a + x.rate, 0)), out: m.subs.map((x) => Math.round(x.rate)) }; }, wq.id);
ok(share.out.length === 2 && Math.abs(share.out[0] + share.out[1] - share.in) <= 2, `competing consumers share a queue (${share.in}/s → ${share.out.join(" + ")})`);
// Terraform
await p.evaluate(() => __nx.run("iac")); await p.waitForTimeout(200);
const tf = await p.evaluate(() => document.querySelector("#iacCode, #pIac pre, #iacOut")?.textContent || "");
ok(/resource "kafka_topic" "q1_orders"/.test(tf) && /partitions\s+= 12/.test(tf), "Terraform: kafka_topic orders with 12 partitions");
ok(/resource "aws_sns_topic_subscription"/.test(tf) && /resource "aws_sns_topic"/.test(tf), "Terraform: SNS topic and subscriptions");
ok(/resource "aws_sqs_queue" "\w+_work_dlq"/.test(tf), "Terraform: SQS queue with its dead-letter queue");
// Inspector: select the consume connection
await b.close(); summary();
