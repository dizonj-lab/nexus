// Small client for the NEXUS API. Same origin; the session is an httpOnly cookie.

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

function messageOf(body: unknown, status: number): string {
  const d = (body as { detail?: unknown })?.detail;
  if (typeof d === "string") return d;
  if (d && typeof d === "object" && "message" in d) return String((d as { message: string }).message);
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, "");
  if (status === 403) return "Your role does not allow this.";
  if (status >= 500) return "The server had a problem. Try again in a moment.";
  return `Request failed (${status}).`;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers: {
      "X-Nexus-Client": "web",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
      window.location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    }
    throw new ApiError(res.status, messageOf(body, res.status), body);
  }
  return body as T;
}

export type Me = { id: number; email: string; name: string; system_role: "admin" | "member" };

export type Role = "viewer" | "reviewer" | "security" | "architect" | "lead" | "owner";

export type Project = {
  id: number;
  name: string;
  description: string;
  archived: boolean;
  design_version: number;
  updated_at: string;
  created_at: string;
  role: Role;
  permissions: string[];
  members: number | null;
  components: number;
};

export type RoleInfo = { id: Role; label: string; summary: string; permissions: string[] };
export type Matrix = { permissions: Record<string, string>; project_roles: RoleInfo[]; system_roles: Record<string, string> };

export type Member = { user_id: number; name: string; email: string; role: Role; role_label: string; added_at: string };

export type Op = { op: string; [k: string]: unknown };
export type Changeset = {
  id: number; ref: string; title: string; rationale: string; ops: Op[]; status: "proposed" | "applied" | "rejected";
  base_version: number; proposed_by: string; agent: string | null; run_id: number | null; decided_by: string | null;
  decided_at: string | null; decision_note: string; created_at: string;
};

export type AgentInfo = {
  id: string; name: string; purpose: string; model: string; can_run: boolean; run_permission: string;
  allowed_tools: string[]; denied_tools: { tool: string; reason: string }[];
  budget: { steps: number; tool_calls: number; tokens: number; seconds: number };
};

export type TraceStep = {
  step: number; type: "model" | "tool" | "final" | "denied" | "error" | "budget"; model?: string; tokens?: number; ms?: number;
  thought?: string; tool?: string; args?: unknown; result?: unknown; reason?: string; error?: string; answer?: string; tool_ms?: number;
};

export type Run = {
  id: number; agent: string; goal: string; status: string; answer: string; model: string; allowed_tools: string[];
  denied_tools: { tool: string; reason: string }[]; trace: TraceStep[]; steps: number; tokens: number; duration_ms: number;
  created_at: string; user: string | null;
};

export type Revision = { version: number; source: string; message: string; at: string; author: string };

export const ROLE_LABEL: Record<Role, string> = {
  viewer: "Viewer", reviewer: "Reviewer", security: "Security architect", architect: "Architect", lead: "Lead architect", owner: "Owner",
};
export const ROLE_ORDER: Role[] = ["viewer", "reviewer", "security", "architect", "lead", "owner"];

export function when(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
