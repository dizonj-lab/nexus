// Browser check: the Route 53 pack flags a failover slower than the RTO, and its fix (fast checks, 10 s TTL) clears it.
// Run: node poc/tests/dns.e2e.mjs
import { open, ok, summary } from "./lib.mjs";
const { b, p } = await open();
await p.click("#ndBtn"); await p.fill('[data-ndf="services"]', "claims");
await p.locator('#ndDlg [data-nd="next"]').click();
await p.fill('[data-ndf="rto"]', "0.02"); await p.dispatchEvent('[data-ndf="rto"]', "change");
await p.click('#ndDlg [data-nd="res"][data-k="ap"]');
for (let i = 0; i < 3; i++) { const n = p.locator('#ndDlg [data-nd="next"]'); if (await n.count()) await n.click(); }
await p.click('#ndDlg [data-nd="create"]'); await p.waitForSelector("#guard:not([hidden])");
if (await p.isDisabled("#gApply")) await p.fill("#gJust", "Automated test design for the DNS rules."); await p.click("#gApply"); await p.waitForTimeout(500);
const f = await p.evaluate(() => __nx.findings.find((x) => /failover-slower-than-rto/.test(x.key)));
ok(f && /about 150 s; the RTO is 60 s/.test(f.title), "multi-region with a 1-minute RTO: " + (f && f.title));
ok(f && /30 s \(90 s\)|3 failed checks 30 s apart/.test(f.why) && /about 40 s/.test(f.why), "it explains detection (3 × 30 s) + TTL, and that the fix gets to about 40 s");
ok(f && f.fix && f.fix.label === "Use fast health checks and a 10 s TTL", "it offers the fix");
const i = await p.evaluate(() => __nx.findings.findIndex((x) => /failover-slower-than-rto/.test(x.key)));
await p.evaluate((i) => document.querySelector(`[data-fix="${i}"]`)?.click(), i); await p.waitForTimeout(300);
if (await p.isVisible("#guard")) await p.click("#gApply"); await p.waitForTimeout(300);
const d = await p.evaluate(() => { const n = Object.values(__nx.S.nodes).find((n) => n.type === "dns"); return { iv: n.hcInterval, ttl: n.ttl, left: __nx.findings.filter((x) => /dns\./.test(x.key)).length }; });
ok(d.iv === 10 && d.ttl === 10 && d.left === 0, "after the fix: 10 s checks, 10 s TTL, no DNS findings left");
await b.close(); summary();
