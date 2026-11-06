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
  const packsFor = (type, prov) => B.packs.filter((p) => p.applies_to && p.applies_to.type === type && p.applies_to.provider === prov);
  const isFlow = (e) => !e.kind || e.kind === "flow";

  /* ---------- 1. facts ---------- */
  api.packsFor = packsFor;
  api.facts = (type, prov) => packsFor(type, prov).flatMap((p) => p.facts.map((f) => ({ ...f, pack: tag(p) })));
  api.fact = (type, prov, id) => api.facts(type, prov).find((f) => f.id === id) || null;
  // The provider limit the simulator uses for a managed component (requests per second), when a pack states one.
  api.simQuota = (type, prov) => {
    const f = api.facts(type, prov).find((x) => x.sim === "rps" && x.default != null);
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
    return res;
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
