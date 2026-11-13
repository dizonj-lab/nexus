// Browser check: SP-Kafka (preview). The MSK cluster as a block with topics and consumer groups as children,
// a dead-letter topic per group by default, cluster settings with their limits, the pack's rules and fixes,
// Terraform with NEXUS's broker configuration, and turning the pack off (legacy checks return).
// Run: node poc/tests/sp-kafka.e2e.mjs
import { open, newDesign, ok, summary } from "./lib.mjs";
const { b, p } = await open({ width: 1440, height: 1000 });
await newDesign(p, { services: "orders, payments" });
const apply = async () => { await p.waitForTimeout(150); if (await p.isVisible("#guard")) { if (await p.isDisabled("#gApply") && await p.isVisible("#gJust")) await p.fill("#gJust", "Test: service pack scenario."); await p.click("#gApply"); await p.waitForTimeout(200); } };
const run = async (t) => { await p.evaluate((t) => __nx.run(t), t); await apply(); };
const keys = () => p.evaluate(() => __nx.findings.map((f) => f.key));
const q = () => p.evaluate(() => { const n = __nx.S.nodes.Q1; return { ...__nx.kafkaOf(n), brokers: n.brokers, channels: n.channels }; });
const fixBy = async (re) => { const i = await p.evaluate((src) => __nx.findings.findIndex((f) => new RegExp(src).test(f.key)), re); if (i < 0) return false; await p.evaluate(() => document.querySelector('#pAdv .tabs button[data-t="find"]')?.click()); await p.waitForTimeout(150); await p.evaluate((i) => document.querySelector(`[data-fix="${i}"]`)?.click(), i); await apply(); return true; };
const tab = async (t) => { await p.evaluate(() => __nx.inspect("Q1")); await p.waitForTimeout(250); await p.click(`[data-spt="kafka|${t}"]`); await p.waitForTimeout(150); return p.textContent("#spPanel"); };
const tf = () => p.evaluate(() => __nx.genTF());

ok(await p.evaluate(() => __nx.spOn("sp.kafka")), "SP-Kafka is on by default (preview)");
let s = await q(); ok(s.brokers === 3, `the new MSK cluster gets 3 brokers over Singapore's 3 zones (a multiple of the zones): ${s.brokers}`);
// the rest of this check uses a two-zone design, as an architect may choose
await p.evaluate(() => { const S = __nx.S; S.settings.zones = 2; S.settings.zonesSet = true; S.nodes.Q1.brokers = 4; __nx.refresh(); }); await p.waitForTimeout(150); s = await q();
ok(!(await keys()).some((k) => /kafka\.zones|kafka\.auth|kafka\.unclean|kafka\.replication|kafka\.storage/.test(k)), "the starter cluster raises no cluster finding");
// cluster tab: per-broker table and limits
let t = await tab("cluster");
ok(/Partition replicas/.test(t) && /1000 recommended · 1500 for updates/.test(t), "Cluster tab: partition replicas per broker against the m5.large recommendation (1000) and update limit (1500)");
ok(/no throughput figure for Standard brokers/.test(t), "it says AWS publishes no per-broker throughput for Standard brokers");
await p.fill('[data-spn="storageGiB"]', "500"); await p.dispatchEvent('[data-spn="storageGiB"]', "change"); await p.waitForTimeout(200);
s = await q(); ok(s.storageGiB === 1000 && /never decreased/.test(await p.textContent("#conOut")), "storage cannot be reduced: refused with the reason");
await p.selectOption('[data-spn="auth"]', "none"); await apply();
ok((await keys()).some((k) => /^sp:kafka\.auth-encryption:Q1/.test(k)), "no client authentication: kafka.auth-encryption (critical)");
await fixBy("kafka\\.auth-encryption"); ok((await q()).auth === "iam", "the fix sets IAM access control");
await p.evaluate(() => { __nx.S.nodes.Q1.brokers = 3; __nx.refresh(); }); await p.waitForTimeout(150);
ok((await keys()).some((k) => /kafka\.zones/.test(k)), "3 brokers over 2 zones: kafka.zones");
await fixBy("kafka\\.zones"); ok((await q()).brokers === 4, "the fix uses the next multiple of the zones (4)");
// topics: children of the cluster, with their dead-letter topics
t = await tab("topics");
ok(/events\.svc2\.dlq/.test(t), "Topics tab: the group's dead-letter topic events.svc2.dlq is shown under its topic");
await p.fill('[data-spc="events|partitions"]', "900"); await p.dispatchEvent('[data-spc="events|partitions"]', "change"); await apply();
ok((await keys()).some((k) => /kafka\.partitions-per-broker/.test(k)), "900 partitions (+ their DLQ) over 4 brokers exceed the recommended 1000 replicas per broker");
await p.evaluate(() => { const n = __nx.S.nodes.Q1; n.channels = n.channels.map((c) => ({ ...c, partitions: 6, rf: 2, minIsr: 1 })); __nx.refresh(); }); await p.waitForTimeout(150);
ok((await keys()).some((k) => /^sp:kafka\.replication/.test(k)) && !(await keys()).some((k) => /msg\.replication/.test(k)), "replication 2: raised by SP-Kafka, not by the legacy rule");
await fixBy("kafka\\.replication"); s = await q(); ok(s.channels[0].rf === 3 && s.channels[0].minIsr === 2, "the fix sets replication 3, min in-sync 2 on the topic");
// groups: catch-up and the dead-letter default
t = await tab("groups"); ok(/svc2/.test(t) && /min after a 30-min stop|cannot keep up/.test(t), "Groups tab: each group with its consumers, failure handling and catch-up time");
await p.evaluate(() => { __nx.S.edges.find((e) => e.from === "Q1" && e.to === "SVC2").dlq = false; __nx.refresh(); }); await p.waitForTimeout(150);
ok((await keys()).some((k) => /kafka\.dead-letter/.test(k)), "removing the dead-letter topic raises kafka.dead-letter");
await fixBy("kafka\\.dead-letter"); ok(await p.evaluate(() => __nx.S.edges.find((e) => e.from === "Q1" && e.to === "SVC2").dlq === true), "the fix restores it");
// ordered topic: stop the partition, do not skip
await p.evaluate(() => { const n = __nx.S.nodes.Q1; n.channels = n.channels.map((c) => ({ ...c, ordered: true })); __nx.S.edges.find((e) => e.from === "Q1" && e.to === "SVC2").onFail = "skip"; __nx.refresh(); }); await p.waitForTimeout(150);
ok((await keys()).some((k) => /kafka\.dlq-ordering/.test(k)), "an ordered topic that skips failures to the DLQ: kafka.dlq-ordering");
await fixBy("kafka\\.dlq-ordering"); ok(await p.evaluate(() => __nx.S.edges.find((e) => e.from === "Q1" && e.to === "SVC2").onFail === "stop"), "the fix stops the partition and alerts");
// the consume connection's settings
await p.evaluate(() => { __nx.V.sel = null; __nx.V.selE = { from: "Q1", to: "SVC2" }; document.querySelector('#pAdv .tabs button[data-t="insp"]').click(); }); await p.waitForTimeout(250);
ok(await p.isVisible('[data-spcall="procMs"]') && /events\.svc2\.dlq/.test(await p.textContent("#advBody")), "the consume connection shows processing time, failure handling and its dead-letter topic");
// Terraform
let code = await tf();
ok(/resource "aws_msk_configuration"/.test(code) && /unclean\.leader\.election\.enable = false/.test(code) && /auto\.create\.topics\.enable = false/.test(code), "Terraform: an MSK configuration that turns off unclean leader election and automatic topic creation");
ok(/instance_type  = "kafka\.m5\.large"/.test(code) && /volume_size = 1000/.test(code) && /iam = true/.test(code), "Terraform: broker size, storage per broker and IAM access control from the block");
ok(/name               = "events\.svc2\.dlq"/.test(code) && /KafkaBrokerStorageUtilization/.test(code), "Terraform: the dead-letter topic and storage autoscaling");
// on the canvas: brokers, topics, DLQs
ok(await p.evaluate(() => __nx.kDlqs("Q1") === 1 && __nx.S.nodes.Q1.brokers === 4), "the block's tag counts 4 brokers, 1 topic, 1 dead-letter topic (4B 1T 1DLQ)");
// turning the pack off brings the legacy checks back
await p.evaluate(() => { const n = __nx.S.nodes.Q1; n.channels = n.channels.map((c) => ({ ...c, rf: 2, minIsr: 1 })); __nx.S.settings.sp["sp.kafka"] = false; __nx.refresh(); }); await p.waitForTimeout(150);
const k = await keys(); ok(!k.some((x) => /^sp:kafka/.test(x)) && k.some((x) => /msg\.replication/.test(x)), "pack off: SP-Kafka findings go, the legacy replication rule is back");
code = await tf(); ok(!/aws_msk_configuration/.test(code), "pack off: the legacy Terraform (no configuration resource)");
await b.close(); summary();
