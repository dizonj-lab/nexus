# CLAUDE.md

Project guidance for Claude Code. Keep this file short and factual.

## Project

**NEXUS** — an interactive, agentic architecture workbench built on MCP.
Current version: see `VERSION`. Status: concept baseline (prototype + target
architecture); application code starts at WP0 in `docs/ROADMAP.md`.

Planned stack (same conventions as cerebro): Next.js 16 + React 19 + TypeScript
(`frontend/`), FastAPI + SQLAlchemy 2 + Alembic on Python 3.11 (`backend/`),
PostgreSQL 16 + pgvector, MCP servers in Python (FastMCP, `mcp/`), Kubernetes (`k8s/`).

## Rules

- The design model is the single source of truth. Terraform, LikeC4 and the
  Design Tree are generated from it, never edited by hand.
- Every capability is exposed as an MCP tool; the UI uses the same tools.
- Rules decide, models explain: governance checks are policy as code.
- Agents propose changesets; only the architect applies them.
- Keep `architecture/likec4/nexus.c4` in step with what is built.

## Versioning

- SemVer. Bump `VERSION`, add a `CHANGELOG.md` entry, tag `vX.Y.Z`.
- One completed work package = one minor version.
