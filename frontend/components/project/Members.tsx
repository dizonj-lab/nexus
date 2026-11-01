"use client";
import { useEffect, useState } from "react";
import { RolePill } from "@/components/RolePill";
import { api, ApiError, ROLE_LABEL, ROLE_ORDER, type Member, type Project, type Role } from "@/lib/api";

export function Members({ project }: { project: Project }) {
  const [items, setItems] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("reviewer");
  const [err, setErr] = useState("");
  const manage = project.permissions.includes("members:manage");
  const grantable = ROLE_ORDER.slice(0, ROLE_ORDER.indexOf(project.role) + 1);
  const load = () => api<Member[]>(`/api/projects/${project.id}/members`).then(setItems);
  useEffect(() => { void load(); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setMember(em: string, r: Role) {
    setErr("");
    try { await api(`/api/projects/${project.id}/members`, { method: "PUT", json: { email: em, role: r } }); setEmail(""); await load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Failed."); }
  }
  async function remove(m: Member) {
    setErr("");
    try { await api(`/api/projects/${project.id}/members/${m.user_id}`, { method: "DELETE" }); await load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Failed."); }
  }

  return (
    <div className="stack">
      {manage && (
        <form className="card card-pad inline-form" onSubmit={(e) => { e.preventDefault(); void setMember(email, role); }}>
          <label className="field">Add a person by email<input id="memail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></label>
          <label className="field">Role<select id="mrole" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {grantable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
          <button className="btn primary">Add or update</button>
        </form>
      )}
      {err && <p className="err">{err}</p>}
      <div className="card table-wrap">
        <table className="t">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th>{manage && <th />}</tr></thead>
          <tbody>
            {items.map((m) => {
              const canTouch = manage && ROLE_ORDER.indexOf(m.role) <= ROLE_ORDER.indexOf(project.role);
              return (
                <tr key={m.user_id}>
                  <td>{m.name}</td><td className="note">{m.email}</td>
                  <td>{canTouch ? (
                    <select aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => setMember(m.email, e.target.value as Role)}>
                      {grantable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
                  ) : <RolePill role={m.role} />}</td>
                  {manage && <td>{canTouch && <button className="btn small danger" onClick={() => remove(m)}>Remove</button>}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">You can only grant roles up to your own. A project always keeps at least one owner. People must have an account first; an administrator creates it.</p>
    </div>
  );
}
