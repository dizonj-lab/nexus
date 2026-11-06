// Browser check: critical settings show the setting, its value and the recommendation, have a Fix button,
// and can get a second opinion from the escalation model (simulated here).
// Run: node poc/tests/settings.e2e.mjs   (with mock-llm.mjs on :18080)
import { open, newDesign, ok, summary, consoleText } from "./lib.mjs";
const LLM = process.env.MOCK_LLM || "http://localhost:18080/v1";
const { b, p } = await open();
await p.click("#modelsBtn"); await p.fill("#eBase", LLM); await p.fill("#eModel", "sim-settings"); await p.fill("#eTime", "30"); await p.click("#mClose");
await newDesign(p);
const bp = await p.evaluate(() => { const f = __nx.findings.find((x) => x.key === "bp"); return f && { title: f.title, fix: f.fix }; });
ok(bp && bp.fix && bp.fix.k === "bpopen", "the Advisor finding about critical settings has a button: " + (bp && bp.title));
await p.evaluate(() => __nx.run("properties DB1")); await p.click('[data-ptab="crit"]'); await p.waitForTimeout(200);
let t = await p.textContent("#propBody");
ok(/Encrypted at rest with customer-managed keys/.test(t) || /TLS required for connections/.test(t), "the database lists its critical settings");
ok(/Connections: TLS optional/.test(t) && /Recommendation 1 · NEXUS rules\s*TLS required/.test(t), "each shows the setting, its current value and recommendation 1 (rules)");
ok(/Recommendation 2 · second opinion\s*Not asked yet/.test(t), "recommendation 2 waits for a second opinion");
ok(/Automated backups: 1 day \(API default; 7 in the console\)/.test(t), "defaults are the product's documented defaults (RDS backups)");
ok(await p.locator("#csPick").count() === 1, "a list switches to the other components with critical settings open");
// fix one
await p.click('[data-csfix="DB1"][data-k="tls"]'); await p.waitForTimeout(200);
if (await p.isVisible("#guard")) await p.click("#gApply"); await p.waitForTimeout(300);
t = await p.textContent("#propBody");
ok(/✓ TLS required for connections/.test(t), "Fix applies the recommendation and the item turns green");
ok(await p.evaluate(() => __nx.S.nodes.DB1.cfgv.tls === "TLS required"), "the value is stored on the component");
ok(await p.evaluate(() => __nx.S.nodes.DB1.prov.cfgv && __nx.S.nodes.DB1.prov.cfgv.by === "rules"), "its source is recorded: rules (Well-Architected recommendation)");
// a live setting: standby; fix all
await p.evaluate(() => __nx.run("properties SVC1")); await p.waitForTimeout(150);
await p.click('[data-csall="SVC1"]'); await p.waitForTimeout(200);
const tr = await p.textContent("#gTrade").catch(() => "");
ok(/Image scanning: off → on push/.test(tr), "Apply all 1 lists every change in the Action Guard");
if (await p.isVisible("#guard")) await p.click("#gApply"); await p.waitForTimeout(300);
const open2 = await p.evaluate(() => (__nx.S.nodes.SVC1.cfgv || {}).scan);
ok(/on push/.test(open2 || ""), "after Fix all, SVC1's image scanning is on");
// second opinion
await p.evaluate(() => __nx.run("properties DB1")); await p.waitForTimeout(150);
await p.click('[data-csrev="DB1"]');
await p.waitForFunction(() => /Recommendation 2 · sim-settings/.test(document.querySelector("#propBody").textContent), null, { timeout: 20000 });
t = await p.textContent("#propBody");
ok(await p.evaluate(() => !!__nx.S.nodes.DB1.cfgReview && __nx.S.nodes.DB1.cfgReview.model === "sim-settings"), "the review is kept with the model's name; it changes nothing by itself");
ok(/Recommendation 1 · NEXUS rules\s*proxy or PgBouncer/.test(t) && /Recommendation 2 · sim-settings\s*change RDS Proxy/.test(t), "pooling shows both: 1 = proxy or PgBouncer, 2 = RDS Proxy");
ok(/Recommendation 2 · sim-settings\s*agrees with 1/.test(t), "where the model agrees, recommendation 2 says so");
await p.click('[data-cs2="DB1"][data-k="pool"]'); await p.waitForTimeout(200);
ok(/RDS Proxy \(instead of|recommendation 1 was: proxy or PgBouncer/.test(await p.textContent("#gTrade")), "Apply 2 shows what it replaces in the Action Guard");
await p.click("#gApply"); await p.waitForTimeout(300);
const pool = await p.evaluate(() => ({ v: __nx.S.nodes.DB1.cfgv.pool, src: __nx.S.nodes.DB1.prov.cfgv, adr: __nx.S.adrs.at(-1).title }));
ok(pool.v === "RDS Proxy", "after Apply 2, DB1's connection pooling is RDS Proxy");
ok(pool.src && pool.src.by === "ai" && pool.src.model === "sim-settings", "its source is the model (AI), chosen by the architect");
ok(/chose recommendation 2 for Connection pooling/.test(pool.adr), "the choice is recorded as a decision: " + pool.adr);
ok(/✓ Connection pooling in front/.test(await p.textContent("#propBody")), "the item is shown as done");
await b.close(); summary();
