"use client";
import { useCallback, useEffect, useRef } from "react";
import { api, ApiError, ROLE_LABEL, type Project } from "@/lib/api";

export type SaveState = "loading" | "saved" | "saving" | "readonly" | "conflict" | "error";

type Props = { project: Project; userName: string; stamp: number; onState: (s: SaveState, detail?: string) => void; onSaved: () => void };

// Hosts the canvas (prototype, same origin) and is the only path from it to the API.
export function Workbench({ project, userName, stamp, onState, onSaved }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const version = useRef(0);
  const ready = useRef(false);
  const saving = useRef(false);
  const queued = useRef<unknown>(null);
  const first = useRef(true);
  const canEdit = project.permissions.includes("design:edit");

  const send = useCallback(async () => {
    const d = await api<{ design: unknown; version: number }>(`/api/projects/${project.id}/design`);
    version.current = d.version;
    frame.current?.contentWindow?.postMessage({
      type: "nexus:init", design: d.design, user: { name: userName }, role: project.role,
      roleLabel: ROLE_LABEL[project.role], canEdit, first: first.current,
    }, location.origin);
    first.current = false;
    onState(canEdit ? "saved" : "readonly");
  }, [project.id, project.role, userName, canEdit, onState]);

  const save = useCallback(async (design: unknown) => {
    if (saving.current) { queued.current = design; return; }
    saving.current = true;
    onState("saving");
    try {
      const r = await api<{ version: number }>(`/api/projects/${project.id}/design`, {
        method: "PUT", json: { design, base_version: version.current },
      });
      version.current = r.version;
      onState("saved");
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) onState("conflict", "Someone saved a newer version. Reload to continue.");
      else if (e instanceof ApiError) {
        // The server lists what is wrong (schema path and reason); keep them for the Details view.
        const errs = ((e.body as { detail?: { errors?: string[] } })?.detail?.errors ?? []).filter(Boolean);
        onState("error", errs.length ? `Not saved: ${errs.length} problem${errs.length > 1 ? "s" : ""} in the design\n${errs.join("\n")}` : e.message);
      } else onState("error", "Could not save.");
      queued.current = null;
    } finally {
      saving.current = false;
      if (queued.current) { const next = queued.current; queued.current = null; void save(next); }
    }
  }, [project.id, onState, onSaved]);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.origin !== location.origin || ev.source !== frame.current?.contentWindow) return;
      const m = ev.data as { type?: string; design?: unknown };
      if (m.type === "nexus:ready") { ready.current = true; void send(); }
      if (m.type === "nexus:changed" && canEdit && m.design) void save(m.design);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send, save, canEdit]);

  // Reload the design after a changeset is applied elsewhere in the app.
  useEffect(() => { if (stamp > 0 && ready.current) void send(); }, [stamp, send]);

  return <iframe ref={frame} className="wb" src="/workbench/index.html?embed=1" title={`${project.name} workbench`} />;
}
