"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Agents } from "@/components/project/Agents";
import { Changesets } from "@/components/project/Changesets";
import { History } from "@/components/project/History";
import { Members } from "@/components/project/Members";
import { Workbench, type SaveState } from "@/components/project/Workbench";
import { RolePill } from "@/components/RolePill";
import { useMe } from "@/components/Shell";
import { api, ApiError, type Project } from "@/lib/api";
import "../../app.css";

type Tab = "canvas" | "changesets" | "agents" | "members" | "history";
const SAVE_TEXT: Record<SaveState, string> = { loading: "Loading…", saved: "All changes saved", saving: "Saving…", readonly: "Read-only for your role", conflict: "Conflict", error: "Not saved" };

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("canvas");
  const [stamp, setStamp] = useState(0);
  const [save, setSave] = useState<{ s: SaveState; d?: string }>({ s: "loading" });

  const loadProject = useCallback(() => api<Project>(`/api/projects/${id}`).then(setProject)
    .catch((e) => setError(e instanceof ApiError && e.status === 404 ? "This project does not exist, or you are not a member." : "Could not load the project.")), [id]);
  useEffect(() => { void loadProject(); }, [loadProject]);
  const onState = useCallback((s: SaveState, d?: string) => setSave({ s, d }), []);

  if (error) return <main className="page"><div className="card empty"><b>{error}</b><Link href="/projects">Back to projects</Link></div></main>;
  if (!project || !me) return <main className="page"><p className="note">Loading…</p></main>;

  const tabs: [Tab, string][] = [["canvas", "Workbench"], ["changesets", "Changesets"], ["agents", "Agents"], ["members", "Members"], ["history", "History"]];
  return (
    <main className="proj-page">
      <div className="proj-head">
        <span className="crumbs"><Link href="/projects">Projects</Link> /</span>
        <h1>{project.name}</h1>
        <RolePill role={project.role} />
        <span className={`save ${save.s}`} title={save.d}>{save.d ?? SAVE_TEXT[save.s]}</span>
        {save.s === "conflict" && <button className="btn small" onClick={() => setStamp((x) => x + 1)}>Reload design</button>}
      </div>
      <div className="tabs proj-tabs" role="tablist">
        {tabs.map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{l}</button>)}
      </div>
      <div className="proj-body">
        {/* The canvas stays mounted so switching tabs keeps its state. */}
        <div hidden={tab !== "canvas"} style={{ position: "absolute", inset: 0 }}>
          <Workbench project={project} userName={me.name} stamp={stamp} onState={onState} onSaved={() => {}} />
        </div>
        {tab !== "canvas" && (
          <div className="pane"><div className="page">
            {tab === "changesets" && <Changesets project={project} onApplied={() => setStamp((x) => x + 1)} />}
            {tab === "agents" && <Agents project={project} onProposed={() => {}} />}
            {tab === "members" && <Members project={project} />}
            {tab === "history" && <History project={project} stamp={stamp} />}
          </div></div>
        )}
      </div>
    </main>
  );
}
