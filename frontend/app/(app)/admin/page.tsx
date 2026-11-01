"use client";
import { useEffect, useState } from "react";
import { useMe } from "@/components/Shell";
import { api, ApiError, when } from "@/lib/api";
import "../app.css";

type U = { id: number; email: string; name: string; system_role: "admin" | "member"; active: boolean; created_at: string; last_login_at: string | null };
type Ev = { id: number; at: string; user: string | null; action: string; target: string; detail: Record<string, unknown>; ip: string };

export default function Admin() {
  const me = useMe();
  const [tab, setTab] = useState<"users" | "audit">("users");
  const [users, setUsers] = useState<U[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [form, setForm] = useState({ email: "", name: "", password: "", system_role: "member" });
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  const load = () => api<U[]>("/api/admin/users").then(setUsers);
  useEffect(() => { if (me?.system_role === "admin") { void load(); api<Ev[]>("/api/admin/audit").then(setEvents); } }, [me]);
  if (me && me.system_role !== "admin") return <main className="page"><div className="card empty"><b>Administrators only</b></div></main>;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg({});
    try { await fn(); setMsg({ ok }); await load(); } catch (e) { setMsg({ err: e instanceof ApiError ? e.message : "Failed." }); }
  }

  return (
    <main className="page">
      <div className="page-head"><div><h1>Administration</h1><p className="note">Accounts, system roles and the audit trail. Project roles are managed inside each project.</p></div></div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "users"} onClick={() => setTab("users")}>Users<span className="count">{users.length}</span></button>
        <button role="tab" aria-selected={tab === "audit"} onClick={() => setTab("audit")}>Audit trail</button>
      </div>
      {msg.ok && <p className="note" role="status">{msg.ok}</p>}
      {msg.err && <p className="err" role="alert">{msg.err}</p>}
      {tab === "users" && (<>
        <form className="card card-pad new-form" onSubmit={(e) => { e.preventDefault(); void run(() => api("/api/admin/users", { method: "POST", json: form }).then(() => setForm({ email: "", name: "", password: "", system_role: "member" })), `Created ${form.email}. Share the password with them securely; they can change it under their name.`); }}>
          <label className="field">Name<input id="uname" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field">Email<input id="uemail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field">Initial password<input id="upw" type="password" required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="10+ chars, Aa, 1" /></label>
          <label className="field">System role<select id="urole" value={form.system_role} onChange={(e) => setForm({ ...form, system_role: e.target.value })}><option value="member">Member</option><option value="admin">Administrator</option></select></label>
          <div className="row"><button className="btn primary">Create user</button></div>
        </form>
        <div className="card table-wrap"><table className="t">
          <thead><tr><th>Name</th><th>Email</th><th>System role</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td><td className="note">{u.email}</td>
              <td><select aria-label={`System role for ${u.name}`} value={u.system_role} disabled={u.id === me?.id}
                onChange={(e) => run(() => api(`/api/admin/users/${u.id}`, { method: "PATCH", json: { system_role: e.target.value } }), `${u.name} is now ${e.target.value}; their sessions were signed out.`)}>
                <option value="member">Member</option><option value="admin">Administrator</option></select></td>
              <td>{u.active ? <span className="pill ok">Active</span> : <span className="pill bad">Disabled</span>}</td>
              <td className="note">{u.last_login_at ? when(u.last_login_at) : "never"}</td>
              <td className="row">
                {u.id !== me?.id && <button className="btn small" onClick={() => run(() => api(`/api/admin/users/${u.id}`, { method: "PATCH", json: { active: !u.active } }), `${u.name} ${u.active ? "disabled and signed out" : "enabled"}.`)}>{u.active ? "Disable" : "Enable"}</button>}
              </td>
            </tr>))}
          </tbody></table></div>
      </>)}
      {tab === "audit" && (
        <div className="card table-wrap"><table className="t">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Detail</th><th>From</th></tr></thead>
          <tbody>{events.map((e) => (
            <tr key={e.id}><td className="note">{new Date(e.at).toLocaleString()}</td><td>{e.user ?? "–"}</td><td className="mono">{e.action}</td>
              <td className="mono">{e.target}</td><td className="mono note">{Object.keys(e.detail).length ? JSON.stringify(e.detail) : ""}</td><td className="note">{e.ip}</td></tr>))}
          </tbody></table></div>
      )}
    </main>
  );
}
