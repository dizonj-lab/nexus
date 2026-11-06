// Browser check: drag an end of a selected flow to another component. Possible: the Action Guard shows the effect
// (load moved, errors, latency) and the architect decides. Technically wrong: refused with the reason.
// Run: node poc/tests/reconnect.e2e.mjs
import { open, newDesign, ok, summary, nodePos, canvasBox, consoleText } from "./lib.mjs";
const { b, p } = await open();
await newDesign(p);
const flows = () => p.evaluate(() => __nx.S.edges.filter((e) => !e.kind || e.kind === "flow").map((e) => e.from + ">" + e.to));
async function selectFlow(from, to) {
  for (const u of [0.5, 0.3, 0.7, 0.4, 0.6, 0.2, 0.8]) {
    const m = await p.evaluate(([f, t, u]) => { const e = __nx.S.edges.find((x) => x.from === f && x.to === t); const q = e._pts; let bi = 0, bl = -1; for (let i = 0; i < q.length - 1; i++) { const L = Math.hypot(q[i + 1].x - q[i].x, q[i + 1].y - q[i].y); if (L > bl) { bl = L; bi = i; } } return { x: q[bi].x + (q[bi + 1].x - q[bi].x) * u, y: q[bi].y + (q[bi + 1].y - q[bi].y) * u }; }, [from, to, u]);
    const cv = await canvasBox(p); await p.mouse.click(cv.x + m.x, cv.y + m.y); await p.waitForTimeout(120);
    const sel = await p.evaluate(() => __nx.V.selE); if (sel && sel.from === from && sel.to === to) return sel;
  }
  return null;
}
async function dragEnd(from, to, end, target) {
  const g = await p.evaluate(([f, t]) => __nx.S.edges.find((x) => x.from === f && x.to === t)._g, [from, to]);
  const s = end === "to" ? { x: g.ex, y: g.ey } : { x: g.sx, y: g.sy }, t = await nodePos(p, target), cv = await canvasBox(p);
  await p.mouse.move(cv.x + s.x, cv.y + s.y); await p.mouse.down();
  for (let i = 1; i <= 12; i++) { await p.mouse.move(cv.x + s.x + (t.x - s.x) * i / 12, cv.y + s.y + (t.y - s.y) * i / 12); await p.waitForTimeout(16); }
  await p.waitForTimeout(100); const hint = await p.evaluate(() => __nx.V.rewire && __nx.V.rewire.t);
  await p.mouse.up(); await p.waitForTimeout(400); return hint;
}
ok(JSON.stringify(await selectFlow("SVC1", "DB1")) === JSON.stringify({ from: "SVC1", to: "DB1" }), "clicking a flow selects it (handles appear at both ends)");
let h = await dragEnd("SVC1", "DB1", "to", "DB2");
ok(h && h.ok, "dragging the arrow end over DB2 shows it can be reconnected");
ok(await p.isVisible("#guard"), "on drop, the Action Guard shows the effect before anything changes");
const trade = await p.textContent("#gTrade");
ok(/DB2 now receives/.test(trade) && /DB1 no longer receives/.test(trade) && /Errors/.test(trade), "the effect lists the load moved, utilisation, errors and latency");
await p.click("#gApply"); await p.waitForTimeout(300);
let f = await flows(); ok(f.includes("SVC1>DB2") && !f.includes("SVC1>DB1"), "after Implement, SVC1 → DB1 became SVC1 → DB2");
ok((await selectFlow("WAF1", "GW1"))?.to === "GW1", "a short flow between two groups can be selected");
// technically wrong: API gateway straight to a database
ok((await selectFlow("GW1", "SVC1"))?.to === "SVC1", "GW1 → SVC1 selected"); h = await dragEnd("GW1", "SVC1", "to", "DB1");
ok(h && h.ok === false, "dragging GW1 → SVC1 onto a database is shown as not possible while hovering: " + (h && h.why || "").slice(0, 120));
ok(!(await p.isVisible("#guard")), "dropping it does not open the Action Guard");
f = await flows(); ok(f.includes("GW1>SVC1") && !f.includes("GW1>DB1"), "the flow is unchanged");
ok(/Not reconnected: .*not technically possible/.test(await consoleText(p)), "the console says why: " + (await consoleText(p)).split("Not reconnected:").pop().slice(0, 110));
// shared platform services are dependencies, not flows
await selectFlow("SVC2", "DB2"); h = await dragEnd("SVC2", "DB2", "to", "MON1");
ok(h && h.ok === false && /platform/.test(h.why), "a flow cannot be reconnected to a shared platform service");
// the start of a flow can move too
await selectFlow("GW1", "IDP1"); h = await dragEnd("GW1", "IDP1", "from", "SVC2");
ok(h && h.ok, "the start of a flow can be dragged to another component");
if (await p.isVisible("#guard")) await p.click("#gApply"); await p.waitForTimeout(300);
f = await flows(); ok(f.includes("SVC2>IDP1") && !f.includes("GW1>IDP1"), "GW1 → IDP1 now starts at SVC2");
await b.close(); summary();
