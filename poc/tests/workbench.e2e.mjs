// Browser check for v0.3.9: placement drawn as the knowledge says (global edge, regional services outside the VPC),
// DNS steering for two regions, the AWS product catalogue in the palette and the console, one What-if panel,
// and console commands that answer without a model. Run: node poc/tests/workbench.e2e.mjs
import { open, newDesign, ok, summary } from "./lib.mjs";
const { b, p } = await open({ width: 1600, height: 1000 });
await newDesign(p, { services: "orders, payments" });
const apply = async () => { await p.waitForTimeout(150); if (await p.isVisible("#guard")) { if (await p.isDisabled("#gApply") && await p.isVisible("#gJust")) await p.fill("#gJust", "Test: workbench scenario."); if (await p.isEnabled("#gApply")) await p.click("#gApply"); else await p.click("#gCancel"); await p.waitForTimeout(200); } };
const run = async (t) => { await p.evaluate((t) => __nx.run(t), t); await apply(); };
const out = () => p.textContent("#conOut");
const zone = (id) => p.evaluate((id) => { const n = __nx.S.nodes[id]; return n ? __nx.drawZone(n) : null; }, id);
const byType = (t) => p.evaluate((t) => Object.values(__nx.S.nodes).filter((n) => n.type === t && n.parent === "root").map((n) => n.id), t);

// 1. placement is drawn as the knowledge says
await run("add cloudfront");
const cdn = (await byType("cdn"))[0];
ok((await zone(cdn)) === "global", "a CDN is drawn in the global edge, outside the VPC");
ok(!(await p.evaluate(() => __nx.zoneMembers("__outer").some((n) => n.type === "cdn"))), "the VPC frame does not include the CDN");
ok((await zone("GW1")) === "rfront" && (await zone("IDP1")) === "rfront", "API Gateway and Cognito (managed, no subnet) are drawn as regional services outside the VPC");
await run("add s3"); const os = (await byType("obj"))[0];
ok((await zone(os)) === "rback", "S3 is drawn as a regional service behind the VPC");
ok((await zone("Q1")).startsWith("net:") || (await zone("Q1")) === "data", "MSK (in subnets) stays inside the VPC");
await run("add dynamodb"); const ddb = (await p.evaluate(() => Object.values(__nx.S.nodes).find((n) => n.product === "dynamodb")))?.id;
ok(ddb && (await zone(ddb)) === "rback", "DynamoDB from the catalogue is regional, outside the VPC");
// CDN → WAF on the CDN → API gateway is a valid edge chain (no "skips a perimeter")
await p.evaluate((c) => { const S = __nx.S; S.edges = S.edges.filter((e) => !(e.from === "U1" && e.to === "WAF1")); S.edges.push({ from: "U1", to: c, proto: "HTTPS", via: "internet" }, { from: c, to: "WAF1", proto: "HTTPS", via: "net" }); __nx.refresh(); }, cdn);
await p.waitForTimeout(150);
ok((await zone("WAF1")) === "global", "a WAF in front of the CDN joins the global edge");
ok(!(await p.evaluate(() => __nx.findings.some((f) => /^zone:/.test(f.key) && /CDN|WAF1/.test(f.title)))), "CDN → WAF → API gateway raises no 'skips a perimeter' finding");
ok(await p.evaluate(() => { const v = __nx.placeVerdict("net", Object.values(__nx.S.nodes).find((n) => n.type === "cdn").id, __nx.S.nets[0].id); return v.fit === "no"; }), "dropping the CDN into a subnet is still refused");

// 2. the console knows DNS by name; two regions get DNS steering in both
await run("add route 53");
ok(/Add DNS\d \(Amazon Route 53\)/.test(await out()), "add route 53 adds Amazon Route 53 (not an API endpoint)");
await run("remove " + (await byType("dns"))[0]);
await run("multi-region active-passive");
let dns = (await byType("dns"))[0];
ok(!!dns, "turning on two regions adds DNS steering when there is none");
ok(/Active-passive/.test(await out()) && !/Active-active across/.test((await out()).slice(-400)), "the console says active-passive, not active-active");
ok(await p.evaluate((d) => __nx.S.nodes[d].policy === "failover", dns), "DNS uses failover routing for active-passive");
ok(await p.evaluate((d) => __nx.S.edges.some((e) => e.from === "U1" && e.to === d) && !__nx.S.edges.some((e) => e.from === "U1" && e.to === "WAF1"), dns), "users reach the regions through DNS");
await run("regions side by side");
ok(await p.evaluate((d) => { const S = __nx.S, flow = (e) => !e.kind || e.kind === "flow", seen = new Set([d]), q = [d];
  while (q.length) { const x = q.shift(); S.edges.filter((e) => flow(e) && e.from === x).forEach((e) => { if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); } }); }
  return [...seen].some((id) => S.nodes[id] && S.nodes[id].region === "B" && ["gw", "waf", "lb"].includes(S.nodes[id].type)); }, dns), "with region B drawn, users reach region B's entry through DNS (and the CDN)");
ok(await p.evaluate(() => Object.values(__nx.S.nodes).filter((n) => n.type === "waf" && __nx.drawZone(n) === "global").length === 1), "the CDN's WAF is global: one WAF, not copied into region B");

// 3. the AWS catalogue: palette and console
await p.click("#addBtn"); await p.fill("#palQ", "direct connect"); await p.waitForTimeout(150);
ok(/AWS products/.test(await p.textContent("#palList")) && /Direct Connect/.test(await p.textContent("#palList")), "the palette searches the AWS product catalogue");
await p.keyboard.press("Escape");
await run("add direct connect");
ok(/not modelled in NEXUS yet \(planned in SP-Hybrid\)/.test(await out()), "a product NEXUS does not model yet says so, with its planned pack");
await run("add app mesh");
ok(/discontinued support on 30 September 2026/.test(await out()), "a retired AWS product is flagged");
await run("find kafka");
ok(/Amazon MSK/.test((await out()).slice(-300)), "find searches the design and the catalogue");

// 4. one What-if panel
ok(!(await p.isVisible("#wiChip")), "no what-if chip while nothing is simulated");
await run("fail zone a"); await run("what if load 3x");
let wi = await p.evaluate(() => __nx.whatIfs().map((x) => x.t));
ok(wi.some((t) => /Zone a down/.test(t)) && wi.some((t) => /Load 3/.test(t)), "the What-if summary lists the zone outage and the load");
ok(await p.isVisible("#wiChip"), "the top bar shows one what-if chip");
ok(!(await p.evaluate(() => !!document.querySelector("#iFail"))), "the Inspector no longer has a what-if selector");
ok(await p.evaluate(() => document.querySelector("#pDem #mult") && !document.querySelector(".top #mult")), "the load slider lives in the What-if panel");
await p.evaluate(() => { const s = document.querySelector("#wiFail"); s.value = "SVC1"; s.dispatchEvent(new Event("change")); }); await p.waitForTimeout(150);
ok(await p.evaluate(() => __nx.S.nodes.SVC1.failed === true), "a component can be failed from the What-if panel");
await p.evaluate(() => document.querySelector('#wiSum [data-wix="all"]').click()); await p.waitForTimeout(150);
ok((await p.evaluate(() => __nx.whatIfs().length)) === 0 && !(await p.isVisible("#wiChip")), "Clear all ends every what-if");
ok(await p.evaluate(() => !!document.querySelector("#pLay #zCount") && !!document.querySelector("#pLay #rMode")), "design settings (zones, regions, workload) moved to Layers");

// 5. console without a model
await run("what is SVC1"); ok(/SVC1 · .*\nWhere:|Where: /.test(await out()), "what is SVC1 answers from the design");
await run("why DB1"); ok(!/undefined/.test((await out()).slice(-300)), "why DB1 lists findings without 'undefined'");
await run("list components"); ok(/Service \(container\): SVC1/.test((await out()).slice(-600)), "list components groups the design");
await run("tidy"); ok(/Tidied every component/.test((await out()).slice(-300)), "tidy with nothing selected tidies everything");
await run("restore region"); ok(/No region outage to clear/.test((await out()).slice(-200)), "restore region with nothing to restore says so");
await b.close(); summary();
