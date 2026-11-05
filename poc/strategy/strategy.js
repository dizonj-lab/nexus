// NEXUS Strategy: the Chief Technology Architect's workbench. State lives in this browser
// (localStorage); "Hand-off to NEXUS" passes principles, guardrails and the approved stack to the
// design workbench, which imports them as EA principles, ground truth and Technical Capabilities.
(function () {
  const { ROLES, LENSES, IMPACT, ARTEFACTS, STAGES } = window.STRATEGY;
  const KEY = 'nexus.strategy.v1', HANDOFF = 'nexus.strategy.handoff.v1';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const STATUS = [['', 'Not started'], ['draft', 'Draft'], ['review', 'In review'], ['approved', 'Approved']];
  const LENS = Object.fromEntries(LENSES), ROLE = Object.fromEntries(ROLES.map((r) => [r[0], r])), ART = Object.fromEntries(ARTEFACTS.map((a) => [a.id, a]));
  const IN_APP = new URLSearchParams(location.search).has('embed') && window.parent !== window;

  const EXAMPLE = () => ({
    org: 'Larkspur Bank (example)', view: 'flow', stage: 1, arts: {
      charter: { s: 'approved', owner: 'CTA' }, drivers: { s: 'approved', owner: 'EA lead' }, stakeholders: { s: 'review', owner: 'CTA' },
      capmap: { s: 'review', owner: 'EA lead' }, portfolio: { s: 'draft', owner: 'Solution architects' }, costbase: { s: 'draft', owner: 'Finance BP' },
      vision: { s: 'draft', owner: 'CTA' },
    }, gates: { 'mandate:0': true, 'mandate:1': true, 'mandate:2': true, 'baseline:1': true },
    fin: { cur: 'S$', years: 5, rate: 8, capex: 4200000, migration: 1300000, runNow: 6800000, runTarget: 5100000, benefit: 1900000, ramp: 40 },
    page: {
      ambition: 'Become the region\'s most trusted digital bank for small businesses by 2029.',
      vision: 'A resilient, hybrid platform where any team can ship a compliant, secure change in a day.',
      principles: 'Business outcomes before technology choices\nDesign for failure: every critical service survives a zone loss\nReuse before buy before build\nSecure by default: zero trust, every flow encrypted\nEach service owns its data\nAutomate the guardrails, do not meet about them',
      guardrails: 'Internet-facing endpoints sit behind a WAF | Security Standard SS-04\nCustomer data stays in Singapore regions | MAS TRM, PDPA\nCritical services meet RTO 15 min, RPO 0 | Resilience policy RP-2\nNo public object storage | Cloud policy CP-1',
      capabilities: 'Kubernetes platform (EKS and on-prem Tanzu) | svc, api\nPostgreSQL 16, managed or on vSphere | db\nKafka event streaming | queue\nKong API gateway | gw\nHashiCorp Vault | sec',
      bets: 'Hybrid platform: one control plane for cloud and data centre\nEvent-driven core banking integration\nAI-assisted operations and fraud detection',
      h1: 'Platform foundations and landing zones\nRetire 30 legacy applications\nZone-resilient payments', h2: 'Event-driven integration hub\nSelf-service developer portal\nRegion pair for critical services', h3: 'AI-assisted operations\nOpen banking ecosystem',
      investment: 'S$5.5M over 18 months; payback in year 3',
      kpis: 'Lead time for change: 10 days to 1 day\nCritical services survive a zone loss: 40% to 100%\nRun cost per customer: down 25%\nAudit findings on technology: down 50%',
      risks: 'Skills gap in platform engineering\nVendor lock-in on managed services\nChange fatigue in operations',
    },
  });
  let st;
  try { st = JSON.parse(localStorage.getItem(KEY)) || EXAMPLE(); } catch (e) { st = EXAMPLE(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const toast = (t) => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2200); };

  // ---------- helpers ----------
  const artSt = (id) => (st.arts[id] && st.arts[id].s) || '';
  const dot = (id) => `<span class="dot ${artSt(id)}" title="${esc(STATUS.find((s) => s[0] === artSt(id))[1])}"></span>`;
  const gateDone = (s) => s.gate.every((_, i) => st.gates[`${s.id}:${i}`]);
  const gateShare = (s) => s.gate.filter((_, i) => st.gates[`${s.id}:${i}`]).length / s.gate.length;
  function progress() {
    const all = STAGES.reduce((n, s) => n + s.gate.length, 0), done = STAGES.reduce((n, s) => n + s.gate.filter((_, i) => st.gates[`${s.id}:${i}`]).length, 0);
    const p = Math.round((done / all) * 100);
    $('#progTxt').textContent = `${p}% of exit gates`; $('#progBar').style.width = p + '%';
  }
  const artChip = (a) => `<button class="art" data-art="${a.id}">${dot(a.id)}${esc(a.name)}${a.delivery ? '<span class="dl">DELIVERY</span>' : ''}</button>`;

  // ---------- views ----------
  const V = {};
  V.flow = () => {
    const s = STAGES[st.stage - 1];
    const step = STAGES.map((x) => `<button data-stage="${x.n}" ${x.n === s.n ? 'aria-current="step"' : ''} class="${gateDone(x) ? 'done' : ''}"><span class="n">${String(x.n).padStart(2, '0')}</span><b>${esc(x.title)}</b><span class="mini"><i style="width:${Math.round(gateShare(x) * 100)}%"></i></span></button>`).join('');
    const lens = LENSES.map(([k, l]) => `<section class="lens ${k}"><h3>${esc(l)}</h3><ul>${s.lenses[k].map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <h4>Artefacts</h4><div class="chips">${ARTEFACTS.filter((a) => a.stage === s.n && a.lens === k).map(artChip).join('') || '<span class="note">None at this stage</span>'}</div></section>`).join('');
    const order = { A: 0, R: 1, C: 2, I: 3 };
    const who = Object.entries(s.raci).sort((a, b) => order[a[1]] - order[b[1]]).map(([r, v]) => `<span class="role"><span class="raci ${v}">${v}</span>${esc(ROLE[r][1])}</span>`).join('');
    return `<div class="vh"><div><p class="eyebrow">Workflow · ${esc(st.org)}</p><h1>From mandate to measurable value</h1>
      <p>Nine stages. At each one, the four lenses show what to do and what to produce for technology, the business, finance and the CxOs. Tick the exit gate to move on.</p></div></div>
      <div class="stepper" role="list">${step}</div>
      <div class="stage-head"><p class="eyebrow">Stage ${s.n} of ${STAGES.length}</p><h2>${esc(s.title)}</h2><p>${esc(s.purpose)}</p></div>
      <div class="lenses">${lens}</div>
      <div class="row3">
        <section class="panel"><h3>Collaborate with</h3><div class="who">${who}</div><p class="note">A accountable · R responsible · C consulted · I informed</p></section>
        <section class="panel gate"><h3>Exit gate</h3>${s.gate.map((g, i) => `<label><input type="checkbox" data-gate="${s.id}:${i}" ${st.gates[`${s.id}:${i}`] ? 'checked' : ''}> ${esc(g)}</label>`).join('')}</section>
        <section class="panel"><h3>Success measures</h3><ul class="mlist">${s.measures.map((m) => `<li>${esc(m)}</li>`).join('')}</ul><h3>Pitfalls</h3><ul class="mlist">${s.pitfalls.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></section>
      </div>
      <div class="converge"><b>NEXUS ⇄</b><span>${esc(s.nexus)}</span></div>
      <div class="nav2">${s.n > 1 ? `<button class="btn" data-stage="${s.n - 1}">← ${esc(STAGES[s.n - 2].title)}</button>` : '<span></span>'}${s.n < STAGES.length ? `<button class="btn primary" data-stage="${s.n + 1}">${esc(STAGES[s.n].title)} →</button>` : '<span></span>'}</div>`;
  };

  V.raci = () => {
    const groups = [...new Set(ROLES.map((r) => r[2]))];
    const head = `<tr><th class="l">Role</th>${STAGES.map((s) => `<th title="${esc(s.title)}">${s.n}<small>${esc(s.title)}</small></th>`).join('')}</tr>`;
    const body = groups.map((g) => `<tr class="grp"><td colspan="${STAGES.length + 1}">${esc(g)}</td></tr>` + ROLES.filter((r) => r[2] === g).map((r) => `<tr><td class="l">${esc(r[1])}</td>${STAGES.map((s) => `<td>${s.raci[r[0]] ? `<span class="raci ${s.raci[r[0]]}">${s.raci[r[0]]}</span>` : ''}</td>`).join('')}</tr>`).join('')).join('');
    return `<div class="vh"><div><p class="eyebrow">Collaboration</p><h1>Who does what, stage by stage</h1><p>The Chief Technology Architect leads, but the strategy succeeds only when finance, the business, risk and HR own their parts. One accountable person per stage.</p></div></div>
      <div class="legend"><span><span class="raci A">A</span>Accountable</span><span><span class="raci R">R</span>Responsible</span><span><span class="raci C">C</span>Consulted</span><span><span class="raci I">I</span>Informed</span></div>
      <div class="matrix-wrap"><table class="m"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  };

  V.arts = () => {
    const f = st.af || (st.af = { stage: '', lens: '', status: '', kind: '', q: '' });
    const opt = (vals, cur) => vals.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('');
    const rows = ARTEFACTS.filter((a) => (!f.stage || a.stage === +f.stage) && (!f.lens || a.lens === f.lens) && (!f.status || (f.status === 'none' ? !artSt(a.id) : artSt(a.id) === f.status))
      && (!f.kind || (f.kind === 'delivery') === a.delivery) && (!f.q || (a.name + ' ' + (st.arts[a.id]?.owner || '')).toLowerCase().includes(f.q.toLowerCase())));
    const done = ARTEFACTS.filter((a) => artSt(a.id) === 'approved').length;
    return `<div class="vh"><div><p class="eyebrow">Artefacts</p><h1>Everything the role produces</h1><p>${ARTEFACTS.length} artefacts across ${STAGES.length} stages, ${ARTEFACTS.filter((a) => a.delivery).length} of them delivery artefacts that change people, process or technology. ${done} approved so far.</p></div></div>
      <div class="filters">
        <label>Stage<select data-f="stage">${opt([['', 'All'], ...STAGES.map((s) => [s.n, `${s.n}. ${s.title}`])], f.stage)}</select></label>
        <label>Lens<select data-f="lens">${opt([['', 'All'], ...LENSES], f.lens)}</select></label>
        <label>Status<select data-f="status">${opt([['', 'All'], ['none', 'Not started'], ...STATUS.slice(1)], f.status)}</select></label>
        <label>Kind<select data-f="kind">${opt([['', 'All'], ['delivery', 'Delivery'], ['working', 'Working']], f.kind)}</select></label>
        <label>Search<input data-f="q" value="${esc(f.q)}" placeholder="name or owner"></label>
      </div>
      <table class="t"><thead><tr><th>Artefact</th><th>Stage</th><th>Lens</th><th>Impact</th><th>Owner</th><th>Status</th></tr></thead><tbody>
      ${rows.map((a) => `<tr data-art="${a.id}"><td><b>${esc(a.name)}</b>${a.delivery ? ' <span class="tag cxo">delivery</span>' : ''}</td><td>${a.stage}. ${esc(STAGES[a.stage - 1].title)}</td><td><span class="tag ${a.lens}">${esc(LENS[a.lens])}</span></td>
        <td>${a.impacts.map((i) => `<span class="tag ${i}">${esc(i)}</span>`).join(' ')}</td><td>${esc(st.arts[a.id]?.owner || '')}</td><td><span class="stat">${dot(a.id)}${esc(STATUS.find((s) => s[0] === artSt(a.id))[1])}</span></td></tr>`).join('') || '<tr><td colspan="6">No artefacts match.</td></tr>'}
      </tbody></table>`;
  };

  V.ppt = () => {
    const del = ARTEFACTS.filter((a) => a.delivery);
    const blurb = { people: 'Organisation, roles, skills and how people are brought along.', process: 'How work, decisions and governance run day to day.', technology: 'Platforms, architecture and the paved road teams build on.' };
    const col = ([k, l]) => { const xs = del.filter((a) => a.impacts.includes(k)); const ok = xs.filter((a) => artSt(a.id) === 'approved').length;
      return `<section class="col"><h2>${esc(l)} <small>${ok}/${xs.length} approved</small></h2><p>${esc(blurb[k])}</p>${xs.map((a) => `<div class="card ${a.lens}" data-art="${a.id}"><b>${esc(a.name)}</b><span class="note">${esc(a.why)}</span><span class="meta"><span>Stage ${a.stage} · ${esc(LENS[a.lens])}</span><span class="stat">${dot(a.id)}${esc(STATUS.find((s) => s[0] === artSt(a.id))[1])}</span></span></div>`).join('')}</section>`; };
    return `<div class="vh"><div><p class="eyebrow">Delivery artefacts</p><h1>People · Process · Technology</h1><p>The artefacts that change how the organisation works. Many touch more than one dimension; a strategy that only moves technology does not stick.</p></div></div>
      <div class="ppt">${IMPACT.map(col).join('')}</div>`;
  };

  function finCalc(f, mult = 1) {
    const N = Math.max(1, Math.min(10, +f.years || 5)), r = (+f.rate || 0) / 100, c0 = (+f.capex || 0) + (+f.migration || 0);
    const cf = [-c0]; for (let t = 1; t <= N; t++) { const k = t === 1 ? (+f.ramp || 0) / 100 : 1; cf.push(k * (((+f.runNow || 0) - (+f.runTarget || 0)) + (+f.benefit || 0) * mult)); }
    const npv = cf.reduce((s, v, t) => s + v / Math.pow(1 + r, t), 0), gain = cf.slice(1).reduce((a, b) => a + b, 0);
    let cum = 0, pay = null; const cumu = cf.map((v, t) => { const prev = cum; cum += v; if (pay === null && t > 0 && cum >= 0) pay = t - 1 + (v ? -prev / v : 0); return cum; });
    return { N, cf, cumu, npv, roi: c0 ? (gain - c0) / c0 : 0, pay, tcoNow: (+f.runNow || 0) * N, tcoTarget: c0 + (+f.runTarget || 0) * N };
  }
  const money = (v, cur) => `${v < 0 ? '−' : ''}${cur}${Math.abs(v) >= 1e6 ? (Math.abs(v) / 1e6).toFixed(2) + 'M' : Math.round(Math.abs(v) / 1e3) + 'k'}`;
  V.fin = () => {
    const f = st.fin, r = finCalc(f), lo = finCalc(f, 0.8), hi = finCalc(f, 1.2), cur = f.cur || '';
    const inp = (k, l, step = 'any') => `<label>${esc(l)}<input type="number" step="${step}" data-fin="${k}" value="${esc(f[k])}"></label>`;
    const W = 640, H = 220, P = 40, xs = r.cumu.map((_, i) => P + i * ((W - 2 * P) / r.N)), mn = Math.min(0, ...r.cumu), mx = Math.max(0, ...r.cumu), y = (v) => H - P + (P * 2 - H) * ((v - mn) / ((mx - mn) || 1));
    const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative cash flow by year"><line x1="${P}" x2="${W - P}" y1="${y(0)}" y2="${y(0)}" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="4 4"/>
      <polyline fill="none" stroke="var(--accent)" stroke-width="2.5" points="${r.cumu.map((v, i) => `${xs[i]},${y(v)}`).join(' ')}"/>
      ${r.cumu.map((v, i) => `<circle cx="${xs[i]}" cy="${y(v)}" r="4" fill="${v >= 0 ? 'var(--ok)' : 'var(--bad)'}"/><text x="${xs[i]}" y="${H - 12}" text-anchor="middle">Y${i}</text><text x="${xs[i]}" y="${y(v) - 9}" text-anchor="middle">${money(v, cur)}</text>`).join('')}</svg>`;
    return `<div class="vh"><div><p class="eyebrow">Stage 5 · Business case</p><h1>TCO, NPV and payback</h1><p>Enough to compare options and frame the ask. Finance validates the final numbers; the cost of doing nothing is the current run cost carrying on.</p></div></div>
      <div class="finv"><div class="panel form">
        <div class="two"><label>Currency<input data-fin="cur" value="${esc(cur)}" maxlength="4"></label>${inp('years', 'Horizon (years)', 1)}</div>
        <div class="two">${inp('capex', 'Build (one-off)')}${inp('migration', 'Migration (one-off)')}</div>
        <div class="two">${inp('runNow', 'Run cost today / year')}${inp('runTarget', 'Run cost target / year')}</div>
        <div class="two">${inp('benefit', 'Business benefit / year')}${inp('ramp', 'Year-1 realisation %', 1)}</div>
        ${inp('rate', 'Discount rate %', 0.5)}
        <p class="note">Year 0 carries the one-off costs. From year 1, savings (run today − run target) and benefits are realised, at the year-1 percentage in the first year.</p>
      </div><div>
        <div class="kpis"><div class="kpi ${r.npv >= 0 ? 'good' : 'bad'}"><span>NPV</span><b>${money(r.npv, cur)}</b></div><div class="kpi"><span>ROI over ${r.N} y</span><b>${Math.round(r.roi * 100)}%</b></div>
          <div class="kpi ${r.pay !== null ? 'good' : 'bad'}"><span>Payback</span><b>${r.pay !== null ? r.pay.toFixed(1) + ' years' : 'not within ' + r.N + ' y'}</b></div><div class="kpi"><span>${r.N}-year TCO</span><b>${money(r.tcoTarget, cur)}</b><small class="note">vs ${money(r.tcoNow, cur)} doing nothing</small></div></div>
        <div class="chart">${svg}</div>
        <p class="note" style="margin-top:10px">Sensitivity: with benefits 20% lower, NPV is <b>${money(lo.npv, cur)}</b>; 20% higher, <b>${money(hi.npv, cur)}</b>.</p>
        <p style="margin-top:12px"><button class="btn" id="finToPage">Use in Strategy on a page</button></p>
      </div></div>`;
  };

  const PF = [['ambition', 'Business ambition', 2], ['vision', 'Technology vision', 2], ['principles', 'Architecture principles (one per line)', 5], ['bets', 'Strategic bets (one per line)', 3],
    ['h1', 'Horizon 1 · next 12 months', 3], ['h2', 'Horizon 2 · 1–2 years', 3], ['h3', 'Horizon 3 · 2–3 years', 2], ['investment', 'Investment and return', 2], ['kpis', 'Measures (one per line)', 4], ['risks', 'Top risks (one per line)', 3]];
  const ul = (s) => `<ul>${lines(s).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  function pageMarkdown() {
    const p = st.page, L = (s) => lines(s).map((x) => `- ${x}`).join('\n');
    return `# Technology strategy on a page · ${st.org}\n\n**Ambition:** ${p.ambition}\n\n**Vision:** ${p.vision}\n\n## Principles\n${L(p.principles)}\n\n## Strategic bets\n${L(p.bets)}\n\n## Roadmap\n**Horizon 1 (12 months)**\n${L(p.h1)}\n\n**Horizon 2 (1–2 years)**\n${L(p.h2)}\n\n**Horizon 3 (2–3 years)**\n${L(p.h3)}\n\n## Investment\n${p.investment}\n\n## Measures\n${L(p.kpis)}\n\n## Top risks\n${L(p.risks)}\n`;
  }
  V.page = () => {
    const p = st.page;
    return `<div class="vh"><div><p class="eyebrow">Stage 7 · CxO view</p><h1>Strategy on a page</h1><p>One page the CEO can repeat and every engineer can recognise. Edit on the left; copy it as Markdown or print it.</p></div>
      <div class="tools"><button class="btn" id="copyMd">Copy as Markdown</button><button class="btn primary" id="printPage">Print</button></div></div>
      <div class="sop"><div class="panel form">${PF.map(([k, l, n]) => `<label>${esc(l)}<textarea rows="${n}" data-page="${k}">${esc(p[k] || '')}</textarea></label>`).join('')}</div>
      <article class="paper"><div><h2>Technology strategy · ${esc(st.org)}</h2><p class="sub">Strategy on a page · ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</p></div>
        <p><b>Ambition.</b> ${esc(p.ambition)}</p><p class="vis">${esc(p.vision)}</p>
        <div class="pg"><div><h4>Principles</h4>${ul(p.principles)}</div><div><h4>Strategic bets</h4>${ul(p.bets)}</div></div>
        <div><h4 style="font:600 11px/1 var(--fm);letter-spacing:.1em;text-transform:uppercase;color:#b45f06;margin-bottom:6px">Roadmap</h4><div class="hz"><div><b>Horizon 1 · 12 months</b>${ul(p.h1)}</div><div><b>Horizon 2 · 1–2 years</b>${ul(p.h2)}</div><div><b>Horizon 3 · 2–3 years</b>${ul(p.h3)}</div></div></div>
        <div class="pg"><div><h4>Investment</h4><p style="font-size:13px">${esc(p.investment)}</p><h4 style="margin-top:12px">Top risks</h4>${ul(p.risks)}</div><div><h4>Measures</h4>${ul(p.kpis)}</div></div>
      </article></div>`;
  };

  function handoffData() {
    const p = st.page;
    return {
      principles: lines(p.principles),
      guardrails: lines(p.guardrails).map((l) => { const [t, src] = l.split('|').map((x) => x.trim()); return { t, src: src || `Strategy · ${st.org}` }; }),
      capabilities: lines(p.capabilities).map((l) => { const [name, ty] = l.split('|').map((x) => x.trim()); return { name, types: (ty || '').split(/[ ,]+/).filter(Boolean) }; }),
      briefs: [...lines(p.h1), ...lines(p.h2), ...lines(p.h3)],
    };
  }
  V.handoff = () => {
    const d = handoffData(), p = st.page, last = st.handedAt ? new Date(st.handedAt).toLocaleString() : '';
    const designHref = IN_APP ? '/projects' : '../prototype/index.html';
    return `<div class="vh"><div><p class="eyebrow">Convergence</p><h1>Hand-off to NEXUS</h1><p>The strategy becomes the reference every design is reviewed against. NEXUS imports these as EA principles, ground-truth rules and Technical Capabilities, and records the change so it can be undone.</p></div></div>
      <div class="flowx"><span>Strategy principles</span><i>→</i><span>NEXUS EA principles</span><span>Guardrails</span><i>→</i><span>Ground truth (blocking)</span><span>Approved stack</span><i>→</i><span>Technical Capabilities</span><span>Roadmap initiatives</span><i>→</i><span>Design briefs</span></div>
      <div class="ho">
        <section class="panel form"><h3>Principles <small>${d.principles.length}</small></h3><label>One per line (from Strategy on a page)<textarea rows="8" data-page="principles">${esc(p.principles)}</textarea></label></section>
        <section class="panel form"><h3>Guardrails <small>${d.guardrails.length}</small></h3><label>Non-negotiables: rule | source<textarea rows="8" data-page="guardrails">${esc(p.guardrails || '')}</textarea></label><p class="note">They join NEXUS ground truth. Rules NEXUS can already test (WAF, TLS, encryption, public storage, private links, DNS, dedicated circuits) are checked on every change; new ones are listed for reviewers and the models until a check is added.</p></section>
        <section class="panel form"><h3>Approved stack <small>${d.capabilities.length}</small></h3><label>Capability | component types<textarea rows="8" data-page="capabilities">${esc(p.capabilities || '')}</textarea></label><p class="note">Types: svc, api, db, cache, queue, obj, gw, lb, waf, cdn, dns, idp, egw, kms, sec, mon, reg, art, fn, vm.</p></section>
      </div>
      <section class="panel" style="margin-top:14px"><h3>Design briefs from the roadmap <small class="note">${d.briefs.length}</small></h3><ol>${d.briefs.map((b) => `<li>${esc(b)}</li>`).join('')}</ol><p class="note">Each initiative is the starting brief for a NEXUS design. Describe it in the NEXUS console to draft it inside the guardrails.</p></section>
      <p style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn mod" id="sendNexus">Send to NEXUS</button><a class="btn" href="${designHref}"${IN_APP ? ' target="_top"' : ''}>Open the design workbench</a></p>
      ${last ? `<div class="okbox">Sent ${esc(last)}. In the NEXUS design workbench, type <b>import strategy</b> in the console to apply it (it is reviewed and can be undone).</div>` : ''}`;
  };

  // ---------- drawer ----------
  function openArt(id) {
    const a = ART[id], s = st.arts[id] || {};
    $('#dTitle').textContent = a.name;
    $('#dBody').innerHTML = `<p class="note">Stage ${a.stage} · ${esc(STAGES[a.stage - 1].title)} · <span class="tag ${a.lens}">${esc(LENS[a.lens])}</span> ${a.delivery ? '<span class="tag cxo">delivery</span>' : '<span class="tag people">working</span>'} ${a.impacts.map((i) => `<span class="tag ${i}">${esc(i)}</span>`).join(' ')}</p>
      <p>${esc(a.why)}</p>
      <div class="form"><div class="two"><label>Status<select data-ad="s">${STATUS.map(([v, l]) => `<option value="${v}" ${v === (s.s || '') ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Owner<input data-ad="owner" value="${esc(s.owner || '')}" maxlength="80"></label></div>
      <label>Link to the document<input data-ad="link" value="${esc(s.link || '')}" placeholder="https://…"></label>
      <label>Notes<textarea data-ad="note" rows="3">${esc(s.note || '')}</textarea></label></div>
      <div class="tmpl"><b>Template</b><ol>${a.sections.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
      <p><button class="btn" id="copyTmpl">Copy template as Markdown</button> ${s.link ? `<a class="btn" href="${esc(s.link)}" target="_blank" rel="noopener">Open document</a>` : ''}</p>`;
    $('#drawer').hidden = false; $('#drawer').dataset.id = id; $('#dClose').focus();
  }

  // ---------- render and events ----------
  function render() {
    document.querySelectorAll('.views button').forEach((b) => (b.dataset.view === st.view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    $('#main').innerHTML = V[st.view](); $('#orgName').value = st.org || ''; progress();
  }
  $('#toDesign').href = IN_APP ? '/projects' : '../prototype/index.html';
  if (IN_APP) { document.documentElement.classList.add('embedded'); $('#toDesign').target = '_top'; }
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-view],[data-stage],[data-art],#sendNexus,#copyMd,#printPage,#copyTmpl,#finToPage,#exportBtn,#resetBtn,#dClose');
    if (!t) return;
    if (t.dataset.view) { st.view = t.dataset.view; save(); render(); $('#main').scrollTop = 0; return; }
    if (t.dataset.stage) { st.stage = +t.dataset.stage; save(); render(); $('#main').scrollTop = 0; return; }
    if (t.dataset.art) { openArt(t.dataset.art); return; }
    if (t.id === 'dClose') { $('#drawer').hidden = true; render(); return; }
    if (t.id === 'copyMd') { await copy(pageMarkdown()); return; }
    if (t.id === 'printPage') { window.print(); return; }
    if (t.id === 'copyTmpl') { const a = ART[$('#drawer').dataset.id]; await copy(`# ${a.name} · ${st.org}\n\n_${a.why}_\n\n${a.sections.map((x) => `## ${x}\n\n`).join('')}`); return; }
    if (t.id === 'finToPage') { const r = finCalc(st.fin), c = st.fin.cur || ''; st.page.investment = `${money(+st.fin.capex + +st.fin.migration, c)} one-off; NPV ${money(r.npv, c)} over ${r.N} years; payback ${r.pay !== null ? r.pay.toFixed(1) + ' years' : 'beyond the horizon'}.`; save(); toast('Added to Strategy on a page'); return; }
    if (t.id === 'sendNexus') {
      const d = handoffData(), id = 'H' + Date.now().toString(36);
      try { localStorage.setItem(HANDOFF, JSON.stringify({ id, from: 'NEXUS Strategy', org: st.org, at: new Date().toISOString(), ...d })); } catch (x) { toast('Could not save the hand-off in this browser'); return; }
      st.handedAt = Date.now(); save(); render(); toast(`Sent ${d.principles.length} principles, ${d.guardrails.length} guardrails, ${d.capabilities.length} capabilities`); return;
    }
    if (t.id === 'exportBtn') { const b = new Blob([JSON.stringify(st, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `nexus-strategy-${(st.org || 'export').replace(/\W+/g, '-').toLowerCase()}.json`; a.click(); URL.revokeObjectURL(a.href); return; }
    if (t.id === 'resetBtn') { if (confirm('Start again from the example? Your entries in this browser are replaced.')) { st = EXAMPLE(); save(); render(); } return; }
  });
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (e) { const a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('Copied'); } catch (x) { toast('Copy failed'); } a.remove(); } }
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.gate) { st.gates[t.dataset.gate] = t.checked; save(); render(); return; }
    if (t.dataset.f !== undefined && t.tagName === 'SELECT') { st.af[t.dataset.f] = t.value; save(); render(); return; }
    if (t.dataset.ad) { const id = $('#drawer').dataset.id; st.arts[id] = { ...(st.arts[id] || {}), [t.dataset.ad]: t.value }; save(); return; }
    if (t.id === 'importIn' && t.files[0]) { t.files[0].text().then((x) => { try { const o = JSON.parse(x); if (!o.page || !o.arts) throw 0; st = o; save(); render(); toast('Imported'); } catch (er) { toast('That file is not a NEXUS Strategy export'); } }); t.value = ''; }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'orgName') { st.org = t.value; save(); progress(); return; }
    if (t.dataset.page) { st.page[t.dataset.page] = t.value; save(); if (st.view === 'page') { const sel = [t.selectionStart, t.selectionEnd], k = t.dataset.page; render(); const n = document.querySelector(`[data-page="${k}"]`); n.focus(); n.setSelectionRange(...sel); } return; }
    if (t.dataset.fin) { st.fin[t.dataset.fin] = t.value; save(); const k = t.dataset.fin, sel = t.type === 'number' ? null : [t.selectionStart, t.selectionEnd]; render(); const n = document.querySelector(`[data-fin="${k}"]`); n.focus(); if (sel) n.setSelectionRange(...sel); return; }
    if (t.dataset.f === 'q') { st.af.q = t.value; save(); render(); const n = document.querySelector('[data-f="q"]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); return; }
    if (t.dataset.ad) { const id = $('#drawer').dataset.id; st.arts[id] = { ...(st.arts[id] || {}), [t.dataset.ad]: t.value }; save(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) { $('#drawer').hidden = true; render(); } });
  render();
})();
