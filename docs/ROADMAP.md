# NEXUS — Roadmap

| Status | Meaning |
| ------ | ------- |
| **Built** | Implemented, tested, committed |
| **Partial** | Present but incomplete or unverified |
| **Planned** | Not started |

| WP | Target version | Scope | Status |
| -- | -------------- | ----- | ------ |
| — | 0.1.x | Prototype: canvas, simulation, Action Guard, decisions, provider packs, autoscaling and cost, console engines, change ledger, roles (simulated) | **Built** |
| WP0 | 0.2.0 | Scaffold: Next.js app (landing, sign-in, projects, members, changesets, agents, administration, About), FastAPI + PostgreSQL + Alembic, **sign-in and per-project RBAC**, design-model JSON schema, **agent harness** (cards, tool policy, budgets, traces, evals) with in-process tools, canvas embedded through a bridge, Compose deployment | **Built** |
| WP1 | 0.3.0 | First MCP servers: model, governance (OPA), simulator, wrapping the prototype logic in Python; MCP gateway with role-based tool access and audit; harness tools move behind MCP with the same names; prototype outputs become golden tests | Planned |
| WP2 | 0.4.0 | Orchestrator goal loop (plan → act → verify until the goal is met), model router, console on the harness; eval suite in CI | Planned |
| WP3 | 0.5.0 | Topology server (data centres, regions, zones, placement) and HA/DR expert: failure injection, RTO/RPO, single points of failure, composite availability | Planned |
| WP4 | 0.6.0 | Review and approval workflow in the API (ADRs, exceptions, comments), OIDC single sign-on | Planned |
| WP5 | 0.7.0 | Knowledge server: standards ingestion with cited answers; Security, Compliance and Cost experts; second opinion on the harness | Planned |
| WP6 | 0.8.0 | IaC and C4 servers with real validation; provider packs as plug-ins with a logical/physical split | Planned |
| WP7 | 0.9.0 | Live collaboration: presence, shared sessions, threads on components; layered team review | Planned |
| WP8 | 1.0.0 | Kubernetes, multi-tenant, hardening (login throttle in Redis, rate limits, backups) | Planned |
