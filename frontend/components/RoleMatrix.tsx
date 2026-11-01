"use client";
import { useEffect, useState } from "react";
import { api, type Matrix } from "@/lib/api";

// Rendered from the API, so the landing page always shows the rules the server enforces.
export function RoleMatrix() {
  const [m, setM] = useState<Matrix | null>(null);
  useEffect(() => { api<Matrix>("/api/auth/roles").then(setM).catch(() => setM(null)); }, []);
  if (!m) return <p className="note">Loading the access matrix…</p>;
  const perms = Object.keys(m.permissions);
  return (
    <div className="matrix-wrap">
      <table className="matrix">
        <thead>
          <tr><th scope="col">Permission</th>{m.project_roles.map((r) => <th key={r.id} scope="col">{r.label}</th>)}</tr>
        </thead>
        <tbody>
          {perms.map((p) => (
            <tr key={p}>
              <th scope="row"><span>{m.permissions[p]}</span><code>{p}</code></th>
              {m.project_roles.map((r) => (
                <td key={r.id} aria-label={r.permissions.includes(p) ? "allowed" : "not allowed"}>
                  {r.permissions.includes(p) ? <span className="yes">●</span> : <span className="no">·</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
