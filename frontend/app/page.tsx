import Link from "next/link";
import { Logo } from "@/components/Logo";
import { RoleMatrix } from "@/components/RoleMatrix";
import "./landing.css";

const LOOP = [
  { n: "Intent", d: "You say what the system must do.", k: "human" },
  { n: "Plan", d: "The orchestrator drafts the steps.", k: "agent" },
  { n: "Act", d: "Agents call tools: read, check, simulate.", k: "tool" },
  { n: "Verify", d: "Rules and the simulator decide.", k: "tool" },
  { n: "Review", d: "The Guardian dry-runs the change.", k: "agent" },
  { n: "Approve", d: "You apply it, or not.", k: "human" },
  { n: "Record", d: "Ledger, decision record, AI log.", k: "rec" },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="l-top">
        <Link href="/" className="brand"><Logo />NEXUS<span className="brand-sub">Architecture Workbench</span></Link>
        <nav className="l-nav" aria-label="Sections">
          <a href="#how">How it works</a><a href="#agents">Agents</a><a href="#access">Access</a><Link href="/about">About</Link>
        </nav>
        <Link href="/login" className="btn primary">Sign in</Link>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Architecture workbench</p>
          <h1>Design in plain language. Find the bottleneck before it ships.</h1>
          <p className="lede">Describe the system you need. NEXUS drafts it against your approved technology stack,
            principles and security policy, pushes it to 1,000× load, names the component that breaks first,
            and records every change as a decision someone approved.</p>
          <div className="row">
            <Link href="/login" className="btn primary big">Sign in to your workspace</Link>
            <a href="#how" className="btn big">See how it works</a>
          </div>
        </div>
        <figure className="hero-fig" aria-label="A design under 1,000 times load: the orders database is the bottleneck">
          <svg viewBox="0 0 460 300" role="img">
            <defs>
              <marker id="h" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L10,5 L0,10z" className="ah" /></marker>
            </defs>
            <text className="tag" x="16" y="24">LOAD ×1000 · aws · eu-west-1</text>
            <path className="flow f1" d="M70 150 H130" markerEnd="url(#h)" />
            <path className="flow f1" d="M190 150 H240" markerEnd="url(#h)" />
            <path className="flow f2" d="M300 150 C320 150 320 90 350 90" markerEnd="url(#h)" />
            <path className="flow f3" d="M300 150 C320 150 320 210 350 210" markerEnd="url(#h)" />
            <g className="n ok"><rect x="20" y="128" width="50" height="44" rx="7" /><text x="45" y="155">U1</text></g>
            <g className="n ok"><rect x="130" y="128" width="60" height="44" rx="7" /><text x="160" y="155">WAF1</text></g>
            <g className="n warn"><rect x="240" y="128" width="60" height="44" rx="7" /><text x="270" y="155">SVC1</text><text className="sub" x="270" y="188">×6 · 71%</text></g>
            <g className="n ok"><rect x="350" y="68" width="60" height="44" rx="7" /><text x="380" y="95">C1</text></g>
            <g className="n bad pulse"><rect x="350" y="188" width="60" height="44" rx="7" /><text x="380" y="215">DB1</text></g>
            <g className="callout"><rect x="262" y="246" width="186" height="40" rx="6" /><text x="274" y="263">Bottleneck: DB1 at 142%</text><text className="sub2" x="274" y="279">add 2 read replicas · +$410/mo</text></g>
          </svg>
        </figure>
      </section>

      <section id="how" className="band">
        <div className="inner">
          <h2>What the workbench does</h2>
          <div className="pillars">
            <article><h3>Natural-language design</h3><p>A local language model asks what it needs to know, then returns an editable plan. Nothing changes until you tick it.</p></article>
            <article><h3>Resiliency simulation</h3><p>Load, autoscaling, rate limits, partitions and cost, up to 1,000×. The simulator names the first component to fail.</p></article>
            <article><h3>Governance by rule</h3><p>Every change is checked against your technology stack, EA principles, security policy and MITRE ATT&amp;CK. Rules decide; models explain.</p></article>
            <article><h3>Traceability</h3><p>Versioned designs, a change ledger, decision records and an audit trail of who did what, including every agent run.</p></article>
          </div>
        </div>
      </section>

      <section id="agents" className="inner">
        <h2>Agents work inside a harness</h2>
        <p className="lede narrow">Each agent has a card: a role, the tools it may ask for, a model tier and a budget.
          It only gets the tools <em>you</em> are allowed to use, every step is traced, and it can propose changes but never apply them.</p>
        <ol className="loop">
          {LOOP.map((s, i) => (
            <li key={s.n} className={`k-${s.k}`}><span className="num">{i + 1}</span><b>{s.n}</b><span>{s.d}</span></li>
          ))}
        </ol>
        <div className="harness">
          <div><b>Card</b><span>role prompt · tools · model tier · budget · evals</span></div>
          <div><b>Tool policy</b><span>card tools ∩ your permissions</span></div>
          <div><b>Budget</b><span>steps · tool calls · tokens · seconds</span></div>
          <div><b>Trace</b><span>every model turn, tool call and denial</span></div>
          <div><b>Model router</b><span>local model first, escalation when needed</span></div>
        </div>
      </section>

      <section id="access" className="band">
        <div className="inner">
          <h2>Access by role</h2>
          <p className="lede narrow">Accounts are created by an administrator. Each person gets a role per project, and can never grant a role above their own.</p>
          <RoleMatrix />
        </div>
      </section>

      <footer className="l-foot inner">
        <span className="brand"><Logo size={20} />NEXUS</span>
        <span className="note"><Link href="/about">About</Link> · local SLM, LLM second opinion · v0.3.14 · development in progress</span>
      </footer>
    </div>
  );
}
