import { ROLE_LABEL, type Role } from "@/lib/api";

export function RolePill({ role }: { role: Role | null | undefined }) {
  if (!role) return null;
  return <span className={`pill role-${role}`} title="Your role in this project">{ROLE_LABEL[role]}</span>;
}
