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
  const EMPTY = (org = '') => ({ org, view: 'flow', stage: 1, arts: {}, gates: {}, notes: {},
    fin: { cur: 'S$', years: 5, rate: 8, capex: 0, migration: 0, runNow: 0, runTarget: 0, benefit: 0, ramp: 40 },
    page: { ambition: '', vision: '', principles: '', guardrails: '', capabilities: '', bets: '', h1: '', h2: '', h3: '', investment: '', kpis: '', risks: '' } });
  // Several strategies per browser: { cur, items: { id: strategy }, wiz: draft of a new one, llm: model settings }.
  let root;
  try { const raw = JSON.parse(localStorage.getItem(KEY)); root = raw && raw.items ? raw : raw && raw.page ? { cur: 's1', items: { s1: raw } } : null; } catch (e) { root = null; }
  if (!root || !root.items || !root.items[root.cur]) root = { cur: 's1', items: { s1: EXAMPLE() } };
  let st = root.items[root.cur];
  if (root.wiz) root.wiz.busy = '';
  const save = () => { if (st) root.items[root.cur] = st; try { localStorage.setItem(KEY, JSON.stringify(root)); } catch (e) {} };
  const newId = () => 's' + Date.now().toString(36);
  function switchTo(id) { if (!root.items[id]) return; root.cur = id; st = root.items[id]; root.wiz = root.wiz && root.wiz.open ? { ...root.wiz, open: false } : root.wiz; save(); render(); }
  const toast = (t) => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2200); };

  // ---------- helpers ----------
  const artSt = (id) => (st.arts[id] && st.arts[id].s) || '';
  const dot = (id) => `<span class="dot ${artSt(id)}" title="${esc(STATUS.find((s) => s[0] === artSt(id))[1])}"></span>`;
  const gateDone = (s) => s.gate.every((_, i) => st.gates[`${s.id}:${i}`]);
  const gateShare = (s) => s.gate.filter((_, i) => st.gates[`${s.id}:${i}`]).length / s.gate.length;
  function progress() {
    const all = STAGES.reduce((n, s) => n + s.gate.length, 0), done = STAGES.reduce((n, s) => n + s.gate.filter((_, i) => st.gates[`${s.id}:${i}`]).length, 0);
    const p = Math.round((done / all) * 100);
    $('#progTxt').textContent = `${p}%`; $('#progTxt').parentElement.title = `${p}% of exit-gate items met`; $('#progBar').style.width = p + '%';
  }
  const artChip = (a) => `<button class="art" data-art="${a.id}">${dot(a.id)}${esc(a.name)}${a.delivery ? '<span class="dl">DELIVERY</span>' : ''}</button>`;

  // ---------- views ----------
  const V = {};
  V.flow = () => {
    const s = STAGES[st.stage - 1];
    const step = STAGES.map((x) => `<button data-stage="${x.n}" ${x.n === s.n ? 'aria-current="step"' : ''} class="${gateDone(x) ? 'done' : ''}"><span class="n">${String(x.n).padStart(2, '0')}</span><b>${esc(x.title)}</b><span class="mini"><i style="width:${Math.round(gateShare(x) * 100)}%"></i></span></button>`).join('');
    const mine = (st.notes || {})[s.id] || {};
    const lens = LENSES.map(([k, l]) => `<section class="lens ${k}"><h3>${esc(l)}</h3><ul>${s.lenses[k].map((t) => `<li>${esc(t)}</li>`).join('')}</ul>${lines(mine[k]).length ? `<h4>For ${esc(st.org || 'your organisation')}</h4><ul class="mine">${lines(mine[k]).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
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

  // ---------- New strategy, in plain words: idea → overview → one step per level → decide → create ----------
  // Written for a business leader. The local model drafts in plain language; the architect keeps, drops,
  // edits or deep-dives every item; Create translates it into the technical workflow for the technology team.
  const LEVELS = [['business', 'Business', 'What changes for customers and the business'], ['people', 'People', 'Skills, roles and ways of working'],
    ['process', 'Process', 'How work and decisions flow'], ['technology', 'Technology', 'Platforms and systems'], ['data', 'Data & AI', 'Data, models and their controls'], ['money', 'Money', 'Investment, savings and value']];
  const LV = Object.fromEntries(LEVELS.map((l) => [l[0], l]));
  const STEPS = ['idea', 'overview', ...LEVELS.map((l) => l[0]), 'decide', 'finish'];
  const PLAIN = 'Write for a non-technical executive: short, plain sentences and no jargon. When a technical term is unavoidable, explain it in brackets. Be specific to this organisation, never generic. Mark assumptions with "(assumption)".';
  const SYS_CORE = `You help a business leader turn a strategy idea into a clear plan that the technology team can carry out. ${PLAIN}
Reply with one JSON object only:
{"title": "short name of the strategy", "org": "organisation name", "summary": "2 or 3 sentences: what we will do and why", "vision": "one sentence: what it looks like when it works", "goals": ["3 or 4 measurable outcomes, from today to the target"], "principles": ["4 to 6 simple rules everyone follows"], "bets": ["3 big bets"], "first": ["3 things in the first 12 months"], "next": ["3 things in years 1 to 2"], "later": ["2 things in years 2 to 3"], "decisions": ["3 to 5 decisions the leadership must take"], "risks": ["3 or 4 risks in plain words"], "guardrails": [{"t": "a rule that must never be broken", "src": "where it comes from: a regulation or policy"}], "capabilities": [{"name": "an approved technology", "types": ["svc"]}], "fin": {"cur": "S$", "capex": 0, "migration": 0, "runNow": 0, "runTarget": 0, "benefit": 0}, "questions": ["up to 3 questions whose answers would most improve this plan"]}
Capability types: svc, api, db, cache, queue, obj, gw, lb, waf, cdn, dns, idp, egw, kms, sec, mon, reg, art, fn, vm. Money is a rough assumption in whole units (per year where it says so) for finance to check.`;
  const SYS_LEVEL = `You explain one level of a strategy plan. ${PLAIN}
"requires" are concrete things that must exist or be done at this level. "depends" are things this level needs from another level (business, people, process, technology, data, money) or from outside (external).
Reply with one JSON object only: {"means": "one sentence: what this strategy means at this level", "requires": [{"t": "requirement", "why": "short reason"}], "depends": [{"t": "dependency", "on": "business|people|process|technology|data|money|external"}], "questions": ["up to 2 questions for the architect"]}
Give 3 to 6 requirements and 2 to 5 dependencies.`;
  const SYS_DEEP = `You break one requirement of a strategy into smaller pieces. ${PLAIN}
Reply with one JSON object only: {"explain": "one sentence on what it really involves", "requires": ["2 to 4 smaller steps"], "depends": ["1 to 3 things it depends on, naming the level in brackets"]}`;
  const asLines = (x, n = 8, len = 300) => (Array.isArray(x) ? x : typeof x === 'string' ? x.split('\n') : [])
    .map((v) => (typeof v === 'string' ? v : v && (v.t || v.text || v.name || v.title)) || '').map((v) => String(v).replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean).slice(0, n).map((v) => v.slice(0, len));
  const numOr = (v, d) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) && n >= 0 ? Math.round(n) : d; };
  function extractJSON(t) { t = String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, ''); const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; } }
  const defaultBase = () => (location.protocol.startsWith('http') ? '/llm/v1' : '');
  async function chat(sys, user) {
    const L = root.llm || (root.llm = { base: defaultBase(), model: '' });
    if (!L.base) throw new Error('There is no model server here. Open NEXUS from Buddy (the app or the canvas) to use AI.');
    const base = L.base.replace(/\/$/, '');
    let model = L.model;
    if (!model) {
      let r; try { r = await fetch(base + '/models'); } catch (e) { throw new Error(`Could not reach the model server at ${base}`); }
      if (!r.ok) throw new Error(`The model server answered ${r.status}${r.status === 401 ? ' (sign in to NEXUS first)' : ''}`);
      const ids = ((await r.json()).data || []).map((m) => m.id);
      model = ids.find((i) => /qwen/i.test(i) && /instruct/i.test(i)) || ids.find((i) => /qwen/i.test(i)) || ids.find((i) => !/embed|vl|coder/i.test(i));
      if (!model) throw new Error('The model server has no chat model'); L.model = model; save();
    }
    const ctrl = new AbortController(), to = setTimeout(() => ctrl.abort(), 240000);
    try {
      const r = await fetch(base + '/chat/completions', { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }) });
      if (!r.ok) throw new Error(`The model server answered ${r.status}`);
      const j = await r.json(), o = extractJSON(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
      if (!o) throw new Error('The model did not return a usable draft'); return { o, model };
    } catch (e) { throw e.name === 'AbortError' ? new Error('The model took longer than 4 minutes') : e instanceof TypeError ? new Error(`Could not reach the model server at ${base}`) : e; } finally { clearTimeout(to); }
  }
  const one = (x) => (Array.isArray(x) ? x : lines(x)).join('; ');
  function coreFrom(o, org) {
    const f = o.fin || {};
    return { title: String(o.title || 'New strategy').slice(0, 120), org: String(o.org || org || '').slice(0, 80), summary: String(o.summary || '').slice(0, 800), vision: String(o.vision || '').slice(0, 400),
      goals: asLines(o.goals, 6).join('\n'), principles: asLines(o.principles, 8).join('\n'), bets: asLines(o.bets, 5).join('\n'), first: asLines(o.first, 5).join('\n'), next: asLines(o.next, 5).join('\n'), later: asLines(o.later, 4).join('\n'),
      decisions: asLines(o.decisions, 6).map((t) => ({ t, keep: true })), risks: asLines(o.risks, 6).join('\n'),
      guardrails: (Array.isArray(o.guardrails) ? o.guardrails : []).slice(0, 8).map((g) => typeof g === 'string' ? g : `${g.t || g.rule || ''} | ${g.src || g.source || ''}`).filter((x) => x.replace(/[|\s]/g, '')).join('\n'),
      capabilities: (Array.isArray(o.capabilities) ? o.capabilities : []).slice(0, 10).map((c) => typeof c === 'string' ? c : `${c.name || ''} | ${(c.types || []).join(', ')}`).filter((x) => x.replace(/[|\s,]/g, '')).join('\n'),
      fin: { cur: String(f.cur || 'S$').slice(0, 4), capex: numOr(f.capex, 0), migration: numOr(f.migration, 0), runNow: numOr(f.runNow, 0), runTarget: numOr(f.runTarget, 0), benefit: numOr(f.benefit, 0), years: 5, rate: 8, ramp: 40 },
      questions: asLines(o.questions, 3) };
  }
  const blankCore = (idea, org) => coreFrom({ title: 'New strategy', summary: String(idea || '').slice(0, 800) }, org);
  const items = (x, n) => (Array.isArray(x) ? x : []).slice(0, n).map((v) => typeof v === 'string' ? { t: v } : v).filter((v) => v && (v.t || v.text)).map((v) => ({ t: String(v.t || v.text).slice(0, 240), why: String(v.why || '').slice(0, 240), on: LV[v.on] || v.on === 'external' ? v.on : '', keep: true }));
  const blankLevel = (k) => ({ src: 'blank', means: '', requires: [], depends: [], questions: [] });
  function brief(w) { const c = w.core; return `Organisation: ${w.org || c.org || '(not named)'}\nStrategy: ${c.title}\nSummary: ${c.summary}\nVision: ${c.vision}\nGoals: ${one(c.goals)}\nPrinciples: ${one(c.principles)}\nFirst 12 months: ${one(c.first)}`; }
  async function draftLevel(k, ask) {
    const w = root.wiz, cur = w.levels[k];
    const { o, model } = await chat(SYS_LEVEL, `${brief(w)}\n\nLevel: ${LV[k][1]} (${LV[k][2]})` + (ask && cur ? `\n\nCurrent draft:\n${JSON.stringify({ means: cur.means, requires: cur.requires.map((x) => x.t), depends: cur.depends.map((x) => x.t) })}\nChange it as the architect asks: ${ask}` : ''));
    return { src: 'ai', model, means: String(o.means || '').slice(0, 400), requires: items(o.requires, 8), depends: items(o.depends, 6), questions: asLines(o.questions, 2) };
  }
  const get = (w, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), w);
  let tick = null;
  const W = {
    start() { root.wiz = { open: true, step: 0, max: 0, idea: '', org: '', ai: true, core: null, levels: {}, busy: '', note: '', ask: '', add: {} }; save(); render(); $('#main').scrollTop = 0; setTimeout(() => { const n = $('[data-wf="idea"]'); if (n) n.focus(); }, 0); },
    field(t) {
      const w = root.wiz, path = t.dataset.wf;
      if (path.startsWith('llm.')) { root.llm = { ...(root.llm || { base: defaultBase(), model: '' }), [path.slice(4)]: t.value }; save(); return; }
      if (path === 'ai') { w.ai = t.checked; save(); render(); return; }
      const ks = path.split('.'), last = ks.pop(), o = ks.length ? get(w, ks.join('.')) : w; if (o) { o[last] = t.value; save(); }
    },
    async busyRun(label, fn) {
      const w = root.wiz; w.busy = label; w.note = ''; const t0 = Date.now(); render();
      clearInterval(tick); tick = setInterval(() => { const e = $('#wsec'); if (e) e.textContent = Math.round((Date.now() - t0) / 1000) + ' s'; }, 1000);
      try { await fn(); } catch (e) { w.note = e.message || String(e); } finally { clearInterval(tick); w.busy = ''; save(); render(); }
    },
    async enterStep(i) {
      const w = root.wiz; w.step = i; w.max = Math.max(w.max, i); w.ask = ''; save();
      const k = STEPS[i];
      if (LV[k] && !w.levels[k]) {
        if (w.ai && !w.offline) await W.busyRun(`Working out ${LV[k][1]}`, async () => { try { w.levels[k] = await draftLevel(k); } catch (e) { w.levels[k] = blankLevel(k); throw new Error(`${e.message}. Add the requirements and dependencies yourself, or press Ask AI to try again.`); } });
        else { w.levels[k] = blankLevel(k); save(); }
      }
      render(); $('#main').scrollTop = 0;
    },
    async act(a, t) {
      const w = root.wiz; if (!w || w.busy) return;
      const P = t.dataset.path;
      if (a === 'cancel') { if (confirm('Discard this new strategy?')) { root.wiz = null; save(); render(); } return; }
      if (a === 'back') { W.enterStep(Math.max(0, w.step - 1)); return; }
      if (a === 'go') { const i = +t.dataset.i; if (i <= w.max) W.enterStep(i); return; }
      if (a === 'next') { W.enterStep(Math.min(STEPS.length - 1, w.step + 1)); return; }
      if (a === 'example') { const id = newId(); root.items[id] = EXAMPLE(); root.wiz = null; switchTo(id); toast('Opened a copy of the example'); return; }
      if (a === 'keep') { const it = get(w, P); it.keep = !it.keep; save(); render(); return; }
      if (a === 'add') { const k = P.replace(/\./g, '_'), v = String((w.add || {})[k] || '').trim(); if (!v) return; get(w, P).push({ t: v, why: '', on: '', keep: true }); w.add[k] = ''; save(); render(); return; }
      if (a === 'deeper') {
        const it = get(w, P), lvl = LV[P.split('.')[1]];
        await W.busyRun(`Going deeper: ${it.t.slice(0, 60)}`, async () => { const { o } = await chat(SYS_DEEP, `${brief(w)}\n\nLevel: ${lvl[1]}\nRequirement: ${it.t}${it.why ? ` (because ${it.why})` : ''}`); it.deep = { explain: String(o.explain || '').slice(0, 400), requires: asLines(o.requires, 5), depends: asLines(o.depends, 4) }; });
        return;
      }
      if (a === 'start') {
        if (String(w.idea).trim().length < 15) { w.note = 'Say a little more about the idea first: a sentence or two is enough.'; render(); return; }
        if (!w.ai) { w.core = blankCore(w.idea, w.org); w.offline = true; W.enterStep(1); return; }
        await W.busyRun('Turning your idea into a plan', async () => {
          try { const { o, model } = await chat(SYS_CORE, `Organisation: ${w.org || '(not given)'}\nThe idea, in their own words:\n${w.idea}`); w.core = coreFrom(o, w.org); w.model = model; w.offline = false; if (!w.org && w.core.org) w.org = w.core.org; }
          catch (e) { w.core = blankCore(w.idea, w.org); w.offline = true; throw new Error(`${e.message}. Carry on without AI: fill in the overview and each level yourself.`); }
        });
        if (w.core) { w.step = 1; w.max = Math.max(w.max, 1); save(); render(); }
        return;
      }
      if (a === 'askCore') {
        const ask = String(w.ask || '').trim(); if (!ask) { w.note = 'Type your answers or what to change first.'; render(); return; }
        await W.busyRun('Updating the plan', async () => { const { o, model } = await chat(SYS_CORE, `Organisation: ${w.org || '(not given)'}\nThe idea, in their own words:\n${w.idea}\n\nCurrent plan:\n${JSON.stringify({ ...w.core, decisions: w.core.decisions.map((d) => d.t), questions: undefined })}\n\nThe architect's answers and requested changes:\n${ask}\nReturn the whole updated plan.`); w.core = coreFrom(o, w.org); w.model = model; w.ask = ''; w.offline = false; w.levels = {}; w.max = 1; });
        return;
      }
      if (a === 'askLevel') {
        const k = STEPS[w.step], ask = String(w.ask || '').trim() || 'Make it more specific to this organisation.';
        await W.busyRun(`Updating ${LV[k][1]}`, async () => { w.levels[k] = await draftLevel(k, ask); w.ask = ''; w.offline = false; });
        return;
      }
      if (a === 'create') { W.create(); }
    },
    create() {
      const w = root.wiz, c = w.core, s = EMPTY(w.org || c.org || c.title || 'New strategy');
      const kept = (k, f) => ((w.levels[k] || {})[f] || []).filter((x) => x.keep);
      const req = (k) => kept(k, 'requires').map((x) => x.t + (x.deep && x.deep.requires.length ? ` (${x.deep.requires.join('; ')})` : ''));
      const dep = (k) => kept(k, 'depends').map((x) => `${x.t}${x.on ? ` [${x.on}]` : ''}`);
      const block = (k) => [w.levels[k] && w.levels[k].means, ...req(k).map((x) => 'Requires: ' + x), ...dep(k).map((x) => 'Depends on: ' + x)].filter(Boolean).join('\n');
      s.page = { ...s.page, ambition: c.summary, vision: c.vision, principles: c.principles, bets: c.bets, h1: c.first, h2: c.next, h3: c.later, kpis: c.goals, risks: c.risks, guardrails: c.guardrails, capabilities: c.capabilities,
        investment: (kept('money', 'requires').map((x) => x.t)[0]) || '' };
      s.fin = { ...s.fin, ...c.fin };
      // the plain-language plan, projected onto the technical workflow
      const decisions = c.decisions.filter((d) => d.keep).map((d) => d.t);
      s.notes = {
        mandate: { biz: [c.summary, ...lines(c.goals)].filter(Boolean).join('\n'), cxo: decisions.join('\n') },
        baseline: { tech: dep('technology').concat(dep('data')).join('\n'), biz: dep('business').join('\n') },
        vision: { tech: [...req('technology'), ...req('data')].join('\n'), biz: req('business').join('\n'), cxo: [c.vision, ...lines(c.principles)].filter(Boolean).join('\n') },
        options: { tech: [...dep('technology'), ...dep('data')].join('\n') },
        case: { fin: req('money').join('\n'), biz: dep('money').join('\n') },
        decide: { cxo: decisions.join('\n') },
        roadmap: { tech: lines(c.first).join('\n'), cxo: [...lines(c.first), ...lines(c.next), ...lines(c.later)].join('\n') },
        mobilise: { biz: [...req('people'), ...req('process')].join('\n'), cxo: dep('people').join('\n') },
        govern: { tech: lines(c.guardrails).map((g) => g.split('|')[0].trim()).join('\n'), biz: lines(c.goals).join('\n') },
      };
      const draft = (id, txt) => { if (String(txt || '').trim()) s.arts[id] = { s: 'draft', owner: '', note: txt }; };
      draft('charter', `${c.title}\n${c.summary}\nGoals:\n${lines(c.goals).map((x) => '- ' + x).join('\n')}\nDecisions needed:\n${decisions.map((x) => '- ' + x).join('\n')}`);
      draft('drivers', block('business')); draft('vision', `${c.vision}\nPrinciples:\n${lines(c.principles).map((x) => '- ' + x).join('\n')}`);
      draft('target', [block('technology'), block('data')].filter(Boolean).join('\n\n')); draft('targetcap', block('business'));
      draft('deps', LEVELS.map(([k, l]) => dep(k).map((x) => `${l}: ${x}`).join('\n')).filter(Boolean).join('\n'));
      draft('tom', [block('people'), block('process')].filter(Boolean).join('\n\n')); draft('talent', block('people'));
      draft('bizcase', block('money')); draft('riskreg', lines(c.risks).map((x) => '- ' + x).join('\n'));
      draft('roadmap', `First 12 months:\n${lines(c.first).map((x) => '- ' + x).join('\n')}\nYears 1–2:\n${lines(c.next).map((x) => '- ' + x).join('\n')}\nYears 2–3:\n${lines(c.later).map((x) => '- ' + x).join('\n')}`);
      draft('onepage', `${c.title}: ${c.summary}`);
      s.view = 'page'; s.drafted = { model: w.model || '', at: Date.now(), idea: w.idea, plan: { levels: w.levels, decisions } };
      const id = newId(); root.items[id] = s; root.wiz = null; switchTo(id); toast('Created. The technology team view is in Workflow and Artefacts.');
    },
    list(path, arr, deeper) {
      const w = root.wiz, dis = w.busy ? 'disabled' : '', addKey = path.replace(/\./g, '_');
      return `<ul class="wl2">${arr.map((it, i) => `<li class="${it.keep ? '' : 'dropped'}"><div class="wrow">
          <button class="keep" data-w="keep" data-path="${path}.${i}" title="${it.keep ? 'Kept: click to drop' : 'Dropped: click to keep'}" aria-pressed="${it.keep}" ${dis}>${it.keep ? '✓' : '✕'}</button>
          <input data-wf="${path}.${i}.t" value="${esc(it.t)}" aria-label="Item" ${dis}>
          ${it.on ? `<span class="on">${esc(LV[it.on] ? LV[it.on][1] : 'External')}</span>` : ''}
          ${deeper && it.keep ? `<button class="btn small" data-w="deeper" data-path="${path}.${i}" ${dis || (w.offline ? 'disabled' : '')} title="Break this down with AI">Deeper</button>` : ''}</div>
          ${it.why ? `<p class="why">${esc(it.why)}</p>` : ''}
          ${it.deep ? `<div class="deep"><p>${esc(it.deep.explain)}</p>${it.deep.requires.length ? `<b>Requires</b><ul>${it.deep.requires.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${it.deep.depends.length ? `<b>Depends on</b><ul>${it.deep.depends.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>` : ''}</li>`).join('')}
        <li class="addrow"><input data-wf="add.${addKey}" value="${esc((w.add || {})[addKey] || '')}" placeholder="Add one…" ${dis}><button class="btn small" data-w="add" data-path="${path}" ${dis}>Add</button></li></ul>`;
    },
    view() {
      const w = root.wiz, i = w.step, k = STEPS[i], busy = !!w.busy, dis = busy ? 'disabled' : '';
      const label = (x) => (x === 'idea' ? 'Your idea' : x === 'overview' ? 'Overview' : x === 'decide' ? 'Decide' : x === 'finish' ? 'Create' : LV[x][1]);
      const crumbs = STEPS.map((x, j) => `<button class="wstep ${j === i ? 'on' : ''} ${j <= w.max ? 'seen' : ''}" data-w="go" data-i="${j}" ${j > w.max || busy ? 'disabled' : ''}>${esc(label(x))}</button>`).join('<span class="arr">›</span>');
      const title = k === 'idea' ? 'What do you want to achieve?' : k === 'overview' ? (w.core.title || 'Your plan') : k === 'decide' ? 'What needs deciding' : k === 'finish' ? 'Ready' : LV[k][1];
      const head = `<div class="vh"><div><p class="eyebrow">New strategy</p><h1>${esc(title)}</h1></div><button class="btn ghost" data-w="cancel" ${dis}>Discard</button></div><nav class="wsteps" aria-label="Steps">${crumbs}</nav>`;
      const note = w.note ? `<div class="wnote" role="alert">${esc(w.note)}</div>` : '';
      const spin = busy ? `<div class="wbusy" role="status"><span class="spin"></span><b>${esc(w.busy)}</b><span class="note">${esc((root.llm && root.llm.model) || 'local model')} · <span id="wsec">0 s</span> · a local model can take a minute</span></div>` : '';
      const nav = (nextLabel) => `<div class="wnav"><button class="btn" data-w="back" ${i === 0 || busy ? 'disabled' : ''}>← Back</button><span class="sp"></span><button class="btn primary big" data-w="next" ${dis}>${esc(nextLabel)} →</button></div>`;
      const ask = (act, ph) => `<div class="wask"><input data-wf="ask" value="${esc(w.ask)}" placeholder="${esc(ph)}" ${dis}><button class="btn" data-w="${act}" ${dis || (w.offline && act === 'askCore' && !(root.llm && root.llm.base) ? 'disabled' : '')}>Ask AI</button></div>`;
      if (k === 'idea') {
        const L = root.llm || { base: defaultBase(), model: '' };
        return head + note + spin + `<section class="wcard">
          <textarea class="wbig" data-wf="idea" rows="5" placeholder="Say it the way you would to your board. For example: “We want to be an AI-first bank: every customer conversation helped by AI, staff freed from paperwork, and no surprises for the regulator.”" ${dis}>${esc(w.idea)}</textarea>
          <div class="wline"><input data-wf="org" value="${esc(w.org)}" placeholder="Organisation (optional)" maxlength="80" ${dis}>
          <label class="wai"><input type="checkbox" data-wf="ai" ${w.ai ? 'checked' : ''} ${dis}> Let the local AI draft it</label></div>
          <details class="wmore"><summary>Model settings</summary><div class="two form"><label>Endpoint<input data-wf="llm.base" value="${esc(L.base)}" placeholder="/llm/v1"></label><label>Model (empty = a Qwen model)<input data-wf="llm.model" value="${esc(L.model)}"></label></div></details>
          <p class="note">The AI drafts in plain words; you keep, drop or change everything. Then NEXUS turns it into the plan your technology team works from.</p></section>
          <div class="wnav"><button class="btn ghost" data-w="example" ${dis}>Or open the example</button><span class="sp"></span><button class="btn primary big" data-w="start" ${dis}>${w.ai ? 'Draft my plan' : 'Start'} →</button></div>`;
      }
      if (k === 'overview') {
        const c = w.core;
        return head + note + spin + `<section class="wcard"><label class="wlbl">In short<textarea data-wf="core.summary" rows="3" ${dis}>${esc(c.summary)}</textarea></label>
          <label class="wlbl">When it works<textarea data-wf="core.vision" rows="2" ${dis}>${esc(c.vision)}</textarea></label>
          <div class="wcols"><label class="wlbl">Goals we will measure<textarea data-wf="core.goals" rows="4" ${dis}>${esc(c.goals)}</textarea></label>
          <label class="wlbl">Rules we follow<textarea data-wf="core.principles" rows="4" ${dis}>${esc(c.principles)}</textarea></label></div>
          ${c.questions && c.questions.length ? `<div class="wq"><b>To make it better, the AI asks:</b><ol>${c.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol></div>` : ''}
          ${ask('askCore', 'Answer the questions or say what to change…')}</section>` + nav(`Next: ${LV.business[1]}`);
      }
      if (LV[k]) {
        const d = w.levels[k] || blankLevel(k), j = LEVELS.findIndex((l) => l[0] === k), nextL = LEVELS[j + 1];
        return head + note + spin + `<p class="wsub">${esc(LV[k][2])}</p>
          <section class="wcard"><label class="wlbl">What this means for us<input data-wf="levels.${k}.means" value="${esc(d.means)}" placeholder="One sentence" ${dis}></label>
          <div class="wcols"><div><h3 class="wh">What it requires</h3>${W.list(`levels.${k}.requires`, d.requires, true)}</div>
          <div><h3 class="wh">What it depends on</h3>${W.list(`levels.${k}.depends`, d.depends, false)}</div></div>
          ${d.questions && d.questions.length ? `<div class="wq"><b>For the architect:</b><ul>${d.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></div>` : ''}
          ${ask('askLevel', `Tell the AI what to change in ${LV[k][1]}…`)}</section>` + nav(nextL ? `Next: ${nextL[1]}` : 'Next: Decide');
      }
      if (k === 'decide') {
        const c = w.core;
        return head + note + spin + `<p class="wsub">The architect confirms what goes to the leadership. Untick anything that should not.</p>
          <section class="wcard"><h3 class="wh">Decisions the leadership must take</h3>${W.list('core.decisions', c.decisions, false)}
          <div class="wcols"><label class="wlbl">Risks<textarea data-wf="core.risks" rows="4" ${dis}>${esc(c.risks)}</textarea></label><label class="wlbl">First 12 months<textarea data-wf="core.first" rows="4" ${dis}>${esc(c.first)}</textarea></label></div>
          <details class="wmore"><summary>For the technology team: guardrails, approved technology, later horizons, money</summary>
            <div class="wcols"><label class="wlbl">Rules never to break (rule | source)<textarea data-wf="core.guardrails" rows="4" ${dis}>${esc(c.guardrails)}</textarea></label><label class="wlbl">Approved technology (name | types)<textarea data-wf="core.capabilities" rows="4" ${dis}>${esc(c.capabilities)}</textarea></label>
            <label class="wlbl">Years 1–2<textarea data-wf="core.next" rows="3" ${dis}>${esc(c.next)}</textarea></label><label class="wlbl">Years 2–3<textarea data-wf="core.later" rows="3" ${dis}>${esc(c.later)}</textarea></label></div>
            <div class="two form"><label>Build (one-off)<input type="number" data-wf="core.fin.capex" value="${esc(c.fin.capex)}" ${dis}></label><label>Business benefit / year<input type="number" data-wf="core.fin.benefit" value="${esc(c.fin.benefit)}" ${dis}></label></div></details></section>` + nav('Next: Create');
      }
      const c = w.core, kept = (f) => LEVELS.reduce((n, [x]) => n + ((w.levels[x] || {})[f] || []).filter((y) => y.keep).length, 0);
      return head + note + `<section class="wcard"><h2>${esc(c.title)}</h2><p>${esc(c.summary)}</p>
        <ul class="mlist"><li>${lines(c.goals).length} goals, ${lines(c.principles).length} rules</li><li>${kept('requires')} requirements and ${kept('depends')} dependencies across ${LEVELS.filter(([x]) => w.levels[x]).length} levels</li><li>${c.decisions.filter((d) => d.keep).length} decisions for the leadership</li></ul>
        <p class="note">Create opens Strategy on a page. For the technology team, the plan is translated into the nine-stage Workflow ("For ${esc(w.org || c.org || 'your organisation')}" in each lens) and into draft artefacts, and its rules and technology are ready to hand off to NEXUS.</p></section>
        <div class="wnav"><button class="btn" data-w="back">← Back</button><span class="sp"></span><button class="btn mod big" data-w="create">Create strategy</button></div>`;
    },
  };

  // ---------- render and events ----------
  function render() {
    document.querySelectorAll('.views button').forEach((b) => (b.dataset.view === st.view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    const wiz = root.wiz && root.wiz.open;
    if (wiz) document.querySelectorAll('.views button').forEach((b) => b.removeAttribute('aria-current'));
    $('#stratSel').innerHTML = Object.entries(root.items).map(([id, x]) => `<option value="${id}" ${id === root.cur && !wiz ? 'selected' : ''}>${esc(x.org || 'Untitled strategy')}</option>`).join('') + (wiz ? '<option selected>New strategy…</option>' : '');
    $('#main').innerHTML = wiz ? W.view() : V[st.view](); $('#orgName').value = st.org || ''; $('#orgName').disabled = !!wiz; progress();
  }
  $('#toDesign').href = IN_APP ? '/projects' : '../prototype/index.html';
  if (IN_APP) { document.documentElement.classList.add('embedded'); $('#toDesign').target = '_top'; }
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-view],[data-stage],[data-art],[data-w],#sendNexus,#copyMd,#printPage,#copyTmpl,#finToPage,#exportBtn,#resetBtn,#newBtn,#dClose');
    if (!t) return;
    if (t.dataset.view) { if (root.wiz) root.wiz.open = false; st.view = t.dataset.view; save(); render(); $('#main').scrollTop = 0; return; }
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
    if (t.id === 'resetBtn') {
      if (!confirm(`Delete "${st.org || 'Untitled strategy'}" from this browser? Export it first if you want a copy.`)) return;
      delete root.items[root.cur]; const ids = Object.keys(root.items);
      if (!ids.length) { root.items.s1 = EXAMPLE(); ids.push('s1'); }
      switchTo(ids[0]); toast('Deleted'); return;
    }
    if (t.id === 'newBtn') { W.start(); return; }
    if (t.dataset.w) { W.act(t.dataset.w, t); return; }
  });
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (e) { const a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('Copied'); } catch (x) { toast('Copy failed'); } a.remove(); } }
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.gate) { st.gates[t.dataset.gate] = t.checked; save(); render(); return; }
    if (t.dataset.f !== undefined && t.tagName === 'SELECT') { st.af[t.dataset.f] = t.value; save(); render(); return; }
    if (t.dataset.ad) { const id = $('#drawer').dataset.id; st.arts[id] = { ...(st.arts[id] || {}), [t.dataset.ad]: t.value }; save(); return; }
    if (t.id === 'importIn' && t.files[0]) { t.files[0].text().then((x) => { try { const o = JSON.parse(x); if (!o.page || !o.arts) throw 0; const id = newId(); root.items[id] = { ...EMPTY(), ...o }; switchTo(id); toast('Imported as a new strategy'); } catch (er) { toast('That file is not a NEXUS Strategy export'); } }); t.value = ''; }
    if (t.id === 'stratSel') { if (root.items[t.value]) switchTo(t.value); return; }
    if (t.dataset.wf !== undefined) { W.field(t); return; }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'orgName') { st.org = t.value; save(); progress(); const o = $('#stratSel').selectedOptions[0]; if (o) o.textContent = t.value || 'Untitled strategy'; return; }
    if (t.dataset.wf !== undefined) { W.field(t); return; }
    if (t.dataset.page) { st.page[t.dataset.page] = t.value; save(); if (st.view === 'page') { const sel = [t.selectionStart, t.selectionEnd], k = t.dataset.page; render(); const n = document.querySelector(`[data-page="${k}"]`); n.focus(); n.setSelectionRange(...sel); } return; }
    if (t.dataset.fin) { st.fin[t.dataset.fin] = t.value; save(); const k = t.dataset.fin, sel = t.type === 'number' ? null : [t.selectionStart, t.selectionEnd]; render(); const n = document.querySelector(`[data-fin="${k}"]`); n.focus(); if (sel) n.setSelectionRange(...sel); return; }
    if (t.dataset.f === 'q') { st.af.q = t.value; save(); render(); const n = document.querySelector('[data-f="q"]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); return; }
    if (t.dataset.ad) { const id = $('#drawer').dataset.id; st.arts[id] = { ...(st.arts[id] || {}), [t.dataset.ad]: t.value }; save(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) { $('#drawer').hidden = true; render(); } });
  render();
})();
