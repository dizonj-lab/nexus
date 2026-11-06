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
      (mp.rules || []).forEach((r) => { const c = MSG[r.check]; if (!c) return;
        (c(m, vp) || []).forEach((f) => res.push({ id: r.id, sev: f.sev || r.severity, on: f.on || m.id, via: m.id, title: f.title, why: f.why, pack: tag(mp) + (vp.id ? " + " + vp.id : ""), facts: f.facts || [], fix: f.fix ? { ...f.fix, on: f.on || m.id, edge: f.fix.set ? f.edge : undefined } : null, hard: !!f.hard })); });
    });
    return res;
  };
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
    return res.concat(api.evaluateMessaging(d));
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
