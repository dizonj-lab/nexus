// Browser check: New design → Start from a blank canvas; the open design is kept under Recent designs; the Action Guard
// does not block starting over or creating a new design.  Run: node poc/tests/blank.e2e.mjs
import { open, newDesign, ok, summary, consoleText } from "./lib.mjs";
const { b, p } = await open();
const count = () => p.evaluate(() => Object.keys(__nx.S.nodes).length);
const n0 = await count(); ok(n0 > 5, `the sample design is loaded (${n0} components, not saved as a version)`);
await p.click("#ndBtn"); await p.click('#ndDlg [data-nd="blank"]');
await p.waitForTimeout(300);
ok(!(await p.isVisible("#unsDlg")), "Start from a blank canvas does not ask to save: the open design is kept under Recent designs");
const st = await p.evaluate(() => ({ n: Object.keys(__nx.S.nodes).length, e: __nx.S.edges.length, v: __nx.S.versions.length, name: __nx.S.project, gt: __nx.S.gt.length }));
ok(st.n === 0 && st.e === 0 && st.name === "Untitled design" && st.v === 0, "the canvas is blank (no components, no flows, no versions), named Untitled design");
ok(st.gt > 0, "principles and ground truth are kept");
ok(!(await p.isVisible("#guard")), "the Action Guard does not review (or block) starting over");
ok(await p.evaluate((n0) => JSON.parse(localStorage.getItem("nexus.library.v1")).some((x) => { const d = localStorage.getItem("nexus.design." + x.id); return d && Object.keys(JSON.parse(d).nodes).length === n0; }), n0), "the previous design is kept with all its components");
await p.evaluate(() => { const x = JSON.parse(localStorage.getItem("nexus.library.v1")).find((d) => d.count > 0); __nx.openDoc(x.id); }); await p.waitForTimeout(300);
ok(await count() === n0, "Designs → open brings the previous design back");
await p.keyboard.press("Control+y").catch(() => {}); await p.evaluate(() => __nx.run("blank canvas")); await p.waitForTimeout(200);
if (await p.isVisible("#unsDlg")) await p.click("#unsDiscard");
ok(await count() === 0, 'the console command "blank canvas" does the same');
await p.evaluate(() => __nx.run("blank canvas")); await p.waitForTimeout(150);
ok(!(await p.isVisible("#unsDlg")), "an empty canvas has nothing to lose: no prompt");
// build on it
await p.evaluate(() => __nx.run('add service named "Orders"')); await p.waitForTimeout(200); if (await p.isVisible("#guard")) await p.click("#gApply"); await p.waitForTimeout(150);
ok(await count() >= 1, "components can be added to the blank canvas");
// a saved design: the wizard does not ask, and the Action Guard reviews instead of blocking
await p.evaluate(() => __nx.run('save "orders draft"')); await p.waitForTimeout(150);
await p.click("#ndBtn"); await p.fill('[data-ndf="services"]', "claims"); for (let i = 0; i < 4; i++) { const n = p.locator('#ndDlg [data-nd="next"]'); if (await n.count()) await n.click(); }
await p.click('#ndDlg [data-nd="create"]'); await p.waitForTimeout(300);
ok(!(await p.isVisible("#unsDlg")), "saved work: no prompt before the new design");
ok(await p.isVisible("#guard") && !/BLOCKED|HIGH RISK/.test(await p.textContent("#gVerdict")), "the new design is reviewed, not blocked: " + (await p.textContent("#gVerdict")).slice(0, 60));
ok(!(await p.isDisabled("#gApply")) && !(await p.isVisible("#gDownWrap")), "Implement is available; no resize warnings for a new design");
await p.click("#gApply"); await p.waitForTimeout(300);
ok(await count() > 5, "the new design is created");
await b.close(); summary();
