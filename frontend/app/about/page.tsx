import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import pkg from "@/package.json";
import "../landing.css";
import "./about.css";

export const metadata: Metadata = { title: "About" };

const STACK: [string, string][] = [
  ["Web app", "Next.js 16, React 19, TypeScript"],
  ["API", "FastAPI, SQLAlchemy 2, Alembic on Python 3.11"],
  ["Data", "PostgreSQL 16 with pgvector; every design version and decision is kept"],
  ["Models", "Local models on Ollama (Qwen 2.5 first), escalation to a larger model such as gpt-oss"],
  ["Agents", "A harness with agent cards, tool policy, budgets, traces and evals; MCP servers next"],
  ["Outputs", "Terraform for AWS, Azure, Google Cloud and data centres; LikeC4 (C4 model) diagrams"],
];

const REFS: [string, string][] = [
  ["AWS Well-Architected Framework", "https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html"],
  ["Azure Well-Architected Framework", "https://learn.microsoft.com/en-us/azure/well-architected/"],
  ["Google Cloud Architecture Framework", "https://cloud.google.com/architecture/framework"],
  ["MITRE ATT&CK", "https://attack.mitre.org/"],
  ["C4 model", "https://c4model.com/"],
];

export default function About() {
  return (
    <div className="landing">
      <header className="l-top">
        <Link href="/" className="brand"><Logo />NEXUS<span className="brand-sub">Architecture Workbench</span></Link>
        <nav className="l-nav" aria-label="Sections"><Link href="/">Home</Link><Link href="/projects">Projects</Link></nav>
        <Link href="/login" className="btn primary">Sign in</Link>
      </header>
      <main className="inner about">
        <p className="eyebrow">About</p>
        <h1>NEXUS Architecture Workbench</h1>
        <p className="lede">A place where architects discuss, debate and simulate a design safely before anything is built.
          You describe the system in plain language; NEXUS drafts it against your approved stack, principles and security
          policy, shows where it breaks under load, and keeps a traceable record of every change and who approved it.</p>

        <dl className="facts">
          <div><dt>Version</dt><dd className="mono">v{pkg.version}</dd></div>
          <div><dt>Status</dt><dd>Development in progress</dd></div>
          <div><dt>Hosting</dt><dd>Self-hosted</dd></div>
        </dl>

        <section>
          <h2>How it decides</h2>
          <ul className="rules">
            <li><b>The design model is the single source of truth.</b> Terraform, C4 diagrams and the design tree are generated from it.</li>
            <li><b>Rules decide, models explain.</b> Risk, security, cost and capacity come from policy-as-code rules and the simulator, never from a language model.</li>
            <li><b>Agents propose, architects decide.</b> Agents work inside a harness with only the tools your role allows, and every change waits for a person with the right role.</li>
            <li><b>Grounded advice.</b> Opinions cite the Well-Architected pillars of AWS, Azure and Google Cloud, MITRE ATT&amp;CK, and your own ground truth; uncited points are dropped.</li>
          </ul>
        </section>

        <section>
          <h2>Built with</h2>
          <table className="t stack"><tbody>{STACK.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
        </section>

        <section>
          <h2>References</h2>
          <ul className="refs-list">{REFS.map(([t, u]) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{t}</a></li>)}</ul>
        </section>

        <p className="note">Designed and built by Joel Dizon as independent research and development.</p>
      </main>
    </div>
  );
}
