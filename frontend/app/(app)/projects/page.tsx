"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RolePill } from "@/components/RolePill";
import { api, ApiError, when, type Project } from "@/lib/api";
import "../app.css";

export default function Projects() {
  const router = useRouter();
  const [items, setItems] = useState<Project[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState<"blank" | "sample">("blank");
  const [deploy, setDeploy] = useState("aws");
  const [error, setError] = useState("");

  useEffect(() => { api<Project[]>("/api/projects").then(setItems).catch(() => setItems([])); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const p = await api<Project>("/api/projects", { method: "POST", json: { name, start, deploy } });
      router.push(`/projects/${p.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the project.");
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Projects</h1><p className="note">Designs you are a member of. Your role is set per project.</p></div>
        <button className="btn primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>New design</button>
      </div>

      {open && (
        <form className="card card-pad new-form" onSubmit={create}>
          <label className="field">Name<input id="pname" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Payments platform" autoFocus /></label>
          <label className="field">Start from
            <select id="pstart" value={start} onChange={(e) => setStart(e.target.value as "blank" | "sample")}>
              <option value="blank">Blank canvas, with your standards</option>
              <option value="sample">Sample: Customer Portal</option>
            </select>
          </label>
          <label className="field">Runs on
            <select id="pdeploy" value={deploy} onChange={(e) => setDeploy(e.target.value)}>
              <option value="aws">AWS</option><option value="azure">Azure</option><option value="gcp">Google Cloud</option>
              <option value="vmware">Data centre (on-premises)</option><option value="hybrid">Hybrid</option>
            </select>
          </label>
          <div className="row"><button className="btn primary" type="submit">Create</button><button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
          {error && <p className="err">{error}</p>}
        </form>
      )}

      {items === null ? <p className="note">Loading…</p> : items.length === 0 ? (
        <div className="card empty"><b>No projects yet</b><span>Create a design, or ask a lead architect to add you to theirs.</span></div>
      ) : (
        <div className="grid-cards">
          {items.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card proj">
              <div className="row between"><h3>{p.name}</h3><RolePill role={p.role} /></div>
              {p.description && <p className="note">{p.description}</p>}
              <dl>
                <div><dt>Components</dt><dd>{p.components}</dd></div>
                <div><dt>Version</dt><dd>v{p.design_version}</dd></div>
                <div><dt>Members</dt><dd>{p.members ?? "–"}</dd></div>
              </dl>
              <span className="note small">Updated {when(p.updated_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
