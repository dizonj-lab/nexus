// Browser check: the Action Guard's second opinion on a new design streams, stops on time, and can be stopped.
// Needs: node poc/tests/mock-llm.mjs 18080  and  (cd poc && python3 -m http.server 18081)
// Run:   node poc/tests/second-opinion.e2e.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.NEXUS_URL || "http://localhost:18081/prototype/index.html";
const LLM = process.env.MOCK_LLM || "http://localhost:18080/v1";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on("pageerror", e => ok(false, "page error: " + e.message));
async function setModel(model, timeoutS) {
  await p.click("#modelsBtn"); await p.fill("#eBase", LLM); await p.fill("#eModel", model); await p.fill("#eTime", String(timeoutS));
  await p.click("#mClose");
}
async function newDesign() {
  await p.click("#ndBtn"); await p.fill('[data-ndf="services"]', "claims, policies, payments").catch(() => {});
  for (let i = 0; i < 4; i++) { const n = p.locator('#ndDlg [data-nd="next"]'); if (await n.count()) await n.click(); }
  await p.click('#ndDlg [data-nd="create"]'); await p.waitForSelector("#guard:not([hidden])");
}
async function ask() { const t = Date.now(); await p.click("#gSecond"); return t; }
await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.waitForTimeout(500);
// 1. streaming answer arrives, with token progress
await setModel("sim-stream", 60); await newDesign();
let t = await ask(); await p.waitForFunction(() => /tokens/.test(document.querySelector("#o2Body").textContent), null, { timeout: 5000 });
ok(true, "progress shows tokens while the model writes");
await p.waitForSelector("#o2Body .pill", { timeout: 20000 }); const s1 = (Date.now() - t) / 1000;
ok(s1 < 10, `streamed opinion arrived in ${s1.toFixed(1)} s`);
ok(await p.isVisible("#gApply2"), "opinion 2 (amendment) can be implemented");
await p.click("#gApply2"); await p.waitForTimeout(400);
ok(/amended by the second opinion/.test(await p.textContent("#conOut")), "implementing opinion 2 builds the design and applies the amendment");
// 2. runaway whitespace: stops as soon as the JSON is complete
await setModel("sim-runaway", 60); await newDesign(); t = await ask();
await p.waitForSelector("#o2Body .pill", { timeout: 20000 }); const s2 = (Date.now() - t) / 1000;
ok(s2 < 10, `runaway model stopped once the answer was complete (${s2.toFixed(1)} s)`);
await p.click("#gCancel");
// 3. hanging model: Stop works and opinion 1 stays usable
await setModel("sim-hang", 15); await newDesign(); t = await ask();
await p.waitForTimeout(1500); ok(await p.isVisible("#gSecondStop"), "Stop button is shown while waiting");
await p.click("#gSecondStop"); await p.waitForFunction(() => /cancelled/.test(document.querySelector("#o2Body").textContent), null, { timeout: 3000 });
ok(await p.isVisible("#gApply"), "after Stop, opinion 1 can still be implemented");
// 4. hanging model: the time limit ends the wait
await p.click("#gSecond"); t = Date.now();
await p.waitForFunction(() => /within 15 s/.test(document.querySelector("#o2Body").textContent), null, { timeout: 25000 });
ok(Math.abs((Date.now() - t) / 1000 - 15) < 4, "time limit (15 s) ends the wait with a clear message");
// 5. the page stays responsive while waiting
await p.click("#gSecond"); const r0 = Date.now(); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
ok(Date.now() - r0 < 500, "page keeps painting while the model is busy");
await p.click("#gSecondStop"); await p.click("#gCancel");
await b.close(); console.log(process.exitCode ? "\nsome checks failed" : "\nall checks passed");
