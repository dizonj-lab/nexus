// Browser check: New design → Start from a blank canvas; unsaved work is confirmed first; the Action Guard
// does not block starting over or creating a new design.  Run: node poc/tests/blank.e2e.mjs
import { open, newDesign, ok, summary, consoleText } from "./lib.mjs";
const { b, p } = await open();
const count = () => p.evaluate(() => Object.keys(__nx.S.nodes).length);
const n0 = await count(); ok(n0 > 5, `the sample design is loaded (${n0} components, not saved as a version)`);
await p.click("#ndBtn"); await p.click('#ndDlg [data-nd="blank"]');
ok(await p.isVisible("#unsDlg"), "Start from a blank canvas asks first: the current design is not saved");
ok(/not saved as a version/.test(await p.textContent("#unsText")), "the prompt says why: " + (await p.textContent("#unsText")));
await p.click("#unsCancel"); ok(await count() === n0, "Cancel keeps the design as it is");
await p.click("#ndBtn"); await p.click('#ndDlg [data-nd="blank"]'); await p.click("#unsSave"); await p.waitForTimeout(300);
const st = await p.evaluate(() => ({ n: Object.keys(__nx.S.nodes).length, e: __nx.S.edges.length, v: __nx.S.versions.length, name: __nx.S.project, gt: __nx.S.gt.length }));
ok(st.v === 1, "Save as a version, then continue: the old design is saved as v1");
ok(st.n === 0 && st.e === 0 && st.name === "Untitled design", "the canvas is blank (no components, no flows), named Untitled design");
ok(st.gt > 0, "principles and ground truth are kept");
ok(!(await p.isVisible("#guard")), "the Action Guard does not review (or block) starting over");
await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
ok(await count() === n0, "Ctrl+Z brings the previous design back");
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
