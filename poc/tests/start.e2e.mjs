// Browser check for v0.3.17: the launch dialog (recent designs, import/export, start new), the design library
// (a new design files the open one; open brings it back), and the guide on a blank design.
// Run: node poc/tests/start.e2e.mjs
import { chromium, BASE, ok, summary } from "./lib.mjs";
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 950 } }), errs = [];
p.on("pageerror", (e) => { errs.push(e.message); console.log("ERR", e.stack.split("\n").slice(0, 6).join(" <- ")); });
const apply = async () => { await p.waitForTimeout(150); if (await p.isVisible("#guard")) { if (await p.isVisible("#gDownAck")) await p.check("#gDownAck"); if (await p.isDisabled("#gApply") && await p.isVisible("#gJust")) await p.fill("#gJust", "Test: guide."); if (await p.isEnabled("#gApply")) await p.click("#gApply"); else await p.click("#gCancel"); await p.waitForTimeout(200); } };
const lib = () => p.evaluate(() => JSON.parse(localStorage.getItem("nexus.library.v1") || "[]"));
await p.goto(BASE + "?test&launch"); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);

// 1. launch dialog
ok(await p.isVisible("#startDlg"), "NEXUS opens with the launch dialog");
ok(/Customer Portal/.test(await p.textContent("#stList")) && /Open now/.test(await p.textContent("#stList")), "Recent designs lists the open design first");
await p.click("#stClose"); ok(!(await p.isVisible("#startDlg")), "Continue closes it and keeps the open design");

// 2. blank: a new design; the old one is filed under Recent designs
await p.click("#docsBtn"); await p.click('[data-st="blank"]'); await p.fill("#stName", "Store POS"); await p.click("#stCreate"); await p.waitForTimeout(400);
ok(await p.evaluate(() => __nx.S.project === "Store POS" && Object.keys(__nx.S.nodes).length === 0), "Create blank design: an empty design named Store POS");
const L = await lib(); const old = L.find((x) => x.name === "Customer Portal");
ok(old && await p.evaluate((id) => !!localStorage.getItem("nexus.design." + id), old.id), "the previous design is kept in its own slot");
ok(await p.isVisible("#guide"), "a blank design opens with the guide");
ok(/Who uses it\?/.test(await p.textContent("#guide")), "the guide starts with: Who uses it?");

// 3. guide steps add and wire components
const step = async (label) => { await p.locator("#guide .gbtn", { hasText: label }).first().click(); await apply(); };
await step("Internet users");
ok(/Where do they come in\?/.test(await p.textContent("#guide .gstep.now")), "next: Where do they come in?");
await step("DNS + WAF + API gateway");
ok(await p.evaluate(() => { const S = __nx.S, t = (k) => Object.values(S.nodes).find((n) => n.type === k); const u = t("user"), d = t("dns"), w = t("waf"), g = t("gw"); return u && d && w && g && S.edges.some((e) => e.from === u.id && e.to === d.id) && S.edges.some((e) => e.from === d.id && e.to === w.id) && S.edges.some((e) => e.from === w.id && e.to === g.id); }), "users → DNS → WAF → API gateway");
await step("Add a service");

ok(await p.evaluate(() => (__nx.S.nets || []).length >= 3 && Object.values(__nx.S.nodes).some((n) => n.type === "svc")), "the first service brings the region network (subnets)");
await step("Database for");
ok(await p.evaluate(() => __nx.S.edges.some((e) => __nx.S.nodes[e.from]?.type === "svc" && __nx.S.nodes[e.to]?.type === "db")), "the service gets its own database");
await step("Add an identity provider"); await step("Add platform services");
ok(/basics in place/.test(await p.textContent("#guide")), "after the six steps the guide says the basics are in place");
await p.locator("#guide .gchip", { hasText: "Cache" }).click(); await apply();
ok(await p.evaluate(() => Object.values(__nx.S.nodes).some((n) => n.type === "cache")), "a component chip in the guide adds that component");

// 4. open the earlier design again; the blank one is kept
await p.click("#docsBtn"); await p.waitForTimeout(150);
ok(/Store POS/.test(await p.textContent("#stList .cur")), "Recent designs marks Store POS as open");
await p.locator("#stList .open", { hasText: "Customer Portal" }).click(); await p.waitForTimeout(400);
ok(await p.evaluate(() => __nx.S.project === "Customer Portal" && Object.keys(__nx.S.nodes).length > 5), "opening Customer Portal brings it back");
ok(await p.evaluate(() => JSON.parse(localStorage.getItem("nexus.library.v1")).some((x) => x.name === "Store POS" && !!localStorage.getItem("nexus.design." + x.id))), "Store POS is kept");
await p.reload(); await p.waitForTimeout(600);
ok(await p.evaluate(() => __nx.S.project === "Customer Portal"), "after a reload the last opened design is open");

// 4b. export and import
if (await p.isVisible("#startDlg")) await p.click("#stClose");
await p.click("#docsBtn"); const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#stExport")]);
const file = await dl.path(); ok(/customer-portal\.nexus\.json$/.test(dl.suggestedFilename()), "Export downloads customer-portal.nexus.json");
await p.setInputFiles("#stFile", file); await p.waitForTimeout(500);
ok(await p.evaluate(() => __nx.S.project === "Customer Portal (imported)" && JSON.parse(localStorage.getItem("nexus.library.v1")).some((x) => x.name === "Customer Portal")), "Import opens the file as its own design, next to the original");
// 4c. starters
const starter = async (k, set) => { if (await p.isVisible("#startDlg")) await p.click("#stClose"); await p.click("#docsBtn"); await p.click(`[data-st="${k}"]`); await p.waitForTimeout(150); if (set) await set(); await p.click("#stGo"); await apply(); await p.waitForTimeout(300); };
const has = (t) => p.evaluate((t) => Object.values(__nx.S.nodes).some((n) => n.type === t), t);
const edge = (f, t) => p.evaluate(([f, t]) => { const N = __nx.S.nodes, find = (x) => Object.values(N).filter((n) => n.type === x || n.name === x).map((n) => n.id); return __nx.S.edges.find((e) => find(f).includes(e.from) && find(t).includes(e.to)) || null; }, [f, t]);
await starter("tier");
ok(await p.evaluate(() => __nx.S.project === "3-tier app design") && !!(await edge("Load balancer", "Web tier")) && !!(await edge("Web tier", "App tier")) && !!(await edge("App tier", "App database")), "3-tier: load balancer → web tier → app tier → database");
ok(await p.evaluate(() => { const d = Object.values(__nx.S.nodes).find((n) => n.type === "db"); return d.engine === "aurora" && __nx.F[d.id].aur; }), "3-tier: the database is Aurora (writer + reader)");
ok(await has("dns") && await p.evaluate(() => (__nx.S.nets || []).length >= 3 && __nx.S.settings.zones === 3), "3-tier: DNS, the region network and 3 zones are created");
await starter("micro");
ok(await p.evaluate(() => Object.values(__nx.S.nodes).filter((n) => n.type === "svc").length === 4 && Object.values(__nx.S.nodes).filter((n) => n.type === "db").length === 4), "Microservices: four services, a database each");
ok(await p.evaluate(() => Object.values(__nx.S.nodes).filter((n) => n.type === "db" && n.engine === "aurora").map((n) => n.name).join() .match(/Orders|Payments/g).length === 2), "Microservices: orders and payments on Aurora");
ok(await has("queue") && await has("mon") && await has("sec") && await has("kms"), "Microservices: event bus, observability, secrets and keys");
await starter("c2c", async () => { await p.screenshot({ path: "/tmp/c2c-opts.png", fullPage: true }); });
const c2c = await p.evaluate(() => [...document.querySelectorAll("#stConn .stc b")].map((b) => b.textContent));
ok(c2c.length === 5 && /AWS Interconnect/.test(c2c[1]), "AWS ↔ Google Cloud offers five options: " + c2c.join(" | "));
await p.screenshot({ path: "/tmp/c2c-design.png" });
const xe = await edge("svc", "ext");
ok(xe && xe.via === "dedicated" && /AWS Interconnect/.test(xe.link), "Cloud to cloud AWS ↔ Google Cloud: the recommended AWS Interconnect – multicloud is drawn as a dedicated link to the Google Cloud workload");
ok(await p.evaluate(() => __nx.S.adrs.length === 1 && /AWS Interconnect/.test(__nx.S.adrs[0].title) && /docs\.aws\.amazon\.com\/interconnect/.test(__nx.S.adrs[0].tradeoffs)), "a decision record (ADR) holds the connectivity choice, why, trade-offs and sources; the new design starts with no older ADRs");
await starter("hybrid");
const he = await edge("svc", "ext");
ok(he && he.via === "dedicated" && he.backup === "vpn", "Hybrid: dedicated connection with a VPN backup (recommended)");
ok(await p.evaluate(() => Object.values(__nx.S.nodes).some((n) => n.type === "user" && n.origin === "corp")), "Hybrid: employees on the company network");
await starter("saas", async () => { await p.fill("#stSaas", "Stripe"); });
ok(!!(await edge("egw", "saas")) && !(await edge("svc", "saas")), "Cloud to SaaS: the API call leaves through the egress firewall");
await starter("saas", async () => { await p.fill("#stSaas", "Stripe"); await p.check('#stConn input[value="hook"]'); });
ok(!!(await edge("saas", "gw")), "Cloud to SaaS, inbound webhooks: the SaaS calls the API gateway");
ok(await p.evaluate(() => JSON.parse(localStorage.getItem("nexus.library.v1")).length >= 7), "every starter design is kept under Recent designs");

// 5. delete, launch switch
await p.click("#docsBtn"); await p.waitForTimeout(150); await p.click("#stClose");
await p.click("#docsBtn"); const before = (await lib()).length; const del = p.locator("#stList .del").first(); await del.click(); await del.click(); await p.waitForTimeout(150);
ok((await lib()).length === before - 1, "× twice deletes a design from this browser");
await p.uncheck("#stLaunch"); await p.click("#stClose"); await p.reload(); await p.waitForTimeout(500);
ok(!(await p.isVisible("#startDlg")), "Show at launch off: NEXUS opens straight on the design");
ok(errs.length === 0, "no page errors" + (errs.length ? ": " + errs.join(" | ") : ""));
await b.close(); summary();
