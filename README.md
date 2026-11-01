# NEXUS

An interactive, agentic architecture workbench. Architects design systems on a
live canvas that simulates traffic and shows bottlenecks, while an advisor checks
every change against the organisation's Technical Capabilities, Enterprise
Architecture principles and Ground Truth (standards, policy as code). Terraform
and LikeC4 are generated from the same design model.

**Version:** see [`VERSION`](VERSION) and [`CHANGELOG.md`](CHANGELOG.md).

## What is here

| Path | Contents |
| ---- | -------- |
| `frontend/` | Next.js app: landing, sign-in, projects, members, changesets, agents, administration, About |
| `backend/` | FastAPI API: auth, RBAC, design store, changesets, agent harness (`app/harness`, cards in `agents/`) |
| `schema/` | Design-model JSON schema and the sample design |
| `poc/prototype/index.html` | The canvas (single file), embedded by the app; also runs on its own |
| `architecture/likec4/nexus.c4` | Target architecture as a LikeC4 model |
| `deploy/` | Docker Compose for Buddy: PostgreSQL, API, app, nginx edge |
| `docs/` | Architecture, decisions, roadmap, current state |

## Run locally

```bash
cd backend && uv venv && uv pip install -e '.[dev]'
NEXUS_ADMIN_EMAIL=you@example.local NEXUS_ADMIN_PASSWORD='Change-Me-2026' .venv/bin/uvicorn app.main:app --port 8000
```

```bash
cd frontend && npm install && npm run dev      # http://localhost:3000
```

```bash
cd backend && .venv/bin/python -m pytest -q   # 41 tests
```

## Deploy on Buddy

```bash
cd ~/nexus && git pull && ./deploy/buddy.sh
```

The first run asks for the administrator's email and name, creates
`deploy/.env` with random secrets and prints the first password. Then open
`http://<buddy>:8088/`.

Agent evals against the real model:

```bash
docker compose -f deploy/compose.yml exec backend python -m app.harness.evals
```
