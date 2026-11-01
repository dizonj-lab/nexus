# NEXUS — Current state (v0.2.3)

- **App** (`frontend/`): Next.js 16 with landing page, About, sign-in, projects,
  members, changesets, agent runs with traces, administration (users, audit
  trail) and account. The canvas is the prototype, embedded through a bridge;
  it loads and autosaves the project design through the API and follows the
  user's project role.
- **API** (`backend/`): FastAPI, SQLAlchemy 2, Alembic on PostgreSQL 16. Sign-in,
  system and project roles, design store with versions, changesets
  (propose/apply/reject), agent harness, audit trail. 41 tests, passing on
  SQLite and PostgreSQL.
- **Harness**: four agent cards (orchestrator, security, HA/DR, explainer),
  five in-process tools, budgets, traces, evals (`python -m app.harness.evals`).
  Tools move behind MCP servers in WP1.
- **Canvas** (`poc/prototype/index.html`): routing that avoids components,
  colour-coded shared services, isometric zones in 3D, an Add component menu,
  a vendor-neutral data centre stack, subnets, security and application
  groups, critical configuration per component, and an Action Guard that
  compares two opinions with computed risk, security and cost, confidence and
  Well-Architected citations.
- **Deployment** (`deploy/`): Compose with PostgreSQL, API, app and an nginx
  edge; `deploy/buddy.sh` creates secrets and the first administrator.
- Next: WP1, the first MCP servers.
