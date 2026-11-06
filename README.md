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
| `packs/` | Knowledge packs: provider limits with sources, placement rules, component rules; tested and inlined into the canvas (`node packs/build.mjs`) |
| `poc/tests/` | Browser checks for the canvas with a simulated model server (`./poc/tests/run-all.sh`) |
| `poc/strategy/` | NEXUS Strategy: the Chief Technology Architect's workbench (app page /strategy); hands principles, guardrails and the stack to the canvas |
| `architecture/likec4/nexus.c4` | Target architecture as a LikeC4 model |
| `landing/` | Public landing page (static): product story, design-break-correct walkthrough, demo video; sign-up is Coming soon |
| `deploy/` | Docker Compose for Buddy: PostgreSQL, API, app, nginx edge; the lab instance; the landing page |
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
cd backend && .venv/bin/python -m pytest -q   # 89 tests
```

```bash
./poc/tests/run-all.sh                         # everything, in Docker: backend, packs, canvas browser checks
```

## Deploy on Buddy

```bash
cd ~/nexus && git pull && ./deploy/buddy.sh
```

The first run asks for the administrator's email and name, creates
`deploy/.env` with random secrets and prints the first password. Then open
`http://<buddy>:8088/`.

**Lab instance** for ideation, development and testing: no landing page (`/`
goes straight to the projects), its own database and settings
(`deploy/lab.env`), port 8089. To try a branch before main, run it from a
second checkout:

```bash
git clone https://github.com/dizonj-lab/nexus.git ~/nexus-lab
```

```bash
cd ~/nexus-lab && git checkout <branch> && ./deploy/buddy.sh --lab
```

**Public landing page** (static, port 8090; put a tunnel in front to publish
it):

```bash
cd ~/nexus && git pull && ./deploy/landing.sh
```

**Canvas only** (no landing page, no sign-in; work stays in the browser), port
8091, with the Strategy module at `/strategy/`:

```bash
cd ~/nexus && git pull && ./deploy/canvas.sh
```

Agent evals against the real model:

```bash
docker compose -f deploy/compose.yml exec backend python -m app.harness.evals
```
