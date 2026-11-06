// Browser check: flow lines do not lie on top of each other, and every request has a response drawn back
// to the caller (except events into or out of a queue).  Run: node poc/tests/flows.e2e.mjs
import { open, newDesign, ok, summary, nodePos, dragTo } from "./lib.mjs";
const { b, p } = await open();
await newDesign(p); await p.waitForTimeout(400);
const overlaps = () => p.evaluate(() => {
  const es = __nx.S.edges.filter((e) => (!e.kind || e.kind === "flow") && e._drawn && e._pts), segs = [], bad = [];
  es.forEach((e) => { const q = e._pts; for (let i = 0; i < q.length - 1; i++) segs.push({ e, a: q[i], b: q[i + 1] }); });
  const kind = (s) => Math.abs(s.a.y - s.b.y) < .5 ? "h" : Math.abs(s.a.x - s.b.x) < .5 ? "v" : "d";
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i], t = segs[j]; if (s.e === t.e) continue; const k = kind(s); if (k !== kind(t) || k === "d") continue;
    const [c1, c2, l1, h1, l2, h2] = k === "h" ? [s.a.y, t.a.y, Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x), Math.min(t.a.x, t.b.x), Math.max(t.a.x, t.b.x)] : [s.a.x, t.a.x, Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y), Math.min(t.a.y, t.b.y), Math.max(t.a.y, t.b.y)];
    if (Math.abs(c1 - c2) < 3 && Math.min(h1, h2) - Math.max(l1, l2) > 4) bad.push(`${s.e.from}>${s.e.to} / ${t.e.from}>${t.e.to}`);
  }
  return { bad, n: es.length };
});
let o = await overlaps(); ok(o.n >= 8 && o.bad.length === 0, `no two of the ${o.n} flow lines overlap${o.bad.length ? ": " + o.bad.join(", ") : ""}`);
const ends = await p.evaluate(() => { const g = {}; __nx.S.edges.filter((e) => (!e.kind || e.kind === "flow") && e._pts).forEach((e) => { const k = e.from + Math.round(e._pts[0].x) + "," + Math.round(e._pts[0].y); g[k] = (g[k] || 0) + 1; }); return Math.max(...Object.values(g)); });
ok(ends === 1, "lines leaving the same component start at different points");
// move SVC2 next to SVC1 so routes would share corridors, then measure again
const s1 = await nodePos(p, "SVC1"); await dragTo(p, "SVC2", s1.x, s1.y + 120); await p.waitForTimeout(400);
if (await p.isVisible("#guard")) await p.click("#gCancel");
o = await overlaps(); ok(o.bad.length === 0, "still no overlaps after moving a component" + (o.bad.length ? ": " + o.bad.join(", ") : ""));
// responses
const r = await p.evaluate(() => Object.fromEntries(__nx.S.edges.filter((e) => (!e.kind || e.kind === "flow") && e._drawn).map((e) => [e.from + ">" + e.to, !!e._rpts])));
ok(r["GW1>SVC1"] && r["SVC1>DB1"] && r["U1>WAF1"], "requests have a response line back to the caller");
ok(r["SVC1>Q1"] === false && r["Q1>SVC2"] === false, "events into or out of the queue have none");
const dir = await p.evaluate(() => { const e = __nx.S.edges.find((x) => x.from === "GW1" && x.to === "SVC1"), a = e._rpts[0], s = e._pts[0]; return Math.hypot(a.x - s.x, a.y - s.y); });
ok(dir < 16, "the response arrow ends at the caller (GW1)");
await p.click("#lgResp", { force: true }).catch(async () => { await p.evaluate(() => { const c = document.querySelector("#lgResp"); c.checked = false; c.dispatchEvent(new Event("change")); }); });
await p.waitForTimeout(200);
ok(await p.evaluate(() => __nx.S.settings.view.resp === false && !__nx.S.edges.some((e) => e._rpts)), "Legend → Responses turns them off");
await b.close(); summary();
