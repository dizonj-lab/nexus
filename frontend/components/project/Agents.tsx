"use client";
import { useEffect, useState } from "react";
import { api, ApiError, when, type AgentInfo, type Project, type Run, type TraceStep } from "@/lib/api";

const RUN_STATUS: Record<string, string> = { completed: "ok", budget_exceeded: "warn", error: "bad", failed: "bad", running: "accent" };

function StepView({ s }: { s: TraceStep }) {
  const label = s.type === "tool" ? s.tool : s.type === "final" ? "Answer" : s.type === "denied" ? `Denied: ${s.tool}` : s.type === "budget" ? "Budget" : "Error";
  return (
    <li className={`t-${s.type}`}>
      <span className="dot">{s.step}</span>
      <div>
        <div className="row"><b>{label}</b>{s.ms !== undefined && <span className="note small">{s.ms} ms{s.tokens ? ` · ${s.tokens} tokens` : ""}</span>}</div>
        {s.thought && <p className="note">{s.thought}</p>}
        {s.reason && <p className="err">{s.reason}</p>}
        {s.error && <p className="err">{s.error}</p>}
        {s.type === "tool" && (
          <details className="raw"><summary>Arguments and result</summary><pre>{JSON.stringify({ args: s.args, result: s.result }, null, 2)}</pre></details>
        )}
      </div>
    </li>
  );
}

export function RunView({ run }: { run: Run }) {
  return (
    <article className="card cs">
      <div className="cs-head">
        <span className="mono note">RUN-{String(run.id).padStart(4, "0")}</span><h3>{run.agent}</h3>
        <span className={`pill ${RUN_STATUS[run.status] ?? ""}`}>{run.status.replace("_", " ")}</span>
        <span className="note small">{run.user} · {when(run.created_at)} · {run.model} · {run.steps} steps · {(run.duration_ms / 1000).toFixed(1)} s</span>
      </div>
      <p><b>Goal:</b> {run.goal}</p>
      {run.answer && <div className="answer">{run.answer}</div>}
      <div className="tools">
        {run.allowed_tools.map((t) => <span key={t} className="pill mcp">{t}</span>)}
        {run.denied_tools.map((d) => <span key={d.tool} className="pill denied" title={d.reason}>{d.tool}</span>)}
      </div>
      <ol className="trace">{run.trace.map((s, i) => <StepView key={i} s={s} />)}</ol>
    </article>
  );
}

export function Agents({ project, onProposed }: { project: Project; onProposed: () => void }) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [pick, setPick] = useState<string>("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<AgentInfo[]>(`/api/projects/${project.id}/agents`).then((a) => { setAgents(a); setPick((a.find((x) => x.id === "orchestrator" && x.can_run) ?? a.find((x) => x.can_run))?.id ?? ""); });
    api<Run[]>(`/api/projects/${project.id}/runs`).then(setRuns);
  }, [project.id]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await api<Run>(`/api/projects/${project.id}/agents/${pick}/runs`, { method: "POST", json: { goal } });
      setRuns((x) => [r, ...x]);
      if (r.trace.some((s) => s.tool === "changeset.propose")) onProposed();
    } catch (e2) { setErr(e2 instanceof ApiError ? e2.message : "The run failed."); }
    setBusy(false);
  }

  const chosen = agents.find((a) => a.id === pick);
  return (
    <div className="stack">
      <p className="note">Each agent runs in the harness with the tools on its card that <b>your role</b> allows, inside a budget. Agents can propose changesets; they never apply them.</p>
      <div className="agents">
        {agents.map((a) => (
          <button key={a.id} className="card agent" aria-pressed={pick === a.id} disabled={!a.can_run} onClick={() => setPick(a.id)}
            title={a.can_run ? "" : `Needs ${a.run_permission}`}>
            <div className="row between"><h3>{a.name}</h3><span className="pill agent">{a.model === "llm" ? "large model" : "local model"}</span></div>
            <p className="note">{a.purpose}</p>
            <div className="tools">
              {a.allowed_tools.map((t) => <span key={t} className="pill mcp">{t}</span>)}
              {a.denied_tools.map((d) => <span key={d.tool} className="pill denied" title={d.reason}>{d.tool}</span>)}
            </div>
            <span className="note small mono">≤{a.budget.steps} steps · ≤{a.budget.tool_calls} tool calls · ≤{a.budget.seconds}s</span>
          </button>
        ))}
      </div>
      {chosen && (
        <form className="card run-form" onSubmit={run}>
          <label className="field">Goal for {chosen.name}
            <textarea id="goal" rows={3} required minLength={3} value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Find the single points of failure and propose the cheapest fix." />
          </label>
          <div className="row"><button className="btn primary" disabled={busy || !goal.trim()}>{busy ? "Running… the local model can take a minute" : "Run agent"}</button>
            {err && <span className="err">{err}</span>}</div>
        </form>
      )}
      {runs.map((r) => <RunView key={r.id} run={r} />)}
    </div>
  );
}
