# NEXUS — Decisions

Status of each decision: **Accepted** unless marked otherwise.

## D1 — The design model is a typed graph stored as an event log plus snapshots
JSON-schema typed components, flows, zones and sub-designs in PostgreSQL. Gives
versions, sub-designs, undo, audit and short component IDs (`SVC1`) without extra work.

## D2 — Rules decide, models explain
Governance checks are policy as code (OPA/Rego). The SLM writes explanations and
fills in entity details. Every finding has a checkable basis.

## D3 — MCP is the only integration contract
Official Python SDK (FastMCP). Streamable HTTP when deployed, stdio for local
development. New capabilities (cost, CMDB, cloud inventory) are new servers.

## D4 — NEXUS exposes itself as an MCP server
External agents (Claude Desktop / Code, IDE agents) can read and change designs
through the MCP gateway, with OAuth 2.1 and audit.

## D5 — Model router: SLM first, LLM by explicit setting
Local SLM by default; LLM escalation is opt-in. Every call is written to the AI
log with its explanation and confidence.

## D6 — Agents propose changesets; the architect applies them
Agent output is a diff shown on the canvas. Nothing is applied without approval.

## D7 — Thin orchestrator
An MCP client plus the model router, without a heavy agent framework. Split into
sub-agents (Discovery, Security, Capacity, IaC, Docs) only when one grows too large.

## D8 — Simulator v1 analytical, v2 discrete-event
v1 is the prototype's capacity and queueing model; v2 uses SimPy as async jobs.
Both sit behind the same `nexus-simulator` tools.

## D9 — Semantic Versioning, one minor per work package
`0.x` until the first shareable release (`1.0.0`). Each release is a `vX.Y.Z` tag
with a changelog entry.

## D10 — Action Guard reviews every change before it is applied
A second agent, separate from the advisor, dry-runs each change on a copy of the
design and reports consequences, new risks and tradeoffs. Ground-truth
violations are blocked unless a justification is recorded as an exception ADR.
The verdict comes from rules; the model only explains it.

## D11 — Provider packs, not one agent per cloud
Cloud knowledge (service names, limits, private connectivity, Terraform modules)
lives in one MCP server per provider with the same tool interface. The same
agents call whichever pack the design targets. Adding OCI or Alibaba means
adding a pack, not a new agent.

## D12 — Database scaling order: cache, scale up, read replicas, then shard
Principle P6. Single-primary databases have no write replicas: read replicas
add read capacity only; writes scale up (bigger primary) or out (sharding or
distributed SQL). Shard only when writes exceed the largest primary at 60%,
data exceeds ~2 TB per node, or tenant isolation requires it.

## D13 — Connectivity is a property of each flow
Every flow records how it travels: in-network, internet, private link, VPN or
dedicated circuit. Traffic to third parties must use private connectivity or
the egress gateway (GT5). Terraform for endpoints and circuits is generated
from these flows.

## D14 — Scaling is a choice among options, not "add instances"
Each bottleneck offers scale out, autoscale, scale up, rate limiting, async
queues or CDN offload (and for queues: consumers, partitions, brokers). Every
option is dry-run so its effect on utilization, errors and throttling is shown
before it is chosen. Protection comes before scaling (P7).

## D15 — Platform dependencies are modelled explicitly
Components declare what the platform must provide (images, artifacts, keys,
secrets, telemetry). A platform dependency expert, driven by the provider pack,
flags gaps and adds shared services. Dependency links carry no traffic.

## D16 — Every change is undoable
The workbench keeps an undo/redo history of design snapshots. Decisions and the
AI log are audit records and stay even when a change is undone.

## D17 — Technical constraints are separate from policy
Policy (ground truth, EA principles) can be overridden with a recorded
exception. Technical constraints cannot: if a provider or a component type
cannot make a connection (API gateway → database, WAF → database, database →
service), the Action Guard refuses it outright and offers a valid alternative.
The constraint table lives in the provider packs so each provider's real
integration options are used.

## D18 — Architect in the loop, always
Agents advise, simulate and propose changesets. Only people apply them, and
decisions recorded by architects wait for a lead architect's approval. Every
model answer is labelled with the engine that produced it and logged.

## D19 — Console engines: rules, description reader, model
Exact commands run on rules (fast, predictable). A rules-based description
reader turns a paragraph into a baseline and states its assumptions. Free-form
requests go to the model on Buddy through an OpenAI-compatible endpoint; it
returns a structured change plan that is validated (technical constraints) and
reviewed by the Action Guard before anything changes.

## D20 — Domain expert agents behind one harness
Solution, security, network, data, platform and cloud, capacity and SRE,
FinOps and compliance agents. A harness runs every agent with tool
permissions, budgets, traces and regression evals, so agent quality is
measured rather than assumed.

## D21 — Escalation and second opinion
A larger model (local 70B or Claude through a LiteLLM proxy on Buddy) is used
only by explicit setting: for escalation of hard requests and for an
independent second opinion on a proposed change. Second opinions are advisory.

## D22 — Every change is a ledger entry
Each change records an ID, author, role, time, guard verdict, linked decision
and an exact diff, and can be traced or reverted. In the backend the ledger is
the event log of D1, so history, versions and audit come from one source.

## D23 — Autoscaling and cost are part of every simulation
Stateless components follow an autoscaling policy (minimum, maximum, target,
scale-out delay, scale-in cool-down). Cost uses per-provider list-price
estimates that teams override with their own rates; the UI always calls them
estimates.

## D24 — Managed services scale by configuration, not instances
Whether a component is managed depends on the provider pack (API Gateway on
AWS is managed; Kong on VMware is not). Managed components are one box with a
MANAGED flag; their capacity is a configured limit or quota; scaling them is a
configuration change that is shown on the canvas and recorded in History.
Resiliency follows the service's scope: zonal (one per zone), regional (the
provider covers zones; plan cross-region DR to the RTO) or global.

## D25 — Natural-language design is a conversation that ends in a checklist
The console keeps short conversation memory, lets the model ask before
guessing, and turns every model answer into a plan the architect can edit
step by step. Plans are validated and repaired once before they are shown.
Recurring structures are deterministic patterns the model can call, so the
model chooses and the rules build. A fixed eval set measures model quality
on the architect's own design.

## D26 — MCP and the harness come before features
Every later capability is built as tools behind the harness from the start.
The roadmap moves MCP servers to WP1 and the goal loop to WP2; topology and
HA/DR follow as WP3. Features scale by adding a tool set, an agent card and
rules, without changing the core.

## D27 — Sign-in and per-project roles from WP0
Accounts are created by an administrator (no self sign-up). Sessions are
signed, httpOnly, SameSite=Lax cookies; state-changing calls also need a
custom header. Passwords use Argon2; five failures lock an address for 15
minutes; a password, role or status change signs the user out everywhere.
System roles are admin and member. Project roles, from least to most access:
viewer, reviewer, security architect, architect, lead architect, owner.
Permissions, not roles, are checked. Nobody can grant a role above their own,
and a project always keeps an owner. Non-members get 404, not 403.

## D28 — Agents never outrank the person who runs them
The harness gives an agent the tools on its card that the caller's role
allows, inside a budget (steps, tool calls, tokens, time), and traces every
model turn, tool call and denial. There is no tool that applies a change:
agents propose changesets, and someone with changeset:apply decides.

## D29 — One simulator; the prototype is the test oracle
The authoritative simulator moves to Python as an MCP server in WP1; the
browser only animates its results. Until then the prototype canvas is
embedded through a postMessage bridge, and its outputs on sample designs
become golden tests the new servers must match.

## D30 — Opinions are computed, cited and chosen
The Action Guard shows the change as asked (opinion 1) and a second
opinion's alternative (opinion 2) side by side. Both are dry-run by the same
rules and simulator, which compute risk, security and cost; the model only
explains. Each pro and con is tagged with a Well-Architected pillar (AWS,
Azure, Google Cloud) from a fixed reference list; uncited points are
dropped. Choosing either opinion records a decision with both sets of
numbers.

## D31 — Data centres are vendor-neutral with industry defaults
The data centre provider names roles, not vendors, with a widely used
product as the default (F5, Kong, Keycloak, OpenShift, PostgreSQL, Kafka,
Harbor, Artifactory, Vault, an HSM, Prometheus and Grafana). Each design can
name its own products; changes are recorded in History.

## D32 — Building is not breaking
A change that only adds components cannot violate policy by itself; its new
findings describe an unwired component. Such changes are reviewed, not
blocked. Connecting, changing and removing keep full enforcement, so a flow
that bypasses the WAF is still blocked.

## D33 — Network segments and groups are part of the design model
Subnets (tier, CIDR, zone), security groups (default-deny, allowed sources,
ports) and application groups are stored in the design and checked as policy
as code: tier placement (EA-P5) and allowed flows (EA-P5, EA-P1). External
systems are never reachable by a direct network path.

## D34 — Best practices belong to the role, not the product
Each component type carries its critical settings, mapped to Well-Architected
pillars, with provider-specific wording. Changing the product keeps the
checks; product-specific settings will come from the platform agent (WP5).
Opinions state their engine and confidence; the model's own confidence is
shown next to the share of its points that were grounded.

## D35 — Regions are simulated as stamps
An active-active design is one regional stack deployed in two regions; the
simulator runs the most-loaded region. DNS decides who moves when a region
fails, so failover is only credited when health checks (and a default
record for geolocation) are set. Data decides whether the other region can
work at all: a single-region database fails both regions, a global database
fails over with a small data loss, and an active-active database (Aurora
DSQL) keeps serving. Organisation standards for these paths are ground truth
rules (GT6, GT7), so they are policy as code and can be edited or removed.

## D36 — Resilience patterns are templates over the same model
The six resilience patterns are not separate features: each sets the same
model inputs (zones or sites, regions or data centres, DNS or GSLB policy,
database replication, instance counts, Direct Connect) and is then tested
with the same zone and region outage simulation. A data centre's metro
sites are modelled as zones (synchronous); a remote data centre as a second
region (asynchronous). "Hybrid" means a cloud workload connected to
systems and users in the data centre over Direct Connect. Applying a pattern
is an architecture decision.

## D37 — The public landing page is separate from the app
The landing page is a static site with no sign-in, API or model behind it,
so it can be published without exposing the app. Sign-up says Coming soon
until accounts can be self-served. Its walkthrough is topologically
correct: the WAF sits on the CDN or load balancer at the edge, not as a hop
before the services. The load balancer spans zones, and the database's
primary and standby are in different zones. Every figure in it is labelled
as simulated.

## D38 — A lab instance for ideation, development and testing
The lab is the same app with the landing page switched off
(`NEXUS_LANDING=off`), its own Compose project, database, settings file,
port and image tag. Changes can be tried there, on any branch, without
touching the main instance's data or images.

## D39 — Strategy is a separate module that converges through the model
The Chief Technology Architect works at a different altitude from the
solution architect, so NEXUS Strategy is its own module (its own page,
state and workflow), not more panels on the canvas. It converges through
the design model: its principles, guardrails and approved stack become the
canvas's EA principles, ground truth and Technical Capabilities, and its
roadmap initiatives become design briefs. The hand-off is explicit
(`import strategy`), reviewed, recorded and undoable. Today it travels
through the browser; with WP1 it becomes an MCP tool on the governance
server.

## D40 — A canvas-only deployment for ideation
For quick ideation and tests, the canvas and the Strategy module are also
served on their own (`deploy/canvas.sh`), with no landing page, sign-in, API
or database. Work stays in each browser. The full app (projects, roles,
versions, decisions) remains the system of record.

