/* NEXUS packs runtime (P1, in the browser).
 * Reads the knowledge packs (facts, placement rules, DNS rules) and answers three questions for the canvas:
 *   1. What does this component know? (facts with default, minimum, maximum, adjustable, source)
 *   2. Can it go there? (subnet, zone, region placement: best / ok / poor / no, with pros, cons and why)
 *   3. What does it conclude about itself? (findings with the pack@version and the facts they rest on)
 * Deterministic: the same design and packs always give the same answers. No network, no model.
 * The design passed in is plain data: {provider, nodes, edges, nets, zones, req, load, managed, ipsNeeded, multiRegion}.
 * Loaded by the canvas (inlined by packs/build.mjs) and by the Node tests (packs/tests). */
(function (root) {
  "use strict";
  let B = { packs: [] };
  const api = {};
  api.load = (bundle) => { B = bundle || { packs: [] }; return api; };
  api.bundle = () => B;
  api.version = () => B.built || "dev";
  // provider product catalogue (from packs/catalog): find products by name for the palette and the console
  // availability zones in a region, from the provider's regions page; null when unknown
  api.regionAZs = (prov, id) => { const r = B.catalog && B.catalog[prov] && B.catalog[prov].regions; return (r && r[id]) || null; };
  api.catalog = (prov) => (B.catalog && B.catalog[prov] && B.catalog[prov].products) || [];
  const norm = (t) => String(t || "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/\b(amazon|aws|for|the|service|managed)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  api.matchProduct = (prov, q, min = 80) => { const n = norm(q); if (!n) return null; let best = null, bs = 0;
    for (const p of api.catalog(prov)) { const nm = norm(p.n), abbr = ((/\(([^)]+)\)/.exec(p.n) || [])[1] || "").toLowerCase(); let sc = nm === n || abbr === n || p.i === n ? 100 : n.split(" ").every((w) => nm.split(" ").includes(w)) ? 60 : 0; if (sc && p.pg) sc += 2; if (sc > bs) { bs = sc; best = p; } }
    return bs >= min ? best : null; };
  api.findProducts = (prov, q, max = 30) => { const n = norm(q); if (!n) return []; const words = n.split(" ");
    return api.catalog(prov).map((p) => { const nm = norm(p.n), abbr = (/\(([^)]+)\)/.exec(p.n) || [])[1] || ""; let sc = 0;
      if (nm === n || abbr.toLowerCase() === n || p.i === n) sc = 100; else if (nm.startsWith(n)) sc = 80; else if (words.every((w) => nm.includes(w))) sc = 60; else if (words.every((w) => (nm + " " + norm(p.s)).includes(w))) sc = 30;
      if (sc && p.pg) sc += 5; if (sc && p.t) sc += 3; return { p, sc }; }).filter((x) => x.sc).sort((a, b) => b.sc - a.sc || a.p.n.localeCompare(b.p.n)).slice(0, max).map((x) => x.p); };
  const tag = (p) => `${p.id}@${p.version}`;
  const core = () => B.packs.find((p) => p.id === "core.placement") || { types: {}, families: {}, tiers: {}, zones: { default: { fit: "ok", pros: [], cons: [] }, rules: {} }, reserved_ips: {} };
  const typeOk = (t, type) => Array.isArray(t) ? t.includes(type) : t === type;
  const packsFor = (type, prov) => B.packs.filter((p) => p.applies_to && typeOk(p.applies_to.type, type) && (p.applies_to.provider === prov || p.applies_to.provider === "*") && p.id !== "core.placement");
  const isFlow = (e) => !e.kind || e.kind === "flow";

  /* ---------- 1. facts ---------- */
  api.packsFor = packsFor;
  // Facts for a component; a fact with a "flavor" applies only to that product (for example SNS or EventBridge).
  api.facts = (type, prov, flavor) => packsFor(type, prov).flatMap((p) => (p.facts || []).filter((f) => !f.flavor || !flavor || f.flavor === flavor).map((f) => ({ ...f, pack: tag(p) })));
  api.fact = (type, prov, id) => api.facts(type, prov).find((f) => f.id === id) || null;
  // The provider limit the simulator uses for a managed component (requests per second), when a pack states one.
  api.simQuota = (type, prov, flavor) => {
    const f = api.facts(type, prov, flavor).find((x) => x.sim === "rps" && x.default != null && (!x.flavor || x.flavor === flavor));
    return f ? { rps: f.default * (f.rps_per_unit || 1), fact: f } : null;
  };
  // Is a value inside a fact's range? Returns null when it is, or why not.
  api.outOfRange = (f, v) => {
    if (v == null || v === "" || !isFinite(+v)) return null;
    v = +v;
    if (f.min != null && v < f.min) return { hard: true, why: `${f.label}: ${v} is below the minimum of ${f.min} ${f.unit}.` };
    if (f.max != null && v > f.max) return f.adjustable ? { hard: false, why: `${f.label}: ${v} is above the default maximum of ${f.max} ${f.unit}. It is adjustable: request an increase from the provider first.` } : { hard: true, why: `${f.label}: ${v} is above the hard limit of ${f.max} ${f.unit}. It cannot be raised.` };
    if (f.kind === "quota" && f.default != null && v > f.default) return { hard: false, why: `${f.label}: ${v} is above the default quota of ${f.default} ${f.unit}. Request an increase from the provider (for AWS, in Service Quotas) before relying on it.` };
    return null;
  };

  /* ---------- 2. placement ---------- */
  const internetFacing = (d, id) => d.edges.some((e) => e.to === id && isFlow(e) && d.nodes[e.from] && ["user", "cdn", "waf", "dns"].includes(d.nodes[e.from].type) && d.nodes[e.from].origin !== "corp");
  api.internetFacing = internetFacing;
  api.usableIPs = (cidr, prov) => {
    const m = /\/(\d{1,2})$/.exec(cidr || "");
    if (!m) return null;
    const r = core().reserved_ips[prov] ?? 5;
    return Math.max(0, 2 ** (32 - +m[1]) - r);
  };
  const netAzs = (net) => (net.azs && net.azs.length ? net.azs : net.az ? [String(net.az).slice(-1)] : []);
  const cidrOf = (net) => net.cidr || (net.cidrs && Object.values(net.cidrs)[0]) || "";
  const label = (d, n) => `${n.id} (${n.name || n.type})`;
  const out = (pl, r) => ({ fit: r.fit || "ok", why: r.why || "", pros: r.pros || [], cons: r.cons || [], pack: tag(pl) });

  api.placeSubnet = (d, id, netId) => {
    const pl = core(), n = d.nodes[id], net = (d.nets || []).find((x) => x.id === netId);
    if (!n || !net) return { fit: "no", why: "Unknown component or subnet.", pros: [], cons: [] };
    const t = pl.types[n.type] || {}, managed = !!(d.managed && d.managed[id]);
    if (t.subnet === false && !(t.self_hosted && !managed)) return out(pl, { fit: "no", why: t.why });
    if (net.region && n.region && net.region !== n.region)
      return out(pl, { fit: "no", why: `${net.name} is in region ${net.region} and ${n.id} runs in region ${n.region}. A subnet belongs to one region: move ${n.id} to the other region first (drop it on that region, or use its Region setting).` });
    const fam = t.tiers ? t : pl.types[pl.families[n.type]] || pl.types._compute;
    let r = (fam.tiers || {})[net.tier] || { fit: "ok", pros: [], cons: [] };
    if (r.if_internet_facing && internetFacing(d, id)) r = { ...r, ...r.if_internet_facing };
    if (r.fit === "no") return out(pl, r);
    // address space: each zone's subnet must hold that zone's share of the instances
    const cap = api.usableIPs(cidrOf(net), d.provider), azs = Math.max(1, netAzs(net).length);
    if (cap != null && d.ipsNeeded) {
      const per = (x) => Math.ceil((d.ipsNeeded[x] || 1) / azs);
      const used = Object.values(d.nodes).filter((m) => m.net === netId && m.id !== id).reduce((a, m) => a + per(m.id), 0), need = per(id);
      if (used + need > cap) return out(pl, { fit: "no", why: `${net.name} (${cidrOf(net)}) has ${cap} usable addresses per zone (${(pl.reserved_ips[d.provider] ?? 5)} are reserved by the provider); ${used} are taken and ${n.id} needs ${need}. Use a larger subnet or another one.` });
    }
    return out(pl, r);
  };

  api.placeZone = (d, id, z) => {
    const pl = core(), n = d.nodes[id], t = pl.types[n && n.type] || {};
    if (!n) return { fit: "no", why: "Unknown component.", pros: [], cons: [] };
    if (!(d.zones || []).includes(z)) return out(pl, { fit: "no", why: `The region uses zones ${(d.zones || []).join(", ")}; there is no zone ${z}.` });
    if (t.subnet === false && !(t.self_hosted && !(d.managed && d.managed[id]))) return out(pl, { fit: "no", why: t.az === false ? t.why.replace(/Reach it.*$/, "It cannot be placed in one zone.") : t.why });
    const net = (d.nets || []).find((x) => x.id === n.net);
    if (net && netAzs(net).length && !netAzs(net).includes(z)) return out(pl, { fit: "no", why: `${n.id} is in subnet ${net.name}, which has no subnet in zone ${z}. Add zone ${z} to the subnet first.` });
    const r = (pl.zones.rules || {})[n.type] || pl.zones.default;
    return out(pl, r);
  };

  api.placeRegion = (d, id, R) => {
    const pl = core(), n = d.nodes[id], t = pl.types[n && n.type] || {};
    if (!n) return { fit: "no", why: "Unknown component.", pros: [], cons: [] };
    if (t.region === false) return out(pl, { fit: "no", why: t.why });
    return out(pl, { fit: "ok", pros: [`Runs in region ${R}`], cons: ["Calls to components left in the other region cross regions: tens of milliseconds and data-transfer charges each"] });
  };

  /* ---------- 3. findings ---------- */
  const CHECKS = {
    // Failover or latency routing between regions needs a health signal, or users keep going to a dead region.
    "dns.failover-health": (d, n) => d.multiRegion && ["failover", "latency", "weighted"].includes(n.policy) && n.health === false
      ? { title: `${n.id} steers between regions without health checks`, why: `With ${n.policy} routing and no health check, ${n.id} keeps sending users to a region that is down until someone changes the records by hand.`, fix: { set: { health: true }, label: "Turn on health checks" } } : null,
    // Detection (interval × threshold) plus the TTL must fit inside the RTO.
    "dns.failover-rto": (d, n, p) => {
      if (!d.multiRegion || n.health === false || !d.req || !d.req.rto) return null;
      const f = (id) => p.facts.find((x) => x.id === id) || {};
      const iv = +(n.hcInterval ?? f("hc_interval").default ?? 30), th = +(n.hcThreshold ?? f("hc_threshold").default ?? 3), ttl = +(n.ttl ?? f("ttl").default ?? 60);
      const total = iv * th + ttl, rto = d.req.rto * 60;
      if (total <= rto) return null;
      const fast = 10 * th + Math.min(ttl, 10);
      return { title: `${n.id} fails over in about ${total} s; the RTO is ${rto} s`, why: `Route 53 marks a region unhealthy after ${th} failed checks ${iv} s apart (${iv * th} s), then clients wait for the ${ttl} s TTL to expire: about ${total} s before traffic moves. ${fast <= rto ? `Fast checks (10 s) and a 10 s TTL bring it to about ${fast} s.` : `Even fast checks and a 10 s TTL take about ${fast} s, which is still longer than the RTO: use an active-active design or a lower failure threshold.`}`, sev: fast <= rto ? "warn" : "crit", fix: fast <= rto ? { set: { hcInterval: 10, ttl: Math.min(ttl, 10) }, label: "Use fast health checks and a 10 s TTL" } : null, detail: { detection_s: iv * th, ttl_s: ttl, failover_s: total, rto_s: rto } };
    },
    // Health checkers probe from the internet: a private endpoint cannot answer them.
    "dns.probe-private": (d, n) => {
      if (n.hcType !== "probe") return null;
      const priv = d.edges.filter((e) => e.from === n.id && isFlow(e) && d.nodes[e.to] && !["lb", "cdn", "gw", "waf"].includes(d.nodes[e.to].type)).map((e) => e.to);
      return priv.length ? { title: `${n.id} probes private endpoints (${priv.join(", ")})`, why: "Route 53 health checkers probe from the internet and cannot reach private addresses, so the check always fails. Use a CloudWatch alarm on a heartbeat metric as the health check instead.", fix: { set: { hcType: "alarm" }, label: "Use a CloudWatch alarm health check" } } : null;
    },
  };
  /* ---------- disruption: what a change does to availability ---------- */
  // change: vertical | replicas | storage | shards | brokers; when: single | multiaz | cluster | plus (optional)
  api.disruption = (type, prov, change, flavor, when) => {
    const fs = api.facts(type, prov, flavor).filter((f) => f.change === change);
    return fs.find((f) => f.when && f.when === when) || fs.find((f) => !f.when) || (when ? null : fs[0]) || null;
  };
  /* ---------- messaging: channels, producers, consumers, subscriptions ---------- */
  // d.msg[id] = {kind, flavor, region, brokers, channels:[...], pubs:[...], subs:[...]} (built by the canvas)
  const fact = (p, id) => (p.facts || []).find((x) => x.id === id);
  const MSG = {
    "msg.order-without-key": (m) => m.pubs.filter((p) => { const c = m.channels.find((x) => x.id === p.ch); return c && c.ordered && !p.key; }).map((p) => ({ on: p.from, title: `${p.from} publishes to ${p.ch} without a key, but ${p.ch} needs ordering`, why: m.kind === "topic" ? `Without a key Kafka spreads messages over all partitions, so events for the same entity can be read out of order. Set a key such as the entity ID.` : `FIFO ordering holds per message group: set a message group ID (the key), such as the entity ID.`, edge: { from: p.from, to: m.id } })),
    "msg.parallel-breaks-order": (m) => m.subs.filter((s) => { const c = m.channels.find((x) => x.id === s.ch); return c && c.ordered && s.order === "parallel"; }).map((s) => ({ on: s.to, title: `${s.to} processes ${s.ch} in parallel, which breaks its ordering`, why: "Ordering holds only if each key (or partition) is processed one message at a time. Process in order per key, or drop the ordering requirement.", edge: { from: m.id, to: s.to }, fix: { set: { order: "per-key" }, label: "Process in order per key" } })),
    "msg.no-idempotency": (m) => m.subs.filter((s) => s.ack === "after" && !s.idem && s.toType !== "queue").map((s) => ({ on: s.to, title: `${s.to} can receive the same message twice but does not deduplicate`, why: `Acknowledging after processing gives at-least-once delivery: after a crash, a timeout or a rebalance, the message comes again. Without idempotent processing (dedup on the event ID) ${s.to} applies it twice.`, edge: { from: m.id, to: s.to }, fix: { set: { idem: true }, label: "Make processing idempotent (dedup on event ID)" } })),
    "msg.at-most-once": (m) => m.subs.filter((s) => s.ack === "before").map((s) => ({ on: s.to, title: `${s.to} acknowledges before processing: messages are lost on a crash`, why: "At-most-once delivery: if the consumer fails after acknowledging, the message is gone. Acknowledge after processing and make processing idempotent.", edge: { from: m.id, to: s.to }, fix: { set: { ack: "after" }, label: "Acknowledge after processing" } })),
    "msg.no-dlq": (m) => m.subs.filter((s) => !s.dlq && s.toType !== "queue").map((s) => ({ on: s.to, title: `${m.id} → ${s.to} has no dead-letter queue`, why: m.kind === "notif" || m.kind === "bus" ? "A push delivery that keeps failing is dropped after its retries. A dead-letter queue keeps it for inspection and redrive." : "A message that always fails is retried forever or blocks its partition. After a few attempts it should move to a dead-letter queue.", edge: { from: m.id, to: s.to }, fix: { set: { dlq: true }, label: "Add a dead-letter queue" } })),
    "msg.unlimited-retries": (m) => m.subs.filter((s) => s.retries === "unlimited").map((s) => ({ on: s.to, title: `${s.to} retries forever`, why: "A poison message is retried without end: it blocks ordered processing and wastes capacity. Limit the retries and send failures to the dead-letter queue.", edge: { from: m.id, to: s.to }, fix: { set: { retries: 5, dlq: true }, label: "Retry 5 times, then dead-letter" } })),
    "msg.fire-and-forget": (m) => m.pubs.filter((p) => ["acks0", "acks1", "unconfirmed"].includes(p.delivery)).map((p) => ({ on: p.from, title: `${p.from} does not wait for the broker to confirm`, why: p.delivery === "acks1" ? "acks=1 loses messages when the leader fails before the replicas copy them. Use acks=all with the idempotent producer." : "Unconfirmed sends are lost silently when the broker is busy or a connection drops.", edge: { from: p.from, to: m.id }, fix: { set: { delivery: m.kind === "topic" ? "idempotent" : "confirmed" }, label: m.kind === "topic" ? "acks=all, idempotent producer" : "Wait for the broker's confirmation" } })),
    "msg.no-outbox": (m) => m.pubs.filter((p) => p.writesDb && !p.outbox).map((p) => ({ on: p.from, title: `${p.from} writes to its database and publishes, without an outbox`, why: `If ${p.from} saves and then fails before publishing (or publishes and then the save fails), the database and the events disagree. Write the event to an outbox table in the same transaction and publish from there.`, edge: { from: p.from, to: m.id }, fix: { set: { outbox: true }, label: "Use a transactional outbox" } })),
    "msg.idle-consumers": (m) => m.kind !== "topic" ? [] : Object.values(m.subs.reduce((g, s) => { const k = s.ch + "|" + s.group; (g[k] = g[k] || { ch: s.ch, group: s.group, n: 0, to: s.to }).n += s.consumers; return g; }, {})).filter((g) => { const c = m.channels.find((x) => x.id === g.ch); return c && g.n > c.partitions; }).map((g) => { const c = m.channels.find((x) => x.id === g.ch); return { on: m.id, title: `Group ${g.group} has ${g.n} consumers for ${c.partitions} partitions of ${g.ch}`, why: `A partition is read by one consumer of a group at a time, so ${g.n - c.partitions} consumer(s) sit idle. Add partitions or run fewer consumers.`, sev: "info" }; }),
    "msg.replication": (m, p) => m.kind !== "topic" ? [] : m.channels.filter((c) => c.rf < 3 || c.minIsr < 2 || c.minIsr >= c.rf).map((c) => ({ on: m.id, title: `Topic ${c.id}: replication factor ${c.rf}, min.insync.replicas ${c.minIsr}`, why: `With a replication factor below 3, a rolling update or one broker failure can take partitions offline or lose data; min.insync.replicas should be 2 (and below the replication factor) so acks=all survives one broker loss.`, chan: { id: c.id, set: { rf: 3, minIsr: 2 } }, fix: { chan: { id: c.id, set: { rf: 3, minIsr: 2 } }, label: "Replication factor 3, min.insync.replicas 2" }, facts: ["rf", "min_isr"].map((x) => fact(p, x)).filter(Boolean) })),
    "msg.partitions-per-broker": (m, p) => { if (m.kind !== "topic" || !m.brokers) return []; const f = fact(p, "partitions_per_broker"); if (!f) return []; const per = m.channels.reduce((a, c) => a + c.partitions * c.rf, 0) / m.brokers; return per > f.default ? [{ on: m.id, title: `${m.id} carries about ${Math.round(per)} partition replicas per broker`, why: `The recommendation for this broker size is ${f.default} (incl. replicas); above ${f.max} configuration and broker-size updates are blocked. Add brokers or use fewer partitions.`, sev: per > f.max ? "crit" : "warn", facts: [f] }] : []; },
    "msg.lambda-direct": (m) => m.kind !== "notif" ? [] : m.subs.filter((s) => s.protocol === "lambda" && s.rate > 100).map((s) => ({ on: s.to, title: `${m.id} pushes about ${Math.round(s.rate)} messages/s straight to ${s.to}`, why: "Each push is a function invocation: bursts hit the concurrency limit and throttled deliveries are retried or dropped. Put a queue between them (topic → queue → function) to buffer bursts and control concurrency.", edge: { from: m.id, to: s.to }, fix: { insertQueue: { from: m.id, to: s.to }, label: "Insert a queue (topic → queue → function)" } })),
    "msg.insecure-http": (m) => m.subs.filter((s) => s.protocol === "http").map((s) => ({ on: s.to, title: `${m.id} delivers to ${s.to} over plain HTTP`, why: "Messages travel unencrypted and the endpoint cannot be verified. Use HTTPS and verify the message signature at the endpoint.", sev: "crit", edge: { from: m.id, to: s.to }, fix: { set: { protocol: "https" }, label: "Use HTTPS" } })),
    "msg.no-filter": (m) => (m.kind === "notif" || m.kind === "bus") && m.subs.length >= 2 && !m.subs.some((s) => s.filter) ? [{ on: m.id, title: `${m.id}: every subscriber receives every message`, why: "With no filter policy, each subscriber gets all messages and must discard the ones it does not need: wasted invocations and cost. Add a filter on the message attributes (or an event pattern).", sev: "info" }] : [],
    "msg.fifo-protocol": (m, p) => m.kind !== "notif" || !m.channels.some((c) => c.fifo) ? [] : m.subs.filter((s) => m.channels.find((c) => c.id === s.ch && c.fifo) && s.protocol !== "sqs").map((s) => ({ on: s.to, title: `FIFO topic ${s.ch} cannot deliver to ${s.to} over ${s.protocol}`, why: "FIFO topics deliver only to SQS queues (FIFO or standard). Put a FIFO queue between the topic and the consumer.", hard: true, sev: "crit", edge: { from: m.id, to: s.to }, facts: [fact(p, "fifo_protocols")].filter(Boolean) })),
    "msg.fifo-standard-queue": (m) => m.kind !== "notif" ? [] : m.subs.filter((s) => m.channels.find((c) => c.id === s.ch && c.fifo) && s.toType === "queue" && !s.toFifo).map((s) => ({ on: s.to, title: `FIFO topic ${s.ch} delivers to a standard queue (${s.to}): ordering is lost`, why: "A standard queue does not keep order or deduplicate. Use a FIFO queue to keep the topic's ordering." })),
    "msg.filter-keys": (m, p) => { const f = fact(p, "filter_keys"); if (!f || m.kind !== "notif") return []; return m.subs.filter((s) => s.filter && s.filter.split(/\s*,\s*/).filter(Boolean).length > f.max).map((s) => ({ on: s.to, title: `${s.to}'s filter uses more than ${f.max} attributes`, why: `A filter policy may use at most ${f.max} attribute names; this one cannot be created.`, hard: true, sev: "crit", edge: { from: m.id, to: s.to }, facts: [f] })); },
    "msg.cross-region": (m) => m.subs.filter((s) => s.toRegion && m.region && s.toRegion !== m.region).map((s) => ({ on: s.to, title: `${m.id} (region ${m.region}) delivers to ${s.to} in region ${s.toRegion}`, why: "Topics and buses are regional: each delivery crosses regions (latency, data-transfer cost) and stops if region A fails. Give region B its own topic or bus.", sev: "info" })),
    "msg.user-messaging": (m) => m.kind !== "notif" ? [] : m.subs.filter((s) => ["email", "sms"].includes(s.protocol)).map((s) => ({ on: s.to, title: `${m.id} sends ${s.protocol} to people`, why: "Topic email and SMS suit operators and alerts. For customer messages use a dedicated messaging service (for example Amazon SES or AWS End User Messaging): templates, opt-out, deliverability and sender identity.", sev: "info" })),
    "msg.unused-channel": (m) => m.channels.flatMap((c) => { const pubs = m.pubs.filter((p) => p.ch === c.id).length, subs = m.subs.filter((s) => s.ch === c.id).length; return (m.pubs.length + m.subs.length) && (!pubs || !subs) ? [{ on: m.id, title: `${m.id}/${c.id} has ${!pubs ? "no publisher" : "no consumer"}`, why: !pubs ? "Nothing sends to it: connect a producer, or remove it." : "Messages pile up (or are dropped) with nobody reading them: connect a consumer, or remove it.", sev: "info" }] : []; }),
  };
  api.evaluateMessaging = (d) => {
    const res = [], mp = B.packs.find((p) => p.id === "core.messaging");
    if (!mp || !d.msg) return res;
    Object.values(d.msg).forEach((m) => {
      const vendor = packsFor(d.nodes[m.id] ? d.nodes[m.id].type : "", d.provider).filter((p) => p.applies_to.provider === d.provider);
      const vp = { facts: vendor.flatMap((p) => (p.facts || []).filter((f) => !f.flavor || f.flavor === m.flavor)).map((f) => ({ ...f })), id: vendor.map(tag).join(", ") };
      const repl = m.kind === "topic" && api.spOn(d, "sp.kafka") ? (api.sp("sp.kafka").sp.replaces || []) : [];
      (mp.rules || []).forEach((r) => { const c = MSG[r.check]; if (!c || repl.includes(r.id)) return;
        (c(m, vp) || []).forEach((f) => res.push({ id: r.id, sev: f.sev || r.severity, on: f.on || m.id, via: m.id, title: f.title, why: f.why, pack: tag(mp) + (vp.id ? " + " + vp.id : ""), facts: f.facts || [], fix: f.fix ? { ...f.fix, on: f.on || m.id, edge: f.fix.set ? f.edge : undefined } : null, hard: !!f.hard })); });
    });
    return res;
  };
  /* ---------- Service Packs (SP-Microservice, SP-Kafka): rules on blocks, connectors and children ---------- */
  // A Service Pack is one pack file in packs/services with: sp (level, covers), policy (organisation defaults),
  // integration, facts and rules. Its checks live here, keyed by the rule's "check". d.sp = {on: {id: true}, policy: {}}.
  const COMPUTE = ["svc", "vm", "fn", "adp", "api"];
  api.sps = () => B.packs.filter((p) => p.sp);
  api.sp = (id) => B.packs.find((p) => p.id === id && p.sp) || null;
  api.spOn = (d, id) => !!(d.sp && d.sp.on && d.sp.on[id] && api.sp(id));
  api.policy = (d, id) => ({ ...((api.sp(id) || {}).policy || {}), ...((d.sp && d.sp.policy && d.sp.policy[id]) || {}) });
  // synchronous calls between compute blocks (the call graph)
  const isCall = (d, e) => isFlow(e) && d.nodes[e.from] && d.nodes[e.to] && COMPUTE.includes(d.nodes[e.from].type) && COMPUTE.includes(d.nodes[e.to].type) && d.nodes[e.from].parent === d.nodes[e.to].parent;
  api.calls = (d) => d.edges.filter((e) => isCall(d, e));
  const callDef = (d, e, P) => ({ deadline: e.deadline === undefined || e.deadline === null || e.deadline === "" ? P.defaultDeadlineMs : +e.deadline, retries: e.retries === undefined || e.retries === null || e.retries === "" ? P.defaultRetries : +e.retries, op: e.op || "read", idem: !!e.idem, contract: e.contract === undefined ? null : e.contract, proto: e.proto });
  api.callDef = callDef;
  const copies = (n) => n.auto ? +n.auto.min || 1 : +n.rep || 1, maxCopies = (n) => n.auto ? +n.auto.max || 1 : +n.rep || 1;
  // simple cycles in the call graph (each reported once, starting at its smallest id)
  api.callLoops = (d) => {
    const out = new Map(), adj = {};
    api.calls(d).forEach((e) => (adj[e.from] = adj[e.from] || []).push(e.to));
    const walk = (start, at, path) => {
      if (path.length > 8) return;
      (adj[at] || []).forEach((nx) => {
        if (nx === start) { const min = path.reduce((a, b) => (a < b ? a : b)); const i = path.indexOf(min); const rot = [...path.slice(i), ...path.slice(0, i)]; out.set(rot.join(">"), rot); return; }
        if (!path.includes(nx)) walk(start, nx, [...path, nx]);
      });
    };
    Object.keys(adj).forEach((s) => walk(s, s, [s]));
    return [...out.values()];
  };
  // longest simple synchronous paths, from each block that no other block calls
  api.callChains = (d) => {
    const cs = api.calls(d), adj = {}, called = new Set(cs.map((e) => e.to));
    cs.forEach((e) => (adj[e.from] = adj[e.from] || []).push(e.to));
    const starts = Object.keys(adj).filter((id) => !called.has(id));
    const best = [];
    const walk = (path) => { const at = path[path.length - 1], nx = (adj[at] || []).filter((x) => !path.includes(x)); if (!nx.length) { best.push(path); return; } nx.forEach((x) => walk([...path, x])); };
    (starts.length ? starts : Object.keys(adj)).forEach((s) => walk([s]));
    return best;
  };
  const edgeOf = (d, a, b) => d.edges.find((e) => e.from === a && e.to === b && isFlow(e));
  const MS = {
    "ms.call-loop": (d, P) => api.callLoops(d).map((loop) => { const a = loop[loop.length - 1], b = loop[0];
      return { on: loop[0], key: loop.join(">"), title: `Call loop: ${[...loop, loop[0]].join(" → ")}`, why: `These services call each other synchronously in a circle. One slow service stalls the whole loop, retries multiply around it, and none of them can be deployed or fail on its own. Break the loop: make one call an event (the callee publishes, the caller subscribes), or move the shared logic into one service.`, edge: { from: a, to: b }, fix: { insertQueue: { from: a, to: b }, label: `Make ${a} → ${b} asynchronous (queue between them)` } }; }),
    "ms.sync-chain": (d, P) => { const seen = new Set(); return api.callChains(d).filter((p) => p.length - 1 > P.maxSyncHops).filter((p) => { const k = p.join(">"); if (seen.has(k)) return false; seen.add(k); return true; }).map((p) => ({ on: p[1] || p[0], key: p.join(">"), title: `Synchronous chain of ${p.length - 1} service hops: ${p.join(" → ")}`, why: `Every request waits for each service in turn: latency adds up, and the chain is only as available as all of them together. Each hop also needs a shorter deadline than its caller. Policy allows ${P.maxSyncHops} hops. Options: let ${p[p.length - 1]} be called asynchronously (an event), let an earlier service call it directly, or keep a local copy of the data from events.` })); },
    "ms.deadline-order": (d, P) => api.calls(d).flatMap((e) => { const me = callDef(d, e, P); if (!me.deadline) return [];
      const callers = api.calls(d).filter((x) => x.to === e.from).map((x) => ({ x, dl: callDef(d, x, P).deadline })).filter((c) => c.dl);
      const tight = callers.filter((c) => me.deadline >= c.dl);
      return tight.length ? [{ on: e.from, key: `${e.from}>${e.to}`, title: `${e.from} → ${e.to} waits up to ${me.deadline} ms, but ${tight[0].x.from} gives ${e.from} only ${tight[0].dl} ms`, why: `A callee's deadline must be shorter than its caller's, or ${e.from} keeps waiting for ${e.to} after ${tight[0].x.from} has already given up: wasted work and retries piling up. Shrink deadlines along the chain.`, edge: { from: e.from, to: e.to }, fix: { set: { deadline: Math.max(50, Math.floor(Math.min(...tight.map((c) => c.dl)) * 0.6)) }, label: `Set the deadline to ${Math.max(50, Math.floor(Math.min(...tight.map((c) => c.dl)) * 0.6))} ms` } }] : []; }),
    "ms.no-deadline": (d, P) => api.calls(d).filter((e) => callDef(d, e, P).deadline === 0).map((e) => ({ on: e.from, key: `${e.from}>${e.to}`, title: `${e.from} → ${e.to} has no deadline`, why: `Without a deadline a slow ${e.to} holds ${e.from}'s threads and connections until they run out: one slow service becomes an outage upstream.`, edge: { from: e.from, to: e.to }, fix: { set: { deadline: P.defaultDeadlineMs }, label: `Set a ${P.defaultDeadlineMs} ms deadline` } })),
    "ms.retry-unsafe": (d, P) => api.calls(d).filter((e) => { const c = callDef(d, e, P); return c.op === "write" && c.retries > 0 && !c.idem; }).map((e) => ({ on: e.from, key: `${e.from}>${e.to}`, title: `${e.from} retries a write to ${e.to} without an idempotency key`, why: `A retry after a timeout can apply the write twice (for example, two orders or two payments): the first attempt may have succeeded. Send an idempotency key that ${e.to} checks, or do not retry writes.`, edge: { from: e.from, to: e.to }, fix: { set: { idem: true }, label: "Send an idempotency key" } })),
    "ms.retry-amplification": (d, P) => { const seen = new Set(); return api.callChains(d).flatMap((p) => { let f = 1; const es = []; for (let i = 0; i < p.length - 1; i++) { const e = edgeOf(d, p[i], p[i + 1]); if (!e) continue; es.push(e); f *= 1 + callDef(d, e, P).retries; }
      if (f <= P.maxRetryAmplification) return []; const k = p.join(">"); if (seen.has(k)) return []; seen.add(k);
      return [{ on: p[p.length - 1], key: k, title: `Retries multiply ${f}× along ${p.join(" → ")}`, why: `Each layer retries on its own, so one failing request to ${p[p.length - 1]} can become ${f} requests: a retry storm exactly when it is struggling. Retry at one layer only (usually the one closest to the user) and fail fast below it. Policy allows ${P.maxRetryAmplification}×.`, fix: { edges: es.slice(1).map((e) => ({ from: e.from, to: e.to, set: { retries: 0 } })), label: "Retry only at the first hop" } }]; }); },
    "ms.shared-db": (d) => Object.values(d.nodes).filter((n) => n.type === "db").flatMap((db) => { const o = [...new Set(d.edges.filter((e) => e.to === db.id && isFlow(e) && d.nodes[e.from] && ["svc", "vm", "fn"].includes(d.nodes[e.from].type)).map((e) => d.nodes[e.from].twin || e.from))].sort();
      return o.length > 1 ? [{ on: db.id, key: o.join(","), title: `${db.id} is shared by ${o.join(", ")}`, why: `A database per service: a schema change for one breaks the others, and they cannot deploy or scale on their own. ${o.slice(1).join(", ")} should use ${o[0]}'s API or events instead.` }] : []; }),
    "ms.min-copies": (d, P) => Object.values(d.nodes).filter((n) => n.type === "svc" && n.parent === "root" && copies(n) < P.minCopies).map((n) => ({ on: n.id, title: `${n.id} runs ${copies(n)} cop${copies(n) === 1 ? "y" : "ies"}; policy needs ${P.minCopies} across zones`, why: `With one copy, a deployment, a crash or a zone failure stops the service. Run at least ${P.minCopies}, spread over zones.`, fix: { set: n.auto ? { auto: { ...n.auto, min: Math.max(P.minCopies, +n.auto.min || 1), max: Math.max(P.minCopies, +n.auto.max || 1) } } : { rep: P.minCopies }, label: `Run ${P.minCopies} copies` } })),
    "ms.stateful-scale": (d) => Object.values(d.nodes).filter((n) => n.type === "svc" && n.stateless === false && maxCopies(n) > 1).map((n) => ({ on: n.id, title: `${n.id} keeps state in memory but runs up to ${maxCopies(n)} copies`, why: "Copies that keep sessions or caches in memory disagree with each other, and scaling in loses that state. Keep state in a database or cache so any copy can serve any request." })),
    "ms.singleton-work": (d) => Object.values(d.nodes).filter((n) => n.type === "svc" && n.jobs === "in-process" && maxCopies(n) > 1).map((n) => ({ on: n.id, title: `${n.id} runs scheduled work inside every copy`, why: `With ${maxCopies(n)} copies, each runs the job: duplicate emails, double charges, conflicting updates. Trigger it once from an external scheduler, and claim each job with a unique row (or SELECT … FOR UPDATE SKIP LOCKED).`, fix: { set: { jobs: "scheduler" }, label: "Trigger from an external scheduler" } })),
    "ms.contract": (d, P) => api.calls(d).filter((e) => callDef(d, e, P).contract === "").map((e) => ({ on: e.to, key: `${e.from}>${e.to}`, title: `${e.from} → ${e.to} has no contract`, why: `Without a versioned contract (gRPC .proto or OpenAPI), a change in ${e.to} breaks ${e.from} at run time instead of in a contract test.`, edge: { from: e.from, to: e.to } })),
    "ms.grpc-edge": (d) => d.edges.filter((e) => isFlow(e) && e.proto === "gRPC" && d.nodes[e.from] && ["user", "ext", "saas", "cdn", "waf"].includes(d.nodes[e.from].type)).map((e) => ({ on: e.to, key: `${e.from}>${e.to}`, title: `${e.from} → ${e.to} uses gRPC from outside`, why: "Browsers cannot call gRPC directly, and partners rarely can. Use REST (HTTPS + JSON) at the edge, or gRPC-Web through a proxy such as Envoy, and gRPC inside.", edge: { from: e.from, to: e.to }, fix: { set: { proto: "HTTPS" }, label: "Use REST (HTTPS) at the edge" } })),
    "ms.slo-chain": (d, P) => Object.values(d.nodes).filter((n) => n.type === "svc").flatMap((n) => { const own = +((n.slo && n.slo.avail) || P.defaultSlo); const deps = api.calls(d).filter((e) => e.from === n.id).map((e) => d.nodes[e.to]).filter((m) => m.type === "svc");
      if (deps.length < 2) return []; const comp = deps.reduce((a, m) => a * (+((m.slo && m.slo.avail) || P.defaultSlo) / 100), 1) * 100;
      return comp < own - 1e-9 ? [{ on: n.id, title: `${n.id} targets ${own}% but its ${deps.length} synchronous dependencies together give about ${comp.toFixed(2)}%`, why: `If ${n.id} needs every one of ${deps.map((m) => m.id).join(", ")} to answer, it cannot be more available than all of them together. Raise their targets, or degrade gracefully (cached or default answers) when one is down.` }] : []; }),
  };
  const KF = {};
  api.evaluateSP = (d) => {
    const res = [];
    api.sps().forEach((p) => { if (!api.spOn(d, p.id)) return; const P = api.policy(d, p.id);
      (p.rules || []).forEach((r) => { const c = MS[r.check] || KF[r.check]; if (!c) return;
        (c(d, P, p) || []).forEach((f) => { const tgt = f.edge ? d.edges.find((e) => e.from === f.edge.from && e.to === f.edge.to) : d.nodes[f.on];
          const ex = (tgt && tgt.spEx && tgt.spEx[r.id]) || (d.nodes[f.on] && d.nodes[f.on].spEx && d.nodes[f.on].spEx[r.id + (f.key ? "|" + f.key : "")]);
          res.push({ id: r.id, sev: f.sev || r.severity, on: f.on, edge: f.edge, key: f.key || "", title: f.title, why: f.why, rationale: r.rationale, basis: r.basis || [], refs: r.refs || [], pack: tag(p), sp: p.sp.name, facts: (r.facts || []).map((id) => (p.facts || []).find((x) => x.id === id)).filter(Boolean).concat(f.facts || []), fix: f.fix ? { ...f.fix, on: f.on, edge: f.fix.set ? f.edge : undefined } : null, accepted: ex || null, detail: f.detail }); }); }); });
    return res;
  };
  /* SP-Kafka: cluster, topics (children), consumer groups and their dead-letter topics */
  const sizeKey = (s) => String(s || "").replace(/^kafka\./, "").replace(/[^a-z0-9]+/g, "_");
  const topicsOf = (d) => Object.values(d.msg || {}).filter((m) => m.kind === "topic");
  const chOf = (m, id) => m.channels.find((c) => c.id === id) || {};
  const topicRate = (m, c) => m.pubs.filter((p) => p.ch === c.id).reduce((a, p) => a + (p.rate || 0), 0);
  const groupsOf = (m) => Object.values(m.subs.reduce((g, s) => { const k = s.ch + "|" + s.group; (g[k] = g[k] || { ch: s.ch, group: s.group, subs: [], consumers: 0, rate: 0 }); g[k].subs.push(s); g[k].consumers += s.consumers || 1; g[k].rate = Math.max(g[k].rate, s.rate || 0); return g; }, {}));
  api.kafkaGroups = groupsOf;
  api.dlqName = (topic, group) => `${topic}.${group}.dlq`;
  // load per broker (MB/s): writes × replication factor (leaders + follower copies) + reads per group; storage per broker (GiB)
  api.kafkaLoad = (m) => {
    const cl = m.cluster || {}, br = Math.max(1, m.brokers || 1);
    let inMB = 0, outMB = 0, storeGiB = 0, parts = 0;
    m.channels.forEach((c) => { const r = topicRate(m, c), mb = r * (c.msgKB || 1) / 1024, rf = c.rf || 1;
      inMB += mb * rf; outMB += mb * (groupsOf(m).filter((g) => g.ch === c.id).length + (rf - 1));
      storeGiB += mb * 3600 * (c.retentionH || 168) * rf / 1024; parts += (c.partitions || 1) * rf; });
    groupsOf(m).forEach((g) => { const c = chOf(m, g.ch); const s0 = g.subs[0] || {}; if (s0.dlq !== false) parts += (c.partitions || 1) * 3; });
    return { inMB: inMB / br, outMB: outMB / br, storeGiB: storeGiB / br, parts: parts / br, brokers: br, size: cl.size };
  };
  const kfact = (p, id) => (p.facts || []).find((f) => f.id === id);
  Object.assign(KF, {
    "kafka.zones": (d, P) => topicsOf(d).flatMap((m) => { const z = Math.max(1, (m.cluster && m.cluster.zones) || (d.zones || []).length || 1), b = m.brokers || 1;
      if (z >= 2 && b % z === 0) return []; const to = Math.max(z, Math.ceil(b / z) * z);
      return [{ on: m.id, title: z < 2 ? `${m.id} runs in one zone` : `${m.id} has ${b} brokers over ${z} zones`, why: z < 2 ? "A zone failure takes the whole cluster down. Spread brokers over at least two zones (three recommended)." : `The broker count must be a multiple of the zones, so each zone holds the same share of brokers and replicas. ${b} brokers do not divide over ${z} zones.`, fix: z >= 2 ? { set: { brokers: to }, label: `Use ${to} brokers` } : null }]; }),
    "kafka.replication": (d, P) => topicsOf(d).flatMap((m) => m.channels.filter((c) => c.rf < P.minReplication || c.minIsr < P.minInsync || c.minIsr >= c.rf).map((c) => ({ on: m.id, key: c.id, title: `Topic ${c.id}: replication factor ${c.rf}, min.insync.replicas ${c.minIsr}`, why: `With fewer than ${P.minReplication} copies, a rolling update or one broker failure can take partitions offline or lose acknowledged messages. min.insync.replicas should be ${P.minInsync} and below the replication factor, so writes with acks=all continue while one broker is down.`, fix: { chan: { id: c.id, set: { rf: Math.max(c.rf, P.minReplication), minIsr: P.minInsync } }, label: `Replication ${Math.max(c.rf, P.minReplication)}, min in-sync ${P.minInsync}` } }))),
    "kafka.unclean-election": (d) => topicsOf(d).filter((m) => m.cluster && m.cluster.unclean).map((m) => ({ on: m.id, title: `${m.id} allows unclean leader election`, why: "If every in-sync replica is lost, an out-of-date replica can become leader and acknowledged messages are silently lost. Turn it off: the partition waits for an in-sync replica instead.", fix: { set: { unclean: false }, label: "Turn off unclean leader election" } })),
    "kafka.partitions-per-broker": (d, P, p) => topicsOf(d).flatMap((m) => { const L = api.kafkaLoad(m), k = sizeKey(L.size), rec = kfact(p, "partitions_" + k), max = kfact(p, "partitions_max_" + k);
      if (!rec || L.parts <= rec.default) return []; const over = max && L.parts > max.default;
      return [{ on: m.id, sev: over ? "crit" : "warn", title: `${m.id} carries about ${Math.round(L.parts)} partition replicas per broker (${L.size})`, why: `The recommendation for ${L.size} is ${rec.default} per broker, leaders and followers counted (a best practice, not enforced)${max ? `. Above ${max.default}, if the cluster becomes overloaded, you cannot update its configuration or move to a smaller broker size` : ""}. Dead-letter topics count too. Add brokers, use a larger size, or fewer partitions.`, facts: [rec, max].filter(Boolean) }]; }),
    "kafka.broker-ceiling": (d, P) => topicsOf(d).flatMap((m) => { const L = api.kafkaLoad(m), cap = (P.brokerMBps || {})[L.size]; if (!cap) return []; const use = Math.max(L.inMB, L.outMB), lim = cap * (1 - P.brokerHeadroom);
      return use > lim ? [{ on: m.id, title: `${m.id} brokers move about ${use.toFixed(1)} MB/s each; the planning ceiling for ${L.size} is ${cap} MB/s with ${Math.round(P.brokerHeadroom * 100)}% headroom`, why: `Traffic per broker counts every copy (replication factor) and every consumer group's reads. ${cap} MB/s is a NEXUS planning assumption, not an AWS limit: measure your cluster. Add brokers or use a larger size.` }] : []; }),
    "kafka.storage": (d, P, p) => topicsOf(d).flatMap((m) => { const L = api.kafkaLoad(m), have = (m.cluster && m.cluster.storageGiB) || 0, need = L.storeGiB * (1 + P.storageHeadroom), mx = kfact(p, "storage_max");
      if (!have || need <= have) return []; const over = mx && need > mx.default;
      return [{ on: m.id, sev: over ? "crit" : "warn", title: `${m.id} needs about ${Math.round(need)} GiB per broker; it has ${have} GiB`, why: `Storage per broker = rate × message size × retention × replication factor ÷ brokers, plus ${Math.round(P.storageHeadroom * 100)}% headroom. ${over ? `That is above the ${mx.default} GiB maximum per broker: add brokers, shorten retention or use tiered storage.` : "Raise the storage (it cannot be reduced later), shorten retention, or turn on storage autoscaling."}`, facts: [mx].filter(Boolean), fix: over ? null : { set: { storageGiB: Math.ceil(need / 100) * 100 }, label: `Use ${Math.ceil(need / 100) * 100} GiB per broker` } }]; }),
    "kafka.retention-outage": (d, P) => topicsOf(d).flatMap((m) => m.channels.filter((c) => (c.retentionH || 168) < P.plannedOutageH).map((c) => ({ on: m.id, key: c.id, title: `Topic ${c.id} keeps messages ${c.retentionH} h; a consumer outage of ${P.plannedOutageH} h must be survivable`, why: "A consumer that is down longer than the retention comes back to find its messages deleted. Keep them at least as long as the longest consumer outage you plan for.", fix: { chan: { id: c.id, set: { retentionH: P.plannedOutageH } }, label: `Keep ${P.plannedOutageH} h` } }))),
    "kafka.offset-retention": (d, P) => topicsOf(d).filter((m) => m.cluster && (m.cluster.offsetRetH || 168) < P.plannedOutageH).map((m) => ({ on: m.id, title: `${m.id} forgets a group's position after ${m.cluster.offsetRetH} h`, why: `If a consumer group is down longer than the offset retention, its committed position is deleted and it restarts from the reset policy (earliest or latest): replaying or skipping messages. Keep offsets at least ${P.plannedOutageH} h.`, fix: { set: { offsetRetH: Math.max(168, P.plannedOutageH) }, label: `Keep offsets ${Math.max(168, P.plannedOutageH)} h` } })),
    "kafka.lag-rto": (d, P) => { if (!d.req || !d.req.rto) return []; const rto = d.req.rto * 3600; return topicsOf(d).flatMap((m) => groupsOf(m).flatMap((g) => { const c = chOf(m, g.ch), per = 1000 / Math.max(1, (g.subs[0] && g.subs[0].procMs) || P.defaultProcMs), cap = Math.min(g.consumers, c.partitions || 1) * per, rate = g.rate;
      if (!rate) return []; const backlog = rate * P.consumerOutageMin * 60, catchUp = cap > rate ? backlog / (cap - rate) : Infinity;
      return catchUp > rto ? [{ on: g.subs[0].to, key: g.ch + "|" + g.group, title: isFinite(catchUp) ? `Group ${g.group} needs about ${Math.round(catchUp / 60)} min to catch up after a ${P.consumerOutageMin}-minute stop; the RTO is ${Math.round(rto / 60)} min` : `Group ${g.group} cannot keep up with ${g.ch}: ${Math.round(rate)} msg/s arrive, it processes about ${Math.round(cap)} msg/s`, why: `Catch-up time = backlog ÷ (processing capacity − arrival rate). Capacity = active consumers (at most the ${c.partitions} partitions) × 1000 ÷ processing time per message. Add consumers (and partitions), or make processing faster.` }] : []; })); },
    "kafka.producer-durability": (d) => topicsOf(d).flatMap((m) => m.pubs.filter((p) => ["acks0", "acks1"].includes(p.delivery)).map((p) => ({ on: p.from, key: p.ch, title: `${p.from} publishes to ${p.ch} with ${p.delivery === "acks0" ? "acks=0" : "acks=1"}`, why: "acks=1 loses messages when the leader fails before the followers copy them; acks=0 does not even wait for the leader. For business events use acks=all with the idempotent producer.", edge: { from: p.from, to: m.id }, fix: { set: { delivery: "idempotent" }, label: "acks=all, idempotent producer" } }))),
    "kafka.consumer-idempotency": (d) => topicsOf(d).flatMap((m) => m.subs.filter((s) => s.ack === "after" && !s.idem && s.toType !== "queue").map((s) => ({ on: s.to, key: s.ch, title: `${s.to} can read the same message twice but does not deduplicate`, why: "Kafka consumers commit offsets after processing: after a crash or a rebalance the last messages come again. Make processing idempotent (a processed-event table keyed by the event id).", edge: { from: m.id, to: s.to }, fix: { set: { idem: true }, label: "Deduplicate on the event id" } }))),
    "kafka.dead-letter": (d) => topicsOf(d).flatMap((m) => m.subs.filter((s) => s.dlq === false).map((s) => ({ on: s.to, key: s.ch + "|" + s.group, title: `Group ${s.group} on ${s.ch} has no dead-letter topic`, why: `A message that keeps failing either blocks its partition or is skipped and lost. By default each group gets ${api.dlqName(s.ch, s.group)}: failed messages are kept there with their error, alarmed and can be redriven. Turning it off needs a recorded exception.`, edge: { from: m.id, to: s.to }, fix: { set: { dlq: true }, label: `Add ${api.dlqName(s.ch, s.group)}` } }))),
    "kafka.dlq-retention": (d, P) => topicsOf(d).flatMap((m) => m.subs.filter((s) => s.dlq !== false && (s.dlqRetH || P.dlqRetentionH) < P.dlqRetentionH).map((s) => ({ on: s.to, key: s.ch + "|" + s.group, title: `${api.dlqName(s.ch, s.group)} keeps failed messages only ${s.dlqRetH} h`, why: `Failed messages need time to be investigated and redriven; policy keeps them ${P.dlqRetentionH} h (${P.dlqRetentionH / 24} days).`, edge: { from: m.id, to: s.to }, fix: { set: { dlqRetH: P.dlqRetentionH }, label: `Keep ${P.dlqRetentionH / 24} days` } }))),
    "kafka.dlq-ordering": (d) => topicsOf(d).flatMap((m) => m.subs.filter((s) => chOf(m, s.ch).ordered && s.dlq !== false && s.onFail === "skip").map((s) => ({ on: s.to, key: s.ch + "|" + s.group, title: `${s.to} skips failed messages of ordered topic ${s.ch} to the dead-letter topic`, why: "Moving one message aside lets later messages for the same key go first, which breaks the ordering the topic promises. The default for ordered topics is to stop that partition and alert after the retries; skipping needs a recorded exception.", edge: { from: m.id, to: s.to }, fix: { set: { onFail: "stop" }, label: "Stop the partition and alert" } }))),
    "kafka.ordering-key": (d) => topicsOf(d).flatMap((m) => m.pubs.filter((p) => chOf(m, p.ch).ordered && !p.key).map((p) => ({ on: p.from, key: p.ch, title: `${p.from} publishes to ordered topic ${p.ch} without a key`, why: "Without a key Kafka spreads messages over all partitions, so events for the same entity can be read out of order. Set the key to the entity id (for example order_id).", edge: { from: p.from, to: m.id } }))),
    "kafka.idle-consumers": (d) => topicsOf(d).flatMap((m) => groupsOf(m).filter((g) => g.consumers > (chOf(m, g.ch).partitions || 1)).map((g) => ({ on: m.id, key: g.ch + "|" + g.group, sev: "info", title: `Group ${g.group} has ${g.consumers} consumers for ${chOf(m, g.ch).partitions} partitions of ${g.ch}`, why: `Within a group each partition is read by one consumer, so ${g.consumers - chOf(m, g.ch).partitions} consumers sit idle. Add partitions (plan the key spread) or run fewer consumers.` }))),
    "kafka.hot-partition": (d, P) => topicsOf(d).flatMap((m) => m.channels.filter((c) => c.hotKey > 0 && (c.partitions || 1) > 1 && c.hotKey / 100 > P.hotPartitionFactor / (c.partitions || 1)).map((c) => ({ on: m.id, key: c.id, title: `Topic ${c.id}: one key carries ${c.hotKey}% of the traffic`, why: `All messages with one key go to one partition, so that partition gets ${c.hotKey}% of ${c.id}'s traffic instead of about ${Math.round(100 / c.partitions)}%: it limits the topic and its consumer. Re-key (for example store + order), or split the hot key with a suffix where ordering allows.` }))),
    "kafka.auth-encryption": (d) => topicsOf(d).filter((m) => m.cluster && (m.cluster.auth === "none" || m.cluster.tls === false)).map((m) => ({ on: m.id, title: `${m.id} ${m.cluster.auth === "none" ? "accepts clients without authentication" : "allows plaintext traffic"}`, why: "Any workload that reaches the brokers can read and write every topic, or traffic can be read on the network. Use IAM access control (or SASL/SCRAM or mutual TLS) and TLS between clients and brokers.", fix: { set: { auth: m.cluster.auth === "none" ? "iam" : m.cluster.auth, tls: true }, label: "IAM access control and TLS" } })),
    "kafka.auto-create": (d) => topicsOf(d).filter((m) => m.cluster && m.cluster.autoCreate).map((m) => ({ on: m.id, title: `${m.id} creates topics automatically`, why: "A typo in a producer creates a new topic with default partitions and replication, and messages silently go there. Create topics as code (Terraform) and turn automatic creation off.", fix: { set: { autoCreate: false }, label: "Turn off automatic topic creation" } })),
    "kafka.pii-retention": (d, P) => topicsOf(d).flatMap((m) => m.channels.filter((c) => c.pii && (c.retentionH || 168) > P.piiMaxH).map((c) => ({ on: m.id, key: c.id, title: `Topic ${c.id} holds personal data for ${c.retentionH} h`, why: `Policy keeps personal data in streams at most ${P.piiMaxH} h (${P.piiMaxH / 24} days); its dead-letter topics inherit the classification. Shorten retention, or keep only ids in events and the personal data in the owning service.`, fix: { chan: { id: c.id, set: { retentionH: P.piiMaxH } }, label: `Keep ${P.piiMaxH / 24} days` } }))),
    "kafka.outbox": (d) => topicsOf(d).flatMap((m) => m.pubs.filter((p) => p.writesDb && !p.outbox).map((p) => ({ on: p.from, key: p.ch, title: `${p.from} writes its database and publishes to ${p.ch} without an outbox`, why: `If ${p.from} saves and then fails before publishing (or the reverse), the database and the events disagree. Write the event to an outbox table in the same transaction and publish from there.`, edge: { from: p.from, to: m.id }, fix: { set: { outbox: true }, label: "Publish through an outbox" } }))),
  });
  api.KF = KF;
  api.spChecks = () => [...Object.keys(MS), ...Object.keys(KF)];

  api.evaluate = (d) => {
    const res = [];
    Object.values(d.nodes).forEach((n) => {
      packsFor(n.type, d.provider).forEach((p) => {
        // values that a pack bounds
        p.facts.filter((f) => f.field && n[f.field] != null).forEach((f) => {
          const o = api.outOfRange(f, n[f.field]);
          if (o) res.push({ id: `limit.${p.id}.${f.id}`, sev: o.hard ? "crit" : "warn", on: n.id, title: `${n.id}: ${f.label.toLowerCase()} ${o.hard ? "is outside the provider's limit" : "needs a quota increase"}`, why: o.why, pack: tag(p), facts: [f], hard: o.hard });
        });
        (p.rules || []).forEach((r) => {
          const c = CHECKS[r.check];
          const f = c && c(d, n, p);
          if (f) res.push({ id: r.id, sev: f.sev || r.severity, on: n.id, title: f.title, why: f.why, pack: tag(p), facts: (r.facts || []).map((id) => p.facts.find((x) => x.id === id)).filter(Boolean), fix: f.fix ? { ...f.fix, on: n.id } : null, detail: f.detail });
        });
      });
    });
    return res.concat(api.evaluateMessaging(d), api.evaluateSP(d));
  };

  /* ---------- what a component knows, senses and concludes ---------- */
  api.think = (d, id) => {
    const n = d.nodes[id];
    if (!n) return null;
    const net = (d.nets || []).find((x) => x.id === n.net);
    return {
      knows: api.facts(n.type, d.provider),
      senses: {
        region: n.region || "A",
        subnet: net ? { name: net.name, tier: net.tier, cidr: cidrOf(net), zones: netAzs(net) } : null,
        internetFacing: internetFacing(d, id),
        flowsIn: d.edges.filter((e) => e.to === id && isFlow(e)).map((e) => e.from),
        flowsOut: d.edges.filter((e) => e.from === id && isFlow(e)).map((e) => e.to),
        load: d.load ? d.load[id] || 0 : 0,
      },
      concludes: api.evaluate(d).filter((f) => f.on === id),
    };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NexusPacks = api;
})(typeof window !== "undefined" ? window : globalThis);
