// Browser check: SP-Microservice (preview). gRPC between services, the block's connectors, call settings,
// the pack's rules with fixes and recorded exceptions, the scale state, and turning the pack off.
// Run: node poc/tests/sp-microservice.e2e.mjs
import { open, newDesign, ok, summary } from "./lib.mjs";
const { b, p } = await open({ width: 1440, height: 1000 });
await newDesign(p, { services: "orders, payments" });
const run = async (t) => { await p.evaluate((t) => __nx.run(t), t); await p.waitForTimeout(200); if (await p.isVisible("#guard")) { if (await p.isDisabled("#gApply") && await p.isVisible("#gJust")) await p.fill("#gJust", "Test: service pack scenario."); if (await p.isEnabled("#gApply")) await p.click("#gApply"); else await p.click("#gCancel"); await p.waitForTimeout(200); } };
const apply = async () => { await p.waitForTimeout(150); if (await p.isVisible("#guard")) { if (await p.isDisabled("#gApply") && await p.isVisible("#gJust")) await p.fill("#gJust", "Test: service pack scenario."); await p.click("#gApply"); await p.waitForTimeout(200); } };
const keys = () => p.evaluate(() => __nx.findings.map((f) => f.key));
const edge = (a, b) => p.evaluate(([a, b]) => { const e = __nx.S.edges.find((x) => x.from === a && x.to === b && !x.kind); return e && { proto: e.proto, deadline: e.deadline, retries: e.retries, op: e.op, idem: e.idem, spEx: e.spEx }; }, [a, b]);
const fixBy = async (re) => { const i = await p.evaluate((src) => __nx.findings.findIndex((f) => new RegExp(src).test(f.key)), re); if (i < 0) return false; await p.evaluate(() => { const b = [...document.querySelectorAll("#pAdv .tabs button")].find((x) => x.dataset.t === "find"); b && b.click(); }); await p.waitForTimeout(150); await p.evaluate((i) => document.querySelector(`[data-fix="${i}"]`)?.click(), i); await apply(); return true; };

ok(await p.evaluate(() => __nx.spOn("sp.microservice")), "SP-Microservice is on by default (preview)");
ok(!(await keys()).some((k) => /^sp:ms\./.test(k)), "the starter design raises no SP-Microservice finding");
ok(!(await keys()).some((k) => /^spof:SVC/.test(k)), "the legacy single-copy check is replaced for services");
// the panel
await p.evaluate(() => __nx.inspect("SVC1")); await p.waitForTimeout(300);
ok(await p.isVisible("#spPanel"), "SVC1's Inspector opens with the SP-Microservice panel");
await p.waitForFunction(() => /Kafka\/TLS/.test(document.querySelector("#spPanel")?.textContent || ""), null, { timeout: 3000 }).catch(() => {});
ok(/Connectors/.test(await p.textContent("#spPanel")) && /Kafka\/TLS/.test(await p.textContent("#spPanel")), "Connectors tab lists the connections, with the publish to Kafka");
await p.click('[data-spt="svc|inside"]'); await p.waitForTimeout(150);
ok(/Envoy/.test(await p.textContent("#spPanel")) && /Repository/.test(await p.textContent("#spPanel")), "Inside tab: Envoy sidecar, adapters and ports generated from the connectors");
await p.click('[data-spt="svc|pack"]'); await p.waitForTimeout(150);
ok(/SP-Microservice 0\.1\.0/.test(await p.textContent("#spPanel")) && /Not covered yet/.test(await p.textContent("#spPanel")), "Pack tab: version, level, what it covers and what it does not");
// gRPC by default between services; a chain of three hops
await run('add service named "Pricing"'); await run('add service named "Stock"');
await run("connect SVC1 to SVC3"); await run("connect SVC3 to SVC2"); await run("connect SVC2 to SVC4");
ok((await edge("SVC1", "SVC3"))?.proto === "gRPC", "a new service-to-service call uses gRPC");
ok((await edge("GW1", "SVC1"))?.proto !== "gRPC", "calls from the API gateway stay REST");
let k = await keys(); ok(k.some((x) => /^sp:ms\.sync-chain:/.test(x)), "a chain of 3 service hops raises ms.sync-chain (policy 2)");
// accept it with a reason, then revoke
await p.evaluate(() => __nx.inspect(__nx.findings.find((f) => /ms\.sync-chain/.test(f.key)).target)); await p.waitForTimeout(250);
await p.click('[data-spt="svc|rules"]'); await p.waitForTimeout(150);
await p.fill('[data-spr*="ms.sync-chain"]', "Payment needs an answer at the till"); await p.click('[data-spacc*="ms.sync-chain"]'); await apply();
k = await keys(); ok(!k.some((x) => /ms\.sync-chain/.test(x)), "accepted with a reason: it leaves the Advisor");
ok(/accepted/.test(await p.textContent("#spPanel")) && /Payment needs an answer/.test(await p.textContent("#spPanel")), "the Rules tab shows it accepted, with the reason");
await p.click('[data-spun*="ms.sync-chain"]'); await apply();
ok((await keys()).some((x) => /ms\.sync-chain/.test(x)), "Revoke brings it back");
// a call loop and its fix
await run("connect SVC4 to SVC1");
ok((await keys()).some((x) => /^sp:ms\.call-loop:/.test(x)), "SVC4 → SVC1 closes a loop: ms.call-loop");
await fixBy("ms\\.call-loop"); ok(!(await keys()).some((x) => /ms\.call-loop/.test(x)), "the fix puts a queue on the closing call; the loop is gone");
// call settings: a retried write without an idempotency key
await p.evaluate(() => { const e = __nx.S.edges.find((x) => x.from === "SVC1" && x.to === "SVC3"); e.op = "write"; e.retries = 2; __nx.refresh(); }); await p.waitForTimeout(150);
ok((await keys()).some((x) => /ms\.retry-unsafe/.test(x)), "a retried write without an idempotency key: ms.retry-unsafe");
await fixBy("ms\\.retry-unsafe"); ok((await edge("SVC1", "SVC3")).idem === true, "the fix sends an idempotency key");
// deadlines must shrink along the chain
await p.evaluate(() => { const S = __nx.S; S.edges.find((x) => x.from === "SVC1" && x.to === "SVC3").deadline = 300; S.edges.find((x) => x.from === "SVC3" && x.to === "SVC2").deadline = 800; __nx.refresh(); }); await p.waitForTimeout(150);
ok((await keys()).some((x) => /ms\.deadline-order/.test(x)), "SVC3 waits 800 ms for SVC2 but SVC1 gives it 300 ms: ms.deadline-order");
await fixBy("ms\\.deadline-order"); ok((await edge("SVC3", "SVC2")).deadline === 180, "the fix sets 60% of the caller's deadline (180 ms)");
// the call's settings in the flow Inspector
await p.evaluate(() => { __nx.V.sel = null; __nx.V.selE = { from: "SVC1", to: "SVC3" }; document.querySelector('#pAdv .tabs button[data-t="insp"]').click(); }); await p.waitForTimeout(250);
ok(await p.isVisible('[data-spcall="deadline"]') && await p.isVisible('[data-spcall="contract"]'), "the flow Inspector shows contract, deadline, retries, operation and idempotency");
await p.selectOption('[data-spcall="op"]', "read"); await apply();
ok((await edge("SVC1", "SVC3")).op === "read", "changing the operation goes through the Action Guard and is applied");
// gRPC at the edge
await p.evaluate(() => { __nx.S.edges.find((x) => x.from === "WAF1" && x.to === "GW1").proto = "gRPC"; __nx.refresh(); }); await p.waitForTimeout(150);
ok((await keys()).some((x) => /ms\.grpc-edge/.test(x)), "gRPC from the WAF side (browsers) is flagged");
await fixBy("ms\\.grpc-edge"); ok((await edge("WAF1", "GW1")).proto === "HTTPS", "the fix uses REST at the edge");
// console: over rest / over grpc
await run("connect SVC2 to SVC3 over rest"); ok((await edge("SVC2", "SVC3"))?.proto === "HTTPS", "console: connect … over rest");
// scale state during a demand run
const states = new Set();
await p.evaluate(() => { document.querySelector("#dProf").value = "steady"; document.querySelector("#dPeak").value = "8"; document.querySelector("#dPlay").click(); });
for (let i = 0; i < 80; i++) { await p.waitForTimeout(60); const s = await p.evaluate(() => ["SVC1", "SVC2", "SVC3"].map((id) => __nx.scaleState(__nx.S.nodes[id]).k)); s.forEach((x) => states.add(x)); }
await p.evaluate(() => { if (__nx.SIM().on) document.querySelector("#dPlay").click(); });
ok(states.has("out-wait") || states.has("out"), `scale state shows scale-out on the block at 8× steady demand (${[...states].join(", ")})`);
// turning the pack off
await p.evaluate(() => { __nx.S.settings.sp["sp.microservice"] = false; __nx.refresh(); }); await p.waitForTimeout(150);
k = await keys(); ok(!k.some((x) => /^sp:ms\./.test(x)), "pack off: no SP-Microservice findings");
await p.evaluate(() => __nx.inspect("SVC1")); await p.waitForTimeout(200); ok(!(await p.isVisible("#spPanel")), "pack off: no panel");
await b.close(); summary();
