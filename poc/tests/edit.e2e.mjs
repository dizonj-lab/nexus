// Browser check for v0.3.13: topics, publishers and consumer groups from the SP-Kafka panel (no console needed),
// and resizable regions and subnets (drag the bottom-right corner; what is right of or below them makes room).
// Run: node poc/tests/edit.e2e.mjs
import { open, newDesign, ok, summary } from "./lib.mjs";
const { b, p } = await open({ width: 1500, height: 1000 });
await newDesign(p, { services: "orders, payments" });
// 1. topics and consumer groups from the panel
const apply = async () => { await p.waitForTimeout(200); if (await p.isVisible("#guard")) { if (await p.isDisabled("#gApply") && await p.isVisible("#gJust")) await p.fill("#gJust", "Test: topics from the panel."); if (await p.isEnabled("#gApply")) await p.click("#gApply"); await p.waitForTimeout(250); } };
await p.evaluate(() => __nx.inspect("Q1")); await p.waitForTimeout(300);
ok(await p.isVisible("#kfTName"), "selecting the cluster opens Topics with an Add topic form");
await p.fill("#kfTName", "sales.order.placed.v1"); await p.click("#kfTAdd"); await apply();
ok(await p.evaluate(() => __nx.S.nodes.Q1.channels.some((c) => c.id === "sales.order.placed.v1" && c.partitions === 6)), "Add topic creates sales.order.placed.v1 with 6 partitions");
await p.evaluate(() => __nx.inspect("Q1")); await p.waitForTimeout(300);
await p.selectOption("#kfpubA", "SVC1"); await p.selectOption("#kfpubT", "sales.order.placed.v1"); await p.fill("#kfpubK", "orderId"); await p.click("#kfpubAdd"); await apply();
ok(await p.evaluate(() => __nx.S.edges.some((e) => e.from === "SVC1" && e.to === "Q1" && e.ch === "sales.order.placed.v1" && e.key === "orderId")), "Add publisher: SVC1 publishes to the topic with key orderId");
await p.evaluate(() => __nx.inspect("Q1")); await p.waitForTimeout(300);
await p.click('[data-spt="kafka|groups"]'); await p.waitForTimeout(200);
await p.fill("#kfsubG", "analytics"); await p.selectOption("#kfsubA", "SVC2"); await p.selectOption("#kfsubT", "sales.order.placed.v1"); await p.click("#kfsubAdd"); await apply();
ok(await p.evaluate(() => __nx.S.edges.some((e) => e.from === "Q1" && e.to === "SVC2" && e.ch === "sales.order.placed.v1" && e.group === "analytics")), "Add consumer group: SVC2 reads the topic in group analytics");
await p.evaluate(() => __nx.inspect("Q1")); await p.waitForTimeout(300); await p.click('[data-spt="kafka|topics"]'); await p.waitForTimeout(200);
ok(/sales\.order\.placed\.v1\.analytics\.dlq/.test(await p.textContent("#spPanel")), "the group's dead-letter topic is shown under the topic");

await p.evaluate(() => __nx.openMenu("Q1", 300, 300)); await p.waitForTimeout(150);
ok(/Topics and consumer groups/.test(await p.textContent("#nmenu")), "the cluster's ▾ menu has Topics and consumer groups…");
await p.click('#nmenu [data-m="topics"]'); await p.waitForTimeout(300);
ok(await p.evaluate(() => document.activeElement && document.activeElement.id === "kfTName"), "it opens the Topics tab with the cursor in the new topic name");
// 1b. topics from the console: rename, several topics on one connection, unsubscribe, remove, list
const run = async (t) => { await p.evaluate((t) => __nx.run(t), t); await apply(); };
await run("rename topic sales.order.placed.v1 to sales.order.v1 on Q1");
ok(await p.evaluate(() => __nx.S.nodes.Q1.channels.some((c) => c.id === "sales.order.v1") && __nx.S.edges.find((e) => e.from === "SVC1" && e.to === "Q1").ch === "sales.order.v1"), "rename topic: the topic and its publisher follow the new name");
await run("add topic payments.payment.v1 to Q1 partitions 12 key orderId ordered");
await run("subscribe SVC2 from Q1/payments.payment.v1 group analytics");
ok(await p.evaluate(() => { const e = __nx.S.edges.find((x) => x.from === "Q1" && x.to === "SVC2"); return e.ch === "sales.order.v1" && (e.chs || []).includes("payments.payment.v1"); }), "a second subscribe on the same connection adds the topic instead of replacing it");
await run("topics Q1");
ok(/sales\.order\.v1[\s\S]*to SVC2 \(analytics\)[\s\S]*payments\.payment\.v1[\s\S]*to SVC2 \(analytics\)/.test((await p.textContent("#conOut")).slice(-600)), "topics Q1 lists each topic with its publishers and consumer groups");
ok(await p.evaluate(() => __nx.kDlqs("Q1") === 2), "each topic the group reads gets its own dead-letter topic (2)");
await run("unsubscribe SVC2 from Q1/payments.payment.v1");
ok(await p.evaluate(() => { const e = __nx.S.edges.find((x) => x.from === "Q1" && x.to === "SVC2"); return e && !(e.chs || []).length && e.ch === "sales.order.v1"; }), "unsubscribe drops one topic and keeps the connection");
await run("remove topic payments.payment.v1 from Q1");
ok(await p.evaluate(() => !__nx.S.nodes.Q1.channels.some((c) => c.id === "payments.payment.v1")), "remove topic deletes it from the cluster");
// 2. resize a subnet and the region
await p.evaluate(() => __nx.inspect(null)); await p.waitForTimeout(200);
const hit = (z) => p.evaluate((z) => __nx.zoneHits().find((h) => h.z === z), z);
const box = (z) => hit(z);
const nets = await p.evaluate(() => __nx.zoneHits().map((h) => h.z));
const net = nets.find((z) => z.startsWith("net:"));
let b0 = await box(net);
const cv = await p.$("canvas"); const r = await cv.boundingBox();
await p.mouse.move(r.x + b0.x1, r.y + b0.y1); await p.waitForTimeout(100);
ok(await p.evaluate(() => getComputedStyle(document.querySelector("canvas")).cursor === "nwse-resize"), "the subnet's bottom-right corner shows a resize cursor");
await p.mouse.down(); await p.mouse.move(r.x + b0.x1 + 120, r.y + b0.y1 + 80, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
let b1 = await box(net);
ok(b1.x1 - b0.x1 > 100 && b1.y1 - b0.y1 > 60, `dragging the corner makes the subnet larger (${Math.round(b1.x1 - b0.x1)}×${Math.round(b1.y1 - b0.y1)} px)`);
const other = (await p.evaluate(() => __nx.zoneHits().map((h) => h.z))).find((z) => z.startsWith("net:") && z !== net);
if (other) { const ob = await box(other); ok(ob.x0 >= b1.x1 - 2 || ob.y0 >= b1.y1 - 2, "the next subnet moved to make room (no overlap)"); }
const o0 = await box("__outer");
await p.mouse.move(r.x + o0.x1, r.y + o0.y1); await p.mouse.down(); await p.mouse.move(r.x + o0.x1 + 90, r.y + o0.y1 + 40, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200);
const o1 = await box("__outer");
ok(o1.x1 - o0.x1 > 70, "the region can be resized the same way");
await p.reload(); await p.waitForTimeout(800);
ok(await p.evaluate((z) => !!(__nx.S.view.zsize && __nx.S.view.zsize[z]), net), "sizes are saved with the design");
await p.keyboard.press("Control+z"); await p.waitForTimeout(150);
await p.evaluate(() => __nx.run("reset sizes")); await p.waitForTimeout(200);
ok(await p.evaluate(() => !Object.keys(__nx.S.view.zsize || {}).length), "reset sizes fits every box to its components again");

await b.close(); summary();
