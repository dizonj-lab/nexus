// Browser check for v0.3.10: the findings a two-region, active-active design raised wrongly in v0.3.9
// (global edge hops, internal load balancer, DR plans per region, managed services in subnets,
// database replication, region-B twins as shared owners, finding numbers). Run: node poc/tests/regions.e2e.mjs
import { open, newDesign, ok, summary } from "./lib.mjs";
const { b, p } = await open({ width: 1600, height: 1000 });
await newDesign(p, { services: "orders, payments" });
const apply = async () => { await p.waitForTimeout(150); if (await p.isVisible("#guard")) { if (await p.isDisabled("#gApply") && await p.isVisible("#gJust")) await p.fill("#gJust", "Test: regions scenario."); if (await p.isEnabled("#gApply")) await p.click("#gApply"); else await p.click("#gCancel"); await p.waitForTimeout(200); } };
const run = async (t) => { await p.evaluate((t) => __nx.run(t), t); await apply(); };
const F = () => p.evaluate(() => __nx.findings.map((f) => ({ id: f.id, key: f.key, title: f.title })));
const has = async (re) => (await F()).filter((f) => re.test(f.key + " " + f.title));

// users → CDN → WAF (on the CDN) → GW1 → internal LB → services → their databases
await run("add cloudfront"); await run("add load balancer");
const ids = await p.evaluate(() => { const S = __nx.S, of = (t) => Object.values(S.nodes).filter((n) => n.type === t && n.parent === "root").map((n) => n.id);
  const cdn = of("cdn")[0], lb = of("lb")[0], svcs = of("svc");
  S.edges = S.edges.filter((e) => !(e.from === "U1" && e.to === "WAF1") && !(e.from === "GW1" && svcs.includes(e.to)));
  S.edges.push({ from: "U1", to: cdn, proto: "HTTPS", via: "internet" }, { from: cdn, to: "WAF1", proto: "HTTPS", via: "net" }, { from: "WAF1", to: "GW1", proto: "HTTPS", via: "net" }, { from: "GW1", to: lb, proto: "HTTPS", via: "net" });
  svcs.forEach((s) => S.edges.push({ from: lb, to: s, proto: "HTTPS", via: "net" }));
  const app = (S.nets || []).find((x) => x.tier === "app"); if (app) S.nodes[lb].net = app.id;
  __nx.refresh(); return { cdn, lb, svcs, dbs: of("db") }; });
await p.waitForTimeout(150);
ok((await has(/^zone:/)).length === 0, "CDN → WAF → GW → LB → services raises no trust-zone finding");
ok(await p.evaluate((lb) => __nx.drawZone(__nx.S.nodes[lb]) !== "edge", ids.lb) && (await has(new RegExp("^net:" + ids.lb))).length === 0, "a load balancer behind the API gateway is internal: no 'belongs in the public tier'");

await run("multi-region active-active");
ok(await p.evaluate((d) => d.every((id) => __nx.S.nodes[id].multi === "global"), ids.dbs), "turning on two regions replicates each database (Aurora Global Database)");
ok(/now replicate.*Aurora DSQL/s.test(await p.textContent("#conOut")), "the console says writes stay in region A and offers Aurora DSQL");
ok((await has(/^dr:GW/)).length === 0, "the API gateway gets no 'cross-region DR plan' once region B exists");

await run("regions side by side");
const f = await F();
ok(f.every((x) => /^F\d+$/.test(x.id)), "every finding has a number (none 'undefined')");
ok((await has(/^zone:/)).length === 0, "region B raises no trust-zone findings");
ok((await has(/^dr:/)).filter((x) => /GW|IDP\d/.test(x.title) && !/users are not copied/.test(x.title)).length === 0, "no per-region DR findings for GW1/GW2/IDP2");
ok(await p.evaluate(() => Object.values(__nx.S.nodes).filter((n) => n.region === "B" && n.type === "gw").every((n) => !n.net)), "the region-B API gateway gets no subnet (it is managed)");
ok((await has(/^(xreg|mrdb):/)).filter((x) => /crosses regions|one region only/.test(x.title)).length === 0, "region B's services use their own database copy: nothing crosses regions");
ok((await has(/shared|shareddb/)).length === 0, "a service and its region-B twin are one owner, not a shared database");
ok((await has(/^mrdb:/)).some((x) => /active-passive/.test(x.title)), "the replicated database explains where writes go");
await b.close(); summary();
