# NEXUS — Current state (v0.3.4)

- **Knowledge packs** (`packs/`): provider limits with sources, placement
  rules and Route 53 failover rules, tested and inlined into the canvas.
- Subnets in every zone; drag and drop between subnets, zones and regions
  with live fit, pros and cons, and refusal with the reason; zones side by
  side; reconnect a flow by dragging its end; compact, movable Properties
  with Limits and Thinking; Singapore as the default region; a second
  opinion that streams, stops on time and can be stopped.

- Properties dialog with the source of every value (you, AI with confidence,
  rules, requirement, default); region layouts; zone and replication overlays;
  multi-line console; targets read from the requirement; RTO/RPO in hours.

- **New design** wizard (requirement, availability with downtime, RTO, RPO,
  resilience pattern, layers, platform options with trade-offs and cost) and
  the **Layers** view with network, security, integration and platform overlays.

- **New strategy in plain words**: idea → overview → Business, People, Process,
  Technology, Data & AI, Money (requires, depends on, Deeper) → decide → create,
  drafted by the local model and decided by the architect; several strategies
  per browser.

- **NEXUS Strategy** (`poc/strategy/`, app page /strategy): the Chief
  Technology Architect's nine-stage workflow with four lenses, RACI, 52
  artefacts, People · Process · Technology, a business-case calculator,
  strategy on a page, and a hand-off the canvas imports (`import strategy`).
- **Canvas only** (`deploy/canvas.sh`, port 8091): canvas and Strategy without
  sign-in.

- **Public landing page** (`landing/`): static, Coming soon, with the
  design-break-correct walkthrough and the 5-minute product demo.
- **Instances**: main (port 8088, landing page) and lab (port 8089, no landing
  page, own database) from the same Compose file.

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
