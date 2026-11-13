// Browser check: SP-Aurora (preview). An Aurora cluster behaves like Aurora: writer and readers in zones with promotion tiers,
// cluster and reader endpoints per connection, writes only on the writer, replica lag that grows with writes, failover by tier
// in a zone outage, reader Auto Scaling, Terraform. Run: node poc/tests/sp-aurora.e2e.mjs
import { open, newDesign, ok, summary } from "./lib.mjs";
const { b, p } = await open({ width: 1500, height: 1000 });
await newDesign(p, { services: "orders, payments" });
const apply = async () => { await p.waitForTimeout(150); if (await p.isVisible("#guard")) { if (await p.isDisabled("#gApply") && await p.isVisible("#gJust")) await p.fill("#gJust", "Test: Aurora scenario."); if (await p.isEnabled("#gApply")) await p.click("#gApply"); else { console.log("GUARD", (await p.evaluate(() => document.querySelector("#guard").innerText)).replace(/\s+/g, " ").slice(0, 900)); await p.click("#gCancel"); } await p.waitForTimeout(200); } };
const run = async (t) => { await p.evaluate((t) => __nx.run(t), t); await apply(); };
const A = () => p.evaluate(() => { const a = __nx.F.DB1.aur; return a && { readers: a.readers.map((r) => ({ az: r.az, tier: r.tier, util: r.util })), w: a.writer, toR: a.readsToReaders, onW: a.readsOnWriter, lag: a.lagMs, fail: a.fail, wanted: a.wanted }; });
const keys = () => p.evaluate(() => __nx.findings.map((f) => f.key));
const out = () => p.textContent("#conOut");

ok(await p.evaluate(() => __nx.spOn("sp.aurora")), "SP-Aurora is on by default (preview)");
await run("aurora DB1");

let a = await A();
ok(!!a && a.readers.length === 1 && a.readers[0].az !== a.w.az, `aurora DB1: a writer in zone ${a && a.w.az} and one reader in another zone (${a && a.readers[0].az})`);
ok(a.toR === 0 && a.readers[0].util === 0 && a.onW > 0, "through the cluster endpoint (the default) every read runs on the writer; the reader is idle");
ok((await keys()).some((k) => /^sp:aurora\.idle-readers:DB1/.test(k)), "aurora.idle-readers says so");
ok(!(await keys()).some((k) => k === "spof:DB1"), "the generic 'single point of failure' rule is replaced for Aurora");
const wBefore = a.w.util;
await run("endpoint SVC1 DB1 both");
a = await A();
ok(a.toR > 0 && a.readers[0].util > 0 && a.w.util < wBefore, `endpoint both: reads go to the reader (${Math.round(a.toR)}/s), the writer's load falls (${Math.round(wBefore * 100)}% → ${Math.round(a.w.util * 100)}%)`);
ok(!(await keys()).some((k) => /^sp:aurora\.idle-readers/.test(k)), "the idle-readers finding goes");
// replica lag grows with writes
const lag1 = a.lag; await run("what if load 4x"); a = await A();
ok(a.lag > lag1, `replica lag grows with the write load (${Math.round(lag1)} ms → ${Math.round(a.lag)} ms)`);
await run("what if load 1x");
// failover by promotion tier
await run("fail zone a"); a = await A();
ok(a.fail && /promoted/.test(a.fail.why) && a.w.az !== "a" && a.readers.length === 0, `zone a down: the reader is promoted to writer in zone ${a.w.az}`);
ok(await p.evaluate(() => __nx.F.DB1.util < Infinity), "the cluster keeps serving after the failover");
await run("restore zone");
await p.evaluate(() => { __nx.S.nodes.DB1.readReplicas = 0; __nx.refresh(); }); await p.waitForTimeout(150);
await run("fail zone a"); a = await A();
ok(a && a.fail && a.fail.down && (await p.evaluate(() => __nx.F.DB1.util === Infinity)), "with no reader, losing the writer's zone takes the cluster down");
ok((await keys()).some((k) => /^sp:aurora\.ha:DB1/.test(k)), "aurora.ha: no reader to fail over to");
await run("restore zone");
// with no readers, the reader endpoint reaches the writer
a = await A(); ok(a.toR === 0 && a.onW > 0, "with no readers, the reader endpoint connects to the writer");
// Auto Scaling
await p.evaluate(() => { const n = __nx.S.nodes.DB1; n.readReplicas = 1; n.aurAs = { on: true, min: 1, max: 6, target: 15 }; __nx.refresh(); }); await run("what if load 6x"); a = await A();

ok(a.readers.length > 1, `Auto Scaling adds readers under load (${a.readers.length} at 6× load, target 15% CPU)`);
await run("what if load 1x");
// panel and Terraform
await p.evaluate(() => __nx.inspect("DB1")); await p.waitForTimeout(300);
let t = await p.textContent("#spPanel");
ok(/Cluster endpoint/.test(t) && /Reader endpoint/.test(t) && /If the writer fails/.test(t), "Cluster tab: instances, endpoints, lag and the failover target");
await p.click('[data-spt="aurora|aconn"]'); await p.waitForTimeout(200);
ok(await p.isVisible('[data-aurep="SVC1"]'), "Connections tab: an endpoint choice per caller");
const tf = await p.evaluate(() => __nx.genTF());
ok(/"aws_rds_cluster"/.test(tf) && /promotion_tier\s+=/.test(tf) && /RDSReaderAverageCPUUtilization/.test(tf), "Terraform: aws_rds_cluster, instances with AZ and promotion tier, reader Auto Scaling");
// back to RDS
await p.evaluate(() => __nx.inspect("DB1")); await p.waitForTimeout(250);
await p.selectOption("#iEng", "rds"); await apply();
ok(await p.evaluate(() => !__nx.F.DB1.aur), "Engine → RDS for PostgreSQL turns the Aurora model off");
await b.close(); summary();
