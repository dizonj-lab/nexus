# Changelog

All notable changes to NEXUS. Format follows Keep a Changelog; versions follow
Semantic Versioning.

## [Unreleased]

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

[Unreleased]: https://github.com/dizonj-lab/nexus/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/dizonj-lab/nexus/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/dizonj-lab/nexus/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/dizonj-lab/nexus/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/dizonj-lab/nexus/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/dizonj-lab/nexus/releases/tag/v0.1.0
