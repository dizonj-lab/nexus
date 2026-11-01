"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/Logo";
import { api, ApiError } from "@/lib/api";
import "./login.css";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", json: { email, password } });
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/projects");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach NEXUS. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <Link href="/" className="brand"><Logo size={30} />NEXUS</Link>
      <div>
        <h1>Sign in</h1>
        <p className="note">Use the account your administrator created for you.</p>
      </div>
      <label className="field">Email
        <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </label>
      <label className="field">Password
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <p className="note small">Five wrong attempts lock the account for 15 minutes.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="login-wrap">
      <Suspense fallback={null}><LoginForm /></Suspense>
    </main>
  );
}
