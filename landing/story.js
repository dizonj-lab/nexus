// The hero walkthrough: design within guardrails, break it, see the impact, correct it (agent or architect),
// approve and break it again. Phases are a data attribute on the figure; landing.css draws each one.
(function () {
  const fig = document.getElementById('story');
  if (!fig) return;
  const ORDER = ['design', 'break', 'impact', 'correct', 'retest'];
  const HOLD = { design: 6000, break: 4000, impact: 6000, correct: 6500, retest: 7000 };
  const P = {
    design: { t: "Design within the firm's guardrails", who: ['AI-assisted', 'agent'],
      x: 'NEXUS drafts the design from a plain-language brief, using only approved technology. The WAF sits on the CDN at the internet edge, the load balancer spans two zones, and the database keeps a synchronous standby. Every guardrail is checked as it is drawn.',
      k: [['load 1×'], ['p95 140 ms'], ['errors 0%', 'ok'], ['$2.1k / month']], u: { a: '60%', b: '60%' }, db: { p: 'primary', s: 'standby' } },
    break: { t: 'Break it: zone A fails', who: ['Chaos experiment', 'bad'],
      x: 'NEXUS takes out availability zone A on purpose. Its service task and the database primary go down with it, and the load balancer stops sending traffic there.',
      k: [['zone A down', 'bad'], ['1 of 2 tasks lost', 'bad'], ['primary lost', 'bad']], u: { a: '—', b: '60%' }, db: { p: 'down', s: 'standby' } },
    impact: { t: 'See the impact before customers do', who: ['Design fails', 'bad'],
      x: 'Zone B now carries all the traffic on half the capacity, and the database fails over to the standby. The guardrail "survives a zone loss" fails, and NEXUS names the bottleneck: svc · b1.',
      k: [['svc · b1 at 120%', 'bad'], ['errors 31%', 'bad'], ['p95 2.4 s', 'bad'], ['failover 60–120 s', 'warn']], u: { a: '—', b: '120%' }, db: { p: 'down', s: 'promoting…' } },
    correct: {
      auto: { t: 'Correct it: an agent proposes the fix', who: ['Agent proposes', 'agent'],
        x: 'The resilience agent proposes a changeset: one more task in each zone, so either zone can carry the full load, and a database proxy that holds connections during failover. The Action Guard dry-runs it with the same rules. Nothing is applied yet.',
        k: [['changeset · 2 changes'], ['rules ✓', 'ok'], ['+$310 / month', 'warn']] },
      manual: { t: 'Correct it: you make the change', who: ['Architect edits', 'human'],
        x: 'You set the service to two tasks per zone and turn on the database proxy. The Action Guard dry-runs your change with the same rules, and shows its cost before anything is applied.',
        k: [['your change · 2 edits'], ['rules ✓', 'ok'], ['+$310 / month', 'warn']] },
      u: { a: '30%', a2: '30%', b: '30%', b2: '30%' }, db: { p: 'primary', s: 'standby' } },
    retest: { t: 'Approve, then break it again', who: ['Architect approved', 'ok'],
      x: 'An architect approves, and the decision is recorded with its numbers. NEXUS fails zone A again: zone B carries the full load at 60%, the proxy rides through the failover, and every guardrail is green.',
      k: [['errors 0.4%', 'ok'], ['p95 190 ms', 'ok'], ['failover ~35 s'], ['ADR-014 recorded']], u: { a: '—', a2: '—', b: '60%', b2: '60%' }, db: { p: 'down', s: 'primary (promoted)' } },
  };
  const $ = (s) => fig.querySelector(s);
  const title = $('#capTitle'), who = $('#capWho'), text = $('#capText'), kpis = $('#capKpis');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0, timer = null, playing = !reduce, visible = true, loops = 0;

  function show(phase) {
    const mode = fig.dataset.mode;
    const base = P[phase], d = phase === 'correct' ? { ...base, ...base[mode] } : base;
    fig.dataset.phase = phase;
    fig.querySelectorAll('.steps button').forEach((b) => b.dataset.go === phase ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'));
    title.textContent = d.t;
    who.textContent = d.who[0]; who.className = 'who ' + d.who[1];
    text.textContent = d.x;
    kpis.innerHTML = '';
    [...d.k, ['simulated']].forEach(([v, c]) => { const li = document.createElement('li'); li.textContent = v; if (c) li.className = c; kpis.appendChild(li); });
    fig.querySelectorAll('[data-u]').forEach((t) => { t.textContent = (base.u && base.u[t.dataset.u]) || t.textContent; });
    fig.querySelectorAll('[data-db]').forEach((t) => { t.textContent = base.db[t.dataset.db]; });
  }
  function schedule() {
    clearTimeout(timer);
    if (!playing || !visible) return;
    timer = setTimeout(() => {
      i = (i + 1) % ORDER.length;
      if (i === 0) { loops++; setMode(loops % 2 ? 'manual' : 'auto'); }
      show(ORDER[i]); schedule();
    }, HOLD[ORDER[i]]);
  }
  function setMode(m) {
    fig.dataset.mode = m;
    fig.querySelectorAll('.mode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  }
  function setPlaying(p) {
    playing = p; fig.classList.toggle('paused', !p);
    $('.play').setAttribute('aria-label', p ? 'Pause the walkthrough' : 'Play the walkthrough');
    schedule();
  }
  fig.querySelectorAll('.steps button').forEach((b) => b.addEventListener('click', () => { i = ORDER.indexOf(b.dataset.go); show(b.dataset.go); setPlaying(false); }));
  fig.querySelectorAll('.mode button').forEach((b) => b.addEventListener('click', () => { setMode(b.dataset.mode); show(ORDER[i]); }));
  $('.play').addEventListener('click', () => setPlaying(!playing));
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; schedule(); }).observe(fig);
  show(ORDER[0]); setPlaying(playing);

  // The demo video is published separately; until it is there, say so instead of showing a broken player.
  const v = document.querySelector('#video video'), src = v && v.querySelector('source');
  const miss = () => document.getElementById('video').classList.add('missing');
  if (src) { src.addEventListener('error', miss); if (v.networkState === 3) miss(); fetch(src.src, { method: 'HEAD' }).then((r) => { if (!r.ok) miss(); }).catch(() => {}); }
})();
