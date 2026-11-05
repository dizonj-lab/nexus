"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";
import { Logo } from "./Logo";

const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext);

export function Shell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    api<Me>("/api/auth/me").then(setMe).catch(() => router.replace(`/login?next=${encodeURIComponent(path)}`));
  }, [path, router]);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  const nav = [
    { href: "/projects", label: "Projects" },
    { href: "/strategy", label: "Strategy" },
    ...(me?.system_role === "admin" ? [{ href: "/admin", label: "Administration" }] : []),
    { href: "/about", label: "About" },
  ];

  return (
    <MeContext.Provider value={me}>
      <header className="topbar">
        <Link href="/projects" className="brand"><Logo />NEXUS<span className="brand-sub">Architecture Workbench</span></Link>
        <nav className="topnav" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined}>{n.label}</Link>
          ))}
        </nav>
        <div className="spacer" />
        {me && (
          <div className="who">
            <Link href="/account" className="name" title={me.email}>{me.name}</Link>
            {me.system_role === "admin" && <span className="pill accent">Admin</span>}
            <button className="btn small" onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>
      {me ? children : <div className="page"><p className="note">Checking your session…</p></div>}
    </MeContext.Provider>
  );
}
