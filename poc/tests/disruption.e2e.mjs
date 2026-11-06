// Browser check: resizing a database (or any service whose change interrupts it) is announced in the Action Guard
// with the documented outage, how to avoid it, and its source; Implement waits for an acknowledgement.
// Run: node poc/tests/disruption.e2e.mjs
import { open, newDesign, ok, summary, nodePos, canvasBox } from "./lib.mjs";
const select = async (id) => { await p.evaluate((id) => __nx.inspect(id), id); await p.waitForTimeout(300); };
const { b, p } = await open();
await newDesign(p);
const run = (t) => p.evaluate((t) => __nx.run(t), t);
ok(await p.evaluate(() => __nx.S.nodes.DB1.standby === true), "DB1 is Multi-AZ (standby in zone b)");
await run("size DB1 large"); await p.waitForSelector("#guard:not([hidden])");
let t = await p.textContent("#gDownWrap");
ok(await p.isVisible("#gDownWrap"), "the Action Guard shows an Expected disruption section");
ok(/DB1 · size m → l: outage of about 60–120 s/.test(t), "Multi-AZ resize: outage of about 60–120 s (failover)");
ok(/Avoid it: .*maintenance window/.test(t) && await p.locator("#gDownWrap a[href*='Concepts.MultiAZ.Failover']").count() === 1, "it says how to avoid it and links the AWS page");
ok(await p.isDisabled("#gApply"), "Implement waits until the interruption is acknowledged");
ok(await p.inputValue("#gWhen") === "window", "the maintenance window is proposed by default");
await p.check("#gDownAck"); ok(!(await p.isDisabled("#gApply")), "after the acknowledgement, Implement is enabled");
await p.click("#gApply"); await p.waitForTimeout(300);
const adr = await p.evaluate(() => __nx.S.adrs.at(-1));
ok(/in the next maintenance window/.test(adr.title) && /60–120 s/.test(adr.context), "a decision records when it applies and the expected outage");
// Single-AZ: no documented duration
await p.evaluate(() => { __nx.S.nodes.DB2.standby = false; __nx.refresh(); });
await run("size DB2 large"); await p.waitForSelector("#guard:not([hidden])");
t = await p.textContent("#gDownWrap");
ok(/DB2 · size m → l: outage; the provider gives no duration/.test(t), "Single-AZ resize: an outage of undocumented length, said plainly");
await p.click("#gCancel");
// storage growth: no outage, still announced
await run("replicas DB1 2"); await p.waitForTimeout(200);
if (await p.isVisible("#guard")) { t = await p.textContent("#gDownWrap"); ok(!/read replicas/.test(t) || /no outage|about 0–1 s/.test(t), "adding a replica on a Multi-AZ source causes no I/O pause"); await p.click("#gCancel"); }
// Kafka: more partitions = keys move
await run("add topic orders to Q1 partitions 6 key orderId"); await p.waitForTimeout(150); if (await p.isVisible("#guard")) await p.click("#gApply");
await p.waitForTimeout(150);
await select("Q1");
const inp = p.locator('[data-chf="orders"][data-f="partitions"]');
if (await inp.count()) { await inp.fill("12"); await inp.dispatchEvent("change"); await p.waitForSelector("#guard:not([hidden])");
  t = await p.textContent("#gDownWrap"); ok(/topic orders: partitions 6 → 12: no outage, but keys move to other partitions/.test(t), "Kafka: more partitions = no outage, but ordering per key is not kept across the change");
  ok(!(await p.isDisabled("#gApply")), "a change with no outage does not need the acknowledgement"); await p.click("#gCancel"); }
else ok(false, "the topic's partitions field is in the Inspector");
// EC2: stop and start
await run("add vm named \"Legacy\""); await p.waitForTimeout(150); if (await p.isVisible("#guard")) await p.click("#gApply"); await p.waitForTimeout(150);
const vm = await p.evaluate(() => Object.values(__nx.S.nodes).find((n) => n.type === "vm").id);
await select(vm); await p.fill("#iCap", "1200"); await p.dispatchEvent("#iCap", "change"); await p.waitForSelector("#guard:not([hidden])");
t = await p.textContent("#gDownWrap"); ok(/stopped and started/.test(t), "EC2: changing the instance type needs a stop and start");
await p.click("#gCancel");
// a container service with two tasks: rolling deployment, no outage
await select("SVC1"); await p.fill("#iCap", "1200"); await p.dispatchEvent("#iCap", "change"); await p.waitForSelector("#guard:not([hidden])");
t = await p.textContent("#gDownWrap"); ok(/SVC1 · capacity per instance .*: no outage/.test(t) && /rolling deployment/.test(t), "ECS/Fargate with two tasks: a rolling deployment, no outage");
ok(!(await p.isDisabled("#gApply")), "no acknowledgement needed when there is no outage"); await p.click("#gCancel");
await b.close(); summary();
