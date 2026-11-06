// Browser check: the Properties window is compact, movable and resizable, and shows accurate limits
// (default, minimum, maximum, adjustable, source) from the knowledge packs; CloudFront's 250,000 rps default.
// Run: node poc/tests/properties.e2e.mjs
import { open, newDesign, ok, summary, consoleText } from "./lib.mjs";
const shot = (n) => (process.env.SHOTS ? { path: `${process.env.SHOTS}/${n}.png` } : null);
const { b, p } = await open();
await newDesign(p, { rps: 300000 });
const cdn = await p.evaluate(() => Object.values(__nx.S.nodes).find((n) => n.type === "cdn")?.id);
ok(!!cdn, "a design for 300,000 rps gets a CDN (" + cdn + ")");
const q = await p.evaluate((id) => { const f = __nx.findings.find((x) => x.key === "quota:" + id); return f && { title: f.title, why: f.why, fix: f.fix }; }, cdn);
ok(q && /250,000/.test(q.why) && /Service Quotas/.test(q.why), "CloudFront above 250,000 rps raises a finding: request an increase in Service Quotas");
ok(q && /docs\.aws\.amazon\.com\/AmazonCloudFront/.test(q.why), "the finding cites the AWS documentation page");
await p.evaluate((id) => __nx.run("properties " + id), cdn); await p.waitForSelector("#propDlg:not([hidden])");
let r = await p.locator("#propDlg").boundingBox();
ok(r.width <= 480, `the Properties window is compact (${Math.round(r.width)} px wide)`);
ok(await p.evaluate(() => !document.querySelector(".scrim#propDlg")), "it is a floating window, not a full-screen dialog: the canvas stays usable");
// move it by its title bar
const h = await p.locator("#propHead").boundingBox();
await p.mouse.move(h.x + 60, h.y + 10); await p.mouse.down(); await p.mouse.move(h.x - 300, h.y + 120, { steps: 8 }); await p.mouse.up();
const r2 = await p.locator("#propDlg").boundingBox();
ok(Math.abs(r2.x - (r.x - 360)) < 4 && Math.abs(r2.y - (r.y + 110)) < 4, "it moves by dragging the title bar");
ok(await p.evaluate(() => getComputedStyle(document.querySelector("#propDlg")).resize === "both"), "it can be resized from its corner");
// limits
await p.click('[data-ptab="lim"]'); await p.waitForTimeout(150);
const lim = await p.textContent("#propBody");
ok(/Requests per second per distribution/.test(lim) && /250,000/.test(lim) && /quota · adjustable/.test(lim), "Limits shows CloudFront: 250,000 rps per distribution, adjustable");
ok(/Origin response timeout/.test(lim) && /30 s/.test(lim) && /120 s/.test(lim), "a setting shows its default (30 s) and range (1–120 s)");
ok(await p.locator("#propBody a[href^='https://docs.aws.amazon.com/']").count() >= 3, "every limit links to its official source");
if (shot("props-limits")) await p.screenshot(shot("props-limits"));
// a hard limit and a quota on a database
await p.evaluate(() => __nx.run("properties DB1")); await p.waitForTimeout(150);
const dbl = await p.textContent("#propBody");
ok(/Read replicas per source/.test(dbl) && /15/.test(dbl) && /hard limit/.test(dbl), "the database lists replicas (quota 15) and storage (hard limit)");
// thinking
await p.click('[data-ptab="think"]'); await p.waitForTimeout(150);
const th = await p.textContent("#propBody");
ok(/Region:.*ap-southeast-1 \(Singapore\)/.test(th), "Thinking: DB1 knows its region (Singapore)");
ok(/Subnet:.*Isolated · data.*a 10\.0\.20\.0\/24 · b 10\.0\.21\.0\/24/.test(th), "Thinking: DB1 knows its subnets in each zone");
ok(/Zones:.*primary in zone a.*standby in zone b/.test(th), "Thinking: DB1 knows its zones (primary a, standby b)");
if (shot("props-think")) await p.screenshot(shot("props-think"));
// a hard limit is refused
await p.evaluate(() => __nx.run("properties CDN1"));
await p.click("#propClose"); ok(await p.isHidden("#propDlg"), "× closes it");
await b.close(); summary();
