"use client";
import { useEffect, useState } from "react";
import { api, ApiError, when, type Changeset, type Op, type Project } from "@/lib/api";

function opText(o: Op): string {
  switch (o.op) {
    case "add_node": { const n = o.node as Record<string, unknown>; return `+ add ${n?.id} (${n?.type}) "${n?.name ?? ""}"`; }
    case "update_node": return `~ ${o.id}: ${Object.entries((o.set as object) ?? {}).map(([k, v]) => `${k} → ${JSON.stringify(v)}`).join(", ")}`;
    case "remove_node": return `− remove ${o.id}`;
    case "add_edge": return `+ flow ${o.from} → ${o.to}${o.proto ? ` (${o.proto})` : ""}`;
    case "remove_edge": return `− flow ${o.from} → ${o.to}`;
    default: return JSON.stringify(o);
  }
}

const STATUS: Record<string, string> = { proposed: "warn", applied: "ok", rejected: "bad" };

export function Changesets({ project, onApplied }: { project: Project; onApplied: () => void }) {
  const [items, setItems] = useState<Changeset[] | null>(null);
  const [err, setErr] = useState("");
  const canDecide = project.permissions.includes("changeset:apply");
  const load = () => api<Changeset[]>(`/api/projects/${project.id}/changesets`).then(setItems).catch(() => setItems([]));
  useEffect(() => { void load(); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(c: Changeset, action: "apply" | "reject") {
    setErr("");
    try {
      await api(`/api/projects/${project.id}/changesets/${c.id}/${action}`, { method: "POST", json: { note: "" } });
      if (action === "apply") onApplied();
      await load();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Failed."); }
  }

  if (items === null) return <p className="note">Loading…</p>;
  return (
    <div className="stack">
      <p className="note">Agents and reviewers propose changes here. Each one was dry-run against the design when proposed.
        {canDecide ? " You can apply or reject them." : " Someone with the Architect role or above decides."}</p>
      {err && <p className="err">{err}</p>}
      {items.length === 0 && <div className="card empty"><b>No changesets yet</b><span>Run an agent from the Agents tab to get a proposal.</span></div>}
      {items.map((c) => (
        <article key={c.id} className="card cs">
          <div className="cs-head">
            <span className="mono note">{c.ref}</span><h3>{c.title}</h3>
            <span className={`pill ${STATUS[c.status]}`}>{c.status}</span>
            {c.agent && <span className="pill agent">agent: {c.agent}</span>}
          </div>
          {c.rationale && <p>{c.rationale}</p>}
          <ul className="ops">{c.ops.map((o, i) => <li key={i}>{opText(o)}</li>)}</ul>
          <div className="row between">
            <span className="note small">Proposed by {c.proposed_by} {when(c.created_at)} on v{c.base_version}
              {c.decided_by && ` · ${c.status} by ${c.decided_by} ${when(c.decided_at)}`}</span>
            {c.status === "proposed" && canDecide && (
              <div className="row">
                <button className="btn small" onClick={() => decide(c, "reject")}>Reject</button>
                <button className="btn small primary" onClick={() => decide(c, "apply")}>Apply to design</button>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
