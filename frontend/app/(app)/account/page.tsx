"use client";
import { useState } from "react";
import { useMe } from "@/components/Shell";
import { api, ApiError } from "@/lib/api";

export default function Account() {
  const me = useMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  return (
    <main className="page" style={{ maxWidth: 560 }}>
      <div><h1>Your account</h1><p className="note">{me?.name} · {me?.email}</p></div>
      <form className="card card-pad stack" onSubmit={async (e) => {
        e.preventDefault(); setMsg({});
        try { await api("/api/auth/password", { method: "POST", json: { current, new: next } }); setCurrent(""); setNext(""); setMsg({ ok: "Password changed. Your other sessions were signed out." }); }
        catch (err) { setMsg({ err: err instanceof ApiError ? err.message : "Failed." }); }
      }}>
        <h2 style={{ fontSize: 18 }}>Change password</h2>
        <label className="field">Current password<input id="cur" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
        <label className="field">New password<input id="new" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} /></label>
        <p className="note">At least 10 characters, with upper and lower case letters and a digit.</p>
        {msg.ok && <p className="note" role="status">{msg.ok}</p>}{msg.err && <p className="err" role="alert">{msg.err}</p>}
        <div><button className="btn primary">Change password</button></div>
      </form>
    </main>
  );
}
