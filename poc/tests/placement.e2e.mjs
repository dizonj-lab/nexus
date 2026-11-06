// Browser check: subnets, zones and regions are known to every component; drag and drop follows the architect
// when the move is possible (with pros and cons) and refuses it, with the reason, when it is not.
// Run: node poc/tests/placement.e2e.mjs   (set SHOTS=dir to save screenshots)
import { open, newDesign, ok, summary, nodePos, boxOf, dragTo, consoleText } from "./lib.mjs";
const shot = (n) => (process.env.SHOTS ? `${process.env.SHOTS}/${n}.png` : null);
const { b, p } = await open();
await newDesign(p);
const S = () => p.evaluate(() => ({ nets: __nx.S.nets, nodes: __nx.S.nodes, outer: __nx.zoneHits().find((h) => h.z === "__outer") }));
let s = await S();
ok(s.nets.length === 3 && s.nets.every((x) => x.std), "a new design gets public, application and data subnets");
ok(s.nodes.SVC1.net === "NET2" && s.nodes.DB1.net === "NET3", "services land in the application subnet, databases in the data subnet");
ok(await p.evaluate(() => __nx.packDesign().zones.join(",") === "a,b"), "the design knows its zones (a, b)");

// 1. a database dragged into the application subnet: possible, with trade-offs shown in the Action Guard
let net2 = await boxOf(p, "net:NET2"), d = await dragTo(p, "DB1", net2.x, net2.y, shot("1-db-to-app"));
ok(d && d.kind === "net" && d.target === "NET2" && d.fit === "ok", "while dragging, the target subnet is highlighted as a fit");
ok(await p.isVisible("#guard"), "the Action Guard opens with the pros and cons");
ok(/Shares subnets with the application/.test(await p.textContent("#gTrade")), "the cons come from the placement pack");
await p.click("#gApply"); await p.waitForTimeout(300);
ok((await S()).nodes.DB1.net === "NET2", "after Implement, DB1 is in the application subnet (the canvas followed the architect)");
ok(/DB1 → Private · application/.test(await consoleText(p)), "the console lists the pros and cons");

// 2. a service dragged into the data subnet: possible but poor
await newDesign(p);
let net3 = await boxOf(p, "net:NET3"); d = await dragTo(p, "SVC1", net3.x, net3.y, shot("2-svc-to-data"));
ok(d && d.fit === "poor", "a service in the isolated data subnet is flagged as risky (poor fit)");
ok(/No outbound internet route/.test(await p.textContent("#gTrade")), "the reason is shown: no outbound route");
await p.click("#gCancel"); await p.waitForTimeout(200);
const back = await p.evaluate(() => __nx.S.nodes.SVC1.net); ok(back === "NET2", "Cancel keeps SVC1 in its subnet");

{ const pos = await nodePos(p, "SVC1"), n2 = await boxOf(p, "net:NET2"); ok(pos.x > n2.x0 && pos.x < n2.x1 && pos.y > n2.y0 && pos.y < n2.y1, "after Cancel, SVC1 is drawn back in its own subnet"); }
// 3. impossible: the API gateway (managed, regional) into a subnet; it snaps back with the reason
const before = await nodePos(p, "GW1"); d = await dragTo(p, "GW1", net3.x, net3.y, shot("3-gw-refused"));
ok(d && d.fit === "no", "a managed API gateway cannot be dropped into a subnet");
const after = await nodePos(p, "GW1");
ok(Math.abs(after.x - before.x) < 2 && Math.abs(after.y - before.y) < 2, "it snaps back to where it was");
ok(/regional service outside your VPC/.test(await consoleText(p)), "the console says why");
ok(!(await p.isVisible("#guard")), "no Action Guard for an impossible move");
ok(await p.evaluate(() => !!__nx.V.flash), "the target is highlighted in red with the reason");

// 4. zones side by side; pin a service to zone b by dropping it into lane b
await p.evaluate(() => __nx.run("zones side by side")); await p.waitForTimeout(500);
const lanes = await p.evaluate(() => __nx.laneHits().map((l) => ({ z: l.z, x0: l.x0, x1: l.x1, y0: l.y0, y1: l.y1 })));
ok(lanes.length === 2 && lanes[1].x0 > lanes[0].x1, "two zone lanes, side by side");
if (shot("4-lanes")) await p.screenshot({ path: shot("4-lanes") });
const sv = await nodePos(p, "SVC2"); d = await dragTo(p, "SVC2", sv.x + (lanes[1].x0 - lanes[0].x0), sv.y, shot("4-pin"));
ok(d && d.kind === "zone" && d.target === "b", "dropping into lane b targets zone b");
if (await p.isVisible("#guard")) await p.click("#gApply"); await p.waitForTimeout(300);
ok((await S()).nodes.SVC2.az === "b", "SVC2 is pinned to zone b");
ok(await p.evaluate(() => /pinned to zone b/.test(JSON.stringify(__nx.S.nodes.SVC2)) || __nx.S.nodes.SVC2.az === "b"), "the component knows its zone");
// 5. a load balancer cannot be pinned to one zone
await newDesign(p, {}); await p.evaluate(() => __nx.run("add load balancer")); await p.waitForTimeout(400); if (await p.isVisible("#guard")) { await p.click("#gApply"); await p.waitForTimeout(300); }
const lbId = await p.evaluate(() => Object.values(__nx.S.nodes).find((n) => n.type === "lb")?.id);
if (lbId) {
  await p.evaluate(() => __nx.run("zones side by side")); await p.waitForTimeout(400);
  const L = await p.evaluate(() => __nx.laneHits().map((l) => ({ x0: l.x0 })));
  const lp = await nodePos(p, lbId); d = await dragTo(p, lbId, lp.x + (L[1].x0 - L[0].x0), lp.y);
  ok(d && d.fit === "no" && /two zones/.test(d.why), "an Application Load Balancer cannot be pinned to one zone");
} else ok(false, "could not add a load balancer");
await b.close(); summary();
