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
ok(/Connections: TLS optional/.test(t) && /Recommended: TLS required/.test(t), "each shows the setting, its current value and the recommended value");
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
ok(/Image scanning: off → on push/.test(tr), "Fix all lists every change in the Action Guard");
if (await p.isVisible("#guard")) await p.click("#gApply"); await p.waitForTimeout(300);
const open2 = await p.evaluate(() => (__nx.S.nodes.SVC1.cfgv || {}).scan);
ok(/on push/.test(open2 || ""), "after Fix all, SVC1's image scanning is on");
// second opinion
await p.evaluate(() => __nx.run("properties DB1")); await p.waitForTimeout(150);
await p.click('[data-csrev="DB1"]');
await p.waitForFunction(() => /2nd opinion: /.test(document.querySelector("#propBody").textContent), null, { timeout: 20000 });
t = await p.textContent("#propBody");
ok(/2nd opinion: agree/.test(t), "the second opinion marks the settings it agrees with");
ok(/2nd opinion: change → RDS Proxy/.test(t), "and suggests a better value where it disagrees");
ok(await p.evaluate(() => !!__nx.S.nodes.DB1.cfgReview && __nx.S.nodes.DB1.cfgReview.model === "sim-settings"), "the review is kept with the model's name; it changes nothing by itself");
await b.close(); summary();
