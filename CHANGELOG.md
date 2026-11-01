# Changelog

All notable changes to NEXUS. Format follows Keep a Changelog; versions follow
Semantic Versioning.

## [Unreleased]

## [0.2.0] — 2026-11-01

WP0: the application scaffold, sign-in with role-based access, and the agent harness.

### Added
- **Web app** (Next.js 16, React 19): landing page with the access matrix,
  About, sign-in, projects (blank or sample, by provider), project page with
  Workbench, Changesets, Agents, Members and History tabs, administration
  (users, audit trail) and account (change password).
- **API** (FastAPI, SQLAlchemy 2, Alembic, PostgreSQL 16): sessions in signed
  httpOnly cookies, Argon2 passwords, login lockout, CSRF header, audit trail,
  design store with optimistic versioning and revisions, API keys stripped
  from stored designs, design-model JSON schema validation.
- **Role-based access**: system roles (admin, member) and project roles
  (viewer, reviewer, security architect, architect, lead architect, owner)
  checked as permissions; nobody grants above their own role; a project keeps
  an owner.
- **Changesets**: proposed by people or agents, dry-run when proposed,
  applied or rejected by architects and above; applying creates a revision.
- **Agent harness**: agent cards in YAML (orchestrator, security, HA/DR,
  explainer), tool policy = card tools ∩ the caller's permissions, budgets,
  full traces, evals against the real model. Agents cannot apply changes.
- **Canvas bridge**: the prototype runs inside the app, loads and autosaves
  the project's design, and follows the user's project role (read-only for
  viewers and reviewers).
- **Action Guard opinions**: the change as asked and a second opinion's
  alternative side by side, each with an animated before/after diagram,
  computed risk, security and cost, pros and cons tagged with Well-Architected
  pillars, collapsible references, and a choice to implement either; the
  choice is recorded as a decision. The guard is movable and can be made
  see-through.
- **Canvas**: routing that avoids components; curved line style; lighter flow
  lines; shared platform services colour-coded with matching connectors;
  zones drawn as isometric floor plates in 3D; "Add component" menu in the
  header with full names and search; breadcrumb in the header.
- **Data centre**: vendor-neutral roles with industry-standard default
  products, overridable per design in Settings or with
  `stack database = Oracle Database 19c`.
- **Deployment**: Compose with PostgreSQL, API, app and nginx edge; sign-in
  required for `/llm/` and `/c4/`; `buddy.sh` generates secrets and the first
  administrator.

### Changed
- Roadmap: MCP servers move to WP1, the goal loop to WP2, topology and HA/DR
  become WP3 (D26–D31).
- "Datacenter" is now "Data centre" with generic zone names.

## [0.1.16] — 2026-10-31

Natural-language design in the Systems Architect Console.

### Added
- **Conversation memory**: the model sees the last six turns, so follow-ups
  ("now make it multi-region", "add caching to that") work. The console header
  shows how much context is kept; "new conversation" clears it.
- **Clarifying questions**: for ambiguous requests the model asks up to three
  short questions instead of guessing; the next answer goes straight back to it.
- **Plans are editable checklists**: every step can be unticked; impossible
  steps are shown with the reason and cannot be ticked; the effect of the
  selection (findings resolved, new critical findings, errors) updates as you
  tick. "Review and apply" goes through the Action Guard; "Ask to revise" and
  "revise PL-03: <change>" send feedback to the model.
- **Self-repair**: before a plan is shown, impossible steps and new critical
  findings are sent back to the model once for a corrected plan, labelled
  "revised after validation".
- **Strict output**: the model is asked for the exact plan JSON schema
  (structured output); servers that do not support it fall back to JSON mode.
- **Design patterns** as deterministic building blocks for people and models:
  cache-aside, event-driven (outbox + Kafka), CQRS, saga, BFF, egress control,
  zero trust, high availability. "patterns" lists them; "apply cqrs to SVC1".
- **eval console**: scores the console model on eight fixed requests against
  the current design (valid JSON, usable plans, problems left, repairs,
  latency). Nothing is applied.

## [0.1.15] — 2026-10-31

### Changed
- **Focus layout** (new default): the canvas gets the screen. Advisor, IaC,
  LikeC4, Design Tree, Load, Legend, Capabilities, Principles and Ground Truth
  live in one side panel with a slim icon rail; one opens at a time, clicking
  the open one folds the panel away, and the diagram re-fits to the space. The
  rail shows the number of critical findings.
- The console is a slim bar at the bottom (⤢ for a taller one; it grows
  automatically when there is a lot of output).
- One-row toolbar: icon Undo/Redo and Settings, shorter labels, compact key
  numbers.
- "Free layout" in Settings brings back movable floating windows and the
  bottom dock.

## [0.1.14] — 2026-10-31

### Added
- **Managed services** are modelled as the provider runs them: one component,
  a MANAGED badge, no instances, no stack, no autoscaling policy and no
  per-instance cost. Scaling is a **configuration change** (throttle limit,
  request quota, concurrency, max instances), with a "Raise limit" option,
  client rate limiting or a CDN. Which types are managed depends on the
  provider pack: on AWS, API Gateway, Cognito, Lambda, SQS, S3, CloudFront,
  WAF, ALB, NAT and the platform services; on Azure and GCP also Container
  Apps and Cloud Run; nothing in the datacenter pack.
- **Configuration changes are visible**: the component shows a "⚙ <setting>
  <old> → <new>" flag for a few seconds after any change, History records the
  exact before and after (provider defaults included), and Terraform states
  each managed service's configuration and resiliency.
- **Resiliency by kind** (principle P2 updated): instance-based components run
  2+ instances across zones; zonal managed services (e.g. NAT gateway) run one
  per zone; regional managed services rely on the provider across zones and get
  a cross-region DR recommendation that matches their RTO; global services
  (CDN) need nothing extra.

### Fixed
- Managed services were stacked as several instances, counted in Instances and
  charged per instance.
- Cognito (IDP1) and other regional managed services were flagged as single
  points of failure.

## [0.1.13] — 2026-10-31

### Added
- **Drag a whole group**: grab a zone's label or its dashed border (the cursor
  changes to move and the group highlights) and every component in it moves
  together; the group outline and all flows follow. The outer VPC / VNet /
  datacenter box moves everything inside your boundary.
- **Select several**: Ctrl/⌘-click components, or Shift-drag on empty canvas
  to box-select; drag any selected component to move them together. Esc or a
  click on empty canvas clears the selection.
- Group and multi-component moves are one undo step and appear in History.

### Fixed
- Moves were not recorded in the change history (positions were not part of
  the diff). They now appear as "layout: moved …".

## [0.1.12] — 2026-10-31

Readability of the canvas.

### Added
- **Right-angle routing** with rounded corners: flows leave the side of a
  component, run in the gap between columns and enter the target's side.
  Fan-out from one component shares a trunk; flows from different components
  get separate lanes. Straight lines remain an option.
- **Line jumps**: a horizontal run hops over a vertical run of another flow
  where they cross.
- **Legend** window (toolbar → Legend): flow thickness, jumps, internet or
  plaintext, private connectivity, platform dependencies, label format, load
  colours, component styles and badges; with the line style, dependency toggle
  and Tidy layout.
- **Tidy layout** (toolbar, legend, or console "tidy"): columns by trust zone
  (internet, edge, ingress, app, data, third parties), ordered to reduce
  crossings, shared platform services in a row below. Sub-designs are laid
  out by flow order. One Ctrl+Z restores the previous layout.
- Hovering a flow highlights it and shows its label.

### Changed
- Platform dependency lines are hidden until a component is selected or
  hovered (or "All dependency lines" is ticked).
- SaaS and external systems have their own "Third parties" zone instead of
  stretching the Internet zone across the canvas.
- Flow labels sit on the longest straight run and never cover a component or
  another label; crowded labels appear on hover.

## [0.1.11] — 2026-10-31

### Added
- **Redesign**: `redesign`, `redesign: <goal>`, `fix the weak points` or
  `apply the second opinion` asks the escalation model (gpt-oss) for an
  incremental plan that resolves the current findings and, if present, the
  latest second opinion's recommendations. It keeps component IDs, is
  validated against technical constraints, is reviewed by the Action Guard,
  and after it is applied the console shows compliance before and after.
  One Ctrl+Z undoes the whole redesign.
- Every console request to a model now includes the rules engine's current
  findings, so answers address real problems.

## [0.1.10] — 2026-10-31

### Added
- **Escalation in the console**: when the console model fails or returns no
  usable plan, the request is sent to the escalation model (default
  `gpt-oss:latest` on the same Ollama endpoint), labelled "escalated". Can be
  switched off in Settings. `escalate` re-runs the last request on it;
  `escalate: <request>` sends a request straight to it. Up to 5 minutes for
  large models, with a running timer.
- **Second opinion on the whole design**: `2nd opinion` (or
  `2nd opinion: <focus>`) sends the design, the rules-based compliance result
  and the load picture to the escalation model for an independent review:
  opinion, risks, missing pieces, recommendations. Advisory only; recorded in
  Decisions and the AI log.

### Changed
- The Action Guard's "Second opinion" and escalation default to `gpt-oss:latest`
  on the console endpoint (older settings that pointed at a cloud placeholder
  are moved over).

Verified on Buddy: Ollama in Docker, `qwen2.5:7b-instruct`, through the NEXUS
proxy (3.4 s answer).

## [0.1.9] — 2026-10-31

### Added
- **Compliance check** ("validate compliance", or the button in Findings):
  verdict, every ground-truth rule and EA principle with evidence, MITRE ATT&CK
  exposure, technical constraints, platform dependencies, pending approvals and
  exceptions, and what to fix first. Always rules-based, never sent to a model.

### Fixed
- Console model calls returned HTTP 403 on Buddy: Ollama rejects browser
  requests from origins it does not know. The NEXUS proxy now drops the Origin
  header and presents a host Ollama accepts. `buddy.sh` tests the model the same
  way the browser calls it.

## [0.1.8] — 2026-10-31

### Changed
- Reasoning models that "think out loud" (deepseek-r1, qwen3 thinking) and
  answers wrapped in code fences no longer break the console's plan reader.
- Automatic model choice prefers Qwen 2.5 or newer over Qwen 1.5, and skips
  code models.

## [0.1.7] — 2026-10-31

### Changed
- Console model setup for Ollama with Qwen on Buddy: if the configured model is
  not installed, the console switches to the installed Qwen chat model (skipping
  embedding, vision and coder models), says so, and retries. "Test connection"
  picks the same way.
- Clearer errors: model not found (with the installed list), and 502/504 when
  the NEXUS proxy cannot reach Ollama. Model timeout raised to 120 s for
  larger local models.

## [0.1.6] — 2026-10-31

### Added
- **What-if up to 1,000×** (log slider and console), with Instances, Cost
  estimate and "Safe up to" (the highest load at which every component stays
  under 85% with autoscaling at its maximum, and which component limits it).
- **Autoscaling policy** in Settings: minimum, maximum, target utilization,
  scale-out delay, scale-in cool-down. Stateless components start at the
  minimum, scale out with demand and scale back in to the minimum.
- **Demand player**: ramp, daily cycle, flash spike or steady profiles up to
  1,000×, simulated over time with scale-out lag and scale-in cool-down. Three
  charts (demand, instances, cost per hour) on one time axis with hover, plus
  scale events, run cost and which component caused any errors.
- **Cost model**: list-price estimates per provider (per instance and per
  million requests), editable in Settings. Estimates, not quotes.
- **Architect console engines**, labelled on every reply: rules for exact
  commands; a description reader that turns a paragraph ("a claims portal for
  200k customers on Azure with Stripe…") into a baseline and states every
  assumption; and the model on Buddy (any OpenAI-compatible server) for
  free-form requests. The model returns a change plan; impossible steps are
  skipped with the reason; the Action Guard reviews the rest.
- **Second opinion**: the Action Guard can send a proposed change to an
  escalation model for an independent review (advisory only).
- **Change ledger** (History tab): every change gets an ID (CH-0001…), who,
  role, time, Guard verdict, linked ADR and an exact diff; restore the design
  to before any recent change.
- **Roles** (simulated until sign-in exists): architect, lead architect,
  security architect, reviewer (read-only). Decisions recorded by non-leads
  wait for a lead architect to approve or reject.
- Windows are resizable; minimized windows become small movable tabs.
- Deployment: nginx proxies `/llm/` to the model server on Buddy
  (`NEXUS_LLM_UPSTREAM`, default Ollama on port 11434); `deploy/buddy.sh`
  reports whether the model server is reachable.
- Architecture: domain expert agents, agent harness, and a review and approval
  service in the LikeC4 model (new `agents` view).

### Fixed
- "Add a cache between SVC1 and DB1" was refused; it now places the cache
  cache-aside (the service talks to both).
- Multi-step requests were mis-parsed by the single-step add rule; they now go
  to the model, or the console says it will not guess.

## [0.1.5] — 2026-10-31

### Fixed
- Red rows in the Design Tree that could not be found among the instances:
  they were placeholder "Component A / B" services inside a load balancer's
  sub-design (created by v0.1.1–0.1.2). As services they had their own 800 rps
  capacity but carried all the traffic passing through the load balancer, so
  they showed over 300%. They are converted to parts on load, with a note in
  the console and the AI log.
- The Design Tree now labels "instances (n)" and "sub-design (n)" separately
  under a component.

### Added
- A component shows when something inside its sub-design is warm or hot: its
  ▸ badge turns orange or red, and its tree row names the hot part.
- Findings for components inside a sub-design name their parent.

## [0.1.4] — 2026-10-31

### Added
- **Technical constraints**: each component type now knows what it can
  actually call (e.g. an API gateway forwards HTTP/gRPC to services,
  functions or AWS-service integrations; a WAF only fronts CDNs, load
  balancers and gateways; databases and caches never initiate calls). An
  impossible flow is refused as NOT SUPPORTED with the provider's own reason;
  unlike policy findings, no exception can override it. The Guard offers
  "Insert a service between" (on AWS a Lambda for API Gateway → RDS).
- Impossible flows already in a saved design are flagged with the same fix.
- New principle P8 "Each service owns its data" and a finding when one
  database is shared by several services.

### Fixed
- An API gateway could be connected straight to a database.
- Card text overlapped (load, replica count and sub-design count); badges
  moved to the service line and the load line now truncates.

## [0.1.3] — 2026-10-31

Second round of feedback from testing on Buddy.

### Added
- **Scaling and protection options** for every component, each previewed in a
  dry-run with utilization, errors and throttling after: scale out, autoscale
  (min–max), scale up, rate limit at the gateway or WAF (new principle P7),
  async via a queue, CDN offload.
- **Queues and event streams**: Kafka (MSK / Event Hubs / Managed Kafka /
  Strimzi), message brokers and managed queues, with partitions, partition key,
  brokers, consumer group size and consumer rate. Consumer lag and idle
  consumers (more consumers than partitions) are simulated and flagged.
- **Undo / Redo** in the toolbar (Ctrl+Z, Ctrl+Shift+Z) for every change,
  including moves, renames and governance edits.
- **Instances everywhere**: numbered per component (`SVC1.1`, `SVC1.2`;
  `DB1.1` primary, then replicas and standby; `Q1.1` brokers then consumers).
  "Instances" in the toolbar shows all of them on the canvas and in the Design
  Tree.
- **Platform dependency expert**: shared platform services (container registry,
  artifact store, key management, secrets, observability) with provider names
  (ECR, S3, KMS, Secrets Manager, CloudWatch…), rules for what each component
  needs, a finding, one-click "add dependencies", and Terraform.
- **Identity options**: customers or workforce; own directory, federation to a
  corporate IdP (SAML/OIDC, e.g. Entra ID, Okta) or social logins. On AWS this
  shows as Cognito + SAML federation or IAM Identity Center.
- **Zoom for details**: zoom in to read rules, limits, inputs, outputs and
  dependencies under each component.
- Meaningful sub-designs for every component type (WAF rule sets, gateway
  plugins, adapter retry/circuit breaker, Kafka topic and consumer group…).
- Component dropdown (▾ on every component, or right-click) with "Connect to"
  list, inspect, open, instances, dependencies and remove.
- Console: "use aws managed kafka for microservice to microservice
  communication", rate limit, autoscale, partitions, consumers, brokers,
  federate, add platform dependencies, undo/redo, component names instead of
  IDs ("make catalog faster"), and suggestions when a command is not understood.

### Fixed
- Removing the WAF gave no warning and no user errors. Users without a route
  now fail (errors 100%), and removing a security control is high risk or
  blocked by ground truth.
- Flow label pills are now semi-transparent.
- The component action bar covered details; replaced by the ▾ dropdown.

## [0.1.2] — 2026-10-31

Prototype iteration from the first test on Buddy.

### Added
- **Action Guard**: every design change (add, connect, remove, scale, fix,
  connectivity) is dry-run on a copy first. It shows the verdict, checks
  (zero-trust path, ground truth, capabilities, resilience, capacity, threat
  exposure), consequences (errors, latency, bottleneck, orphaned components),
  new and resolved risks, and tradeoffs. Ground-truth violations are blocked
  in Enforce mode unless a written justification is recorded as an exception
  decision. Modes: Enforce, Advise, Off (Settings).
- **Database scaling decision** in the Inspector: reads vs writes, primary vs
  replica utilization, and options (cache, scale up, read replicas, shard,
  write buffer) with utilization after, tradeoffs, a recommendation following
  the new principle P6, and a "shard only if" checklist.
- Database model: instance size, read share, read replicas, shards, data size,
  standby. Read replicas add read capacity only; writes scale up or out.
- **Instances view**: show each replica (`SVC1.1`, `DB1.p`, `DB1.r1`, `DB1.sb`)
  under its component with its own load; click one to inspect it.
- **Provider packs** (AWS, Azure, GCP, Datacenter): choosing Deploy now renames
  components (e.g. RDS PostgreSQL, Container Apps), relabels zones, draws the
  VPC/VNet boundary, applies provider limits and drives Terraform.
- **External connectivity**: SaaS and egress-gateway components; per-flow
  connectivity (in-network, internet, PrivateLink / Private Endpoint / Private
  Service Connect, VPN, Direct Connect / ExpressRoute / Interconnect) with
  matching Terraform; new ground truth GT5 for third-party traffic.
- Zone-hop rule: flows may move only one trust zone at a time (EA-P5).
- Decisions tab: architecture decisions recorded with context, options and
  tradeoffs.
- Component action bar (Connect, Open, Instances, Remove) and keyboard
  shortcuts C, I, Delete, Esc. Click a flow to inspect, change or remove it.
- LikeC4: Action Guard agent, provider packs and a guard flow view.

### Fixed
- Flow labels unreadable on thick flows: labels now sit on pills above the
  flows; thick flows fade with a gradient.
- Sub-design capacity ignored the parent's replicas, so inner components stayed
  orange after scaling out.
- Scaled components were not visible in 3D.
- Shift-drag to connect failed on some browsers; a Connect button now works
  everywhere (Shift during a drag still works).

## [0.1.1] — 2026-10-31

### Added
- Test deployment: one site with the prototype at `/` and the LikeC4
  architecture at `/c4/` (`deploy/build-site.sh`, `deploy/Dockerfile`,
  `deploy/nginx.conf`, health check at `/healthz`).
- Deployment to Buddy, the home LLM server (192.168.1.93): Docker Compose
  (`deploy/compose.yml`, port 8088, read-only container) and `deploy/buddy.sh`
  to pull, rebuild and health-check. Standalone NEXUS stack.

## [0.1.0] — 2026-10-31

Concept baseline: prototype and target architecture.

### Added
- Clickable prototype (`poc/prototype/index.html`):
  - Canvas with animated traffic, green/orange/red status, trust-zone perimeters,
    drag, pan, zoom, sub-designs by double-click, short component IDs.
  - What-if load slider and failure simulation; KPIs for offered load, error rate,
    latency estimate and bottleneck.
  - Design Advisor with findings citing EA principles, Ground Truth and MITRE
    ATT&CK, one-click fixes, draft ADRs, quantified justification per component.
  - Generated Terraform (AWS, Azure, GCP, VMware) with checks, and LikeC4.
  - Animated Design Tree with magnifier.
  - Console with natural-language commands, guided discovery and saved versions.
  - Versioned Technical Capabilities, EA Principles and Ground Truth panes;
    file ingestion (PDF, DOCX, JPG, PNG; tagging only).
  - Flow, Flat, 3D and Relations views; AI log; model settings.
- Target architecture in LikeC4 (`architecture/likec4/nexus.c4`) with context,
  containers, MCP and what-if views.
- Docs: architecture, decisions D1–D8, roadmap WP0–WP8, current state.

### Known limitations
- No AI model is called; the advisor is a rules engine standing in for the SLM.
- Uploaded files are tagged by filename; their contents are not read.
- Simulation is an analytical capacity model, not a forecast.
- Generated Terraform has not been run through `terraform validate`.
- State lives in the browser's local storage only.

[Unreleased]: https://github.com/dizonj-lab/nexus/compare/v0.1.16...HEAD
[0.1.16]: https://github.com/dizonj-lab/nexus/compare/v0.1.15...v0.1.16
[0.1.15]: https://github.com/dizonj-lab/nexus/compare/v0.1.14...v0.1.15
[0.1.14]: https://github.com/dizonj-lab/nexus/compare/v0.1.13...v0.1.14
[0.1.13]: https://github.com/dizonj-lab/nexus/compare/v0.1.12...v0.1.13
[0.1.12]: https://github.com/dizonj-lab/nexus/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/dizonj-lab/nexus/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/dizonj-lab/nexus/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/dizonj-lab/nexus/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/dizonj-lab/nexus/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/dizonj-lab/nexus/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/dizonj-lab/nexus/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/dizonj-lab/nexus/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/dizonj-lab/nexus/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/dizonj-lab/nexus/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/dizonj-lab/nexus/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/dizonj-lab/nexus/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/dizonj-lab/nexus/releases/tag/v0.1.0
