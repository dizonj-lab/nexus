// Browser check: the network dialog creates subnets, security groups and application groups (v0.3.1–v0.3.18 wrote its
// form into the hidden New design dialog, which shared its element IDs, so nothing could be created).
// Run: node poc/tests/net.e2e.mjs
import { open, newDesign, ok, summary } from "./lib.mjs";
const { b, p } = await open({ width: 1500, height: 950 });
await newDesign(p, { services: "orders, payments" });
const apply = async () => { await p.waitForTimeout(200); if (await p.isVisible("#guard")) { if (await p.isDisabled("#gApply") && await p.isVisible("#gJust")) await p.fill("#gJust", "Test: network groups."); if (await p.isEnabled("#gApply")) await p.click("#gApply"); else await p.click("#gCancel"); await p.waitForTimeout(250); } };
const nets = () => p.evaluate(() => (__nx.S.nets || []).map((x) => x.name));
const groups = () => p.evaluate(() => (__nx.S.groups || []).map((g) => `${g.kind}:${g.name}:${g.members.join("+")}`));

// 1. subnet from ＋ Add component
await p.click("#addBtn"); await p.click('#palette [data-t="__subnet"]'); await p.waitForTimeout(150);
ok(await p.isVisible("#ntName"), "＋ Add component → Subnet opens the network dialog with its form");
ok((await p.textContent("#ntTitle")) === "New subnet", "the dialog title says New subnet");
await p.fill("#ntName", "app-x"); await p.fill("#ntCidr", "10.0.40.0/24");
await p.check('#ntBody [data-mem="SVC1"]'); await p.click("#ntOk"); await apply();
ok((await nets()).includes("app-x") && await p.evaluate(() => { const x = __nx.S.nets.find((n) => n.name === "app-x"); return __nx.S.nodes.SVC1.net === x.id; }), "Create adds subnet app-x and places SVC1 in it");
ok(!(await p.isVisible("#ndDlg")), "the New design dialog stays closed");

// 2. security group from the Inspector
await p.evaluate(() => __nx.inspect("SVC1")); await p.waitForTimeout(250);
await p.click('[data-newgrp="sg"]'); await p.waitForTimeout(150);
ok((await p.textContent("#ntTitle")) === "New security group", "+ Security group opens the dialog titled New security group");
await p.fill("#ntName", "sg-orders"); await p.click("#ntOk"); await apply();
ok((await groups()).includes("sg:sg-orders:SVC1"), "Create adds security group sg-orders with SVC1 as a member");

// 3. application group
await p.evaluate(() => __nx.inspect("SVC2")); await p.waitForTimeout(250);
await p.click('[data-newgrp="ag"]'); await p.waitForTimeout(150);
ok((await p.textContent("#ntTitle")) === "New application group", "+ App group opens the dialog titled New application group");
await p.fill("#ntName", "Payments"); await p.fill("#ntTeam", "Payments squad"); await p.click("#ntOk"); await apply();
ok((await groups()).includes("ag:Payments:SVC2"), "Create adds application group Payments with SVC2");

// 4. edit and delete
await p.evaluate(() => __nx.inspect("SVC2")); await p.waitForTimeout(250);
await p.click('.gchip.ag'); await p.waitForTimeout(150);
ok((await p.textContent("#ntTitle")) === "Edit application group" && await p.isVisible("#ntDel"), "clicking the group chip opens Edit with Delete");
await p.click("#ntDel"); await apply();
ok(!(await groups()).some((g) => g.startsWith("ag:Payments")), "Delete removes the group");
await b.close(); summary();
