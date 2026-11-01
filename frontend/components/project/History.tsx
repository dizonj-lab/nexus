"use client";
import { useEffect, useState } from "react";
import { api, when, type Project, type Revision } from "@/lib/api";

export function History({ project, stamp }: { project: Project; stamp: number }) {
  const [items, setItems] = useState<Revision[]>([]);
  useEffect(() => { api<Revision[]>(`/api/projects/${project.id}/revisions`).then(setItems); }, [project.id, stamp]);
  return (
    <div className="card table-wrap">
      <table className="t">
        <thead><tr><th>Version</th><th>Source</th><th>Change</th><th>By</th><th>When</th></tr></thead>
        <tbody>{items.map((r) => (
          <tr key={r.version}><td className="mono">v{r.version}</td>
            <td>{r.source.startsWith("changeset:") ? <span className="pill agent">CS-{r.source.split(":")[1].padStart(4, "0")}</span> : <span className="pill">{r.source}</span>}</td>
            <td>{r.message || <span className="note">Saved from the canvas</span>}</td><td>{r.author}</td><td className="note">{when(r.at)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
