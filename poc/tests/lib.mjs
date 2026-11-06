// Shared helpers for the browser checks. Serve the prototype first:  node poc/tests/serve.mjs 18081
import { createRequire } from "node:module";
export const { chromium } = createRequire(import.meta.url)("playwright");
export const BASE = process.env.NEXUS_URL || "http://localhost:18081/prototype/index.html";
let fails = 0;
export const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) { fails++; process.exitCode = 1; } };
export const summary = () => console.log(fails ? `\n${fails} check(s) failed` : "\nall checks passed");
export async function open(viewport = { width: 1440, height: 900 }) {
  const b = await chromium.launch(), p = await b.newPage({ viewport });
  p.on("pageerror", (e) => ok(false, "page error: " + e.message));
  await p.goto(BASE + "?test"); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  return { b, p };
}
// New design through the wizard; options: {services, avail, res}
export async function newDesign(p, o = {}) {
  await p.click("#ndBtn"); await p.fill('[data-ndf="services"]', o.services || "claims, policies");
  if (o.rps) await p.fill('[data-ndf="rps"]', String(o.rps));
  for (let i = 0; i < 4; i++) {
    if (i === 1 && o.res) await p.click(`#ndDlg [data-nd="res"][data-k="${o.res}"]`);
    const n = p.locator('#ndDlg [data-nd="next"]'); if (await n.count()) await n.click();
  }
  await p.click('#ndDlg [data-nd="create"]'); await afterCreate(p);
}
// After Create design: answer the unsaved-changes prompt (discard), then implement in the Action Guard.
export async function afterCreate(p, unsaved = "discard") {
  await p.waitForSelector("#unsDlg:not([hidden]), #guard:not([hidden])");
  if (await p.isVisible("#unsDlg")) { await p.click(unsaved === "save" ? "#unsSave" : "#unsDiscard"); await p.waitForSelector("#guard:not([hidden])"); }
  if (await p.isDisabled("#gApply") && await p.isVisible("#gJust")) await p.fill("#gJust", "Automated test design for load and quota checks.");
  await p.click("#gApply"); await p.waitForTimeout(500);
}
export const canvasBox = (p) => p.locator("canvas").first().boundingBox();
export const nodePos = (p, id) => p.evaluate((id) => { const n = __nx.S.nodes[id]; return __nx.P(n.x, n.y); }, id);
export const boxOf = (p, z) => p.evaluate((z) => { const b = __nx.zoneHits().find((h) => h.z === z); return b && { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }; }, z);
// Drag a component to a screen point; returns what the canvas showed just before the drop.
export async function dragTo(p, id, tx, ty, shot) {
  const cv = await canvasBox(p), a = await nodePos(p, id);
  await p.mouse.move(cv.x + a.x, cv.y + a.y); await p.mouse.down();
  for (let i = 1; i <= 14; i++) { await p.mouse.move(cv.x + a.x + (tx - a.x) * i / 14, cv.y + a.y + (ty - a.y) * i / 14); await p.waitForTimeout(16); }
  await p.waitForTimeout(120);
  const d = await p.evaluate(() => __nx.V.drop && { kind: __nx.V.drop.kind, target: __nx.V.drop.target, fit: __nx.V.drop.r.fit, why: __nx.V.drop.r.why });
  if (shot) await p.screenshot({ path: shot });
  await p.mouse.up(); await p.waitForTimeout(300);
  return d;
}
export const consoleText = (p) => p.textContent("#conOut");
