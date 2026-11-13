# Changelog

All notable changes to NEXUS. Format follows Keep a Changelog; versions follow
Semantic Versioning.

## [Unreleased]

## [0.3.12] — 2026-11-13

### Fixed
- **Saved designs did not come back (since v0.3.9).** When a design was saved with the Layers panel
  open (every new design leaves it open), reloading the page stopped at start-up: the canvas showed
  nothing and saved versions looked lost. They were still stored and now load again. When the
  browser's storage is full, the console says so instead of failing without a word.
- **Every AZ in the region by default.** New AWS designs use all of the region's availability zones
  (3 in Singapore; the canvas draws up to 3) instead of 2. A choice in Layers → Zones / sites is kept;
  older designs saved with the old default of 2 open with the region's zones.

## [0.3.11] — 2026-11-13

### Fixed
- **Availability zones per region.** The VPC label read "ap-southeast-1 Singapore · 2 AZs", as if the
  region had two; Singapore has three. The label now says how many the design uses out of the
  region's zones ("2 of 3 AZs"), for region B too, and Zones / sites offers only as many as the region
  has (the smaller region, with two). The counts come from the AWS regions page
  (`packs/catalog/aws-regions.json`, 37 regions, checked 2026-11-13). Two-region designs still default
  to 2 AZs; choose 3 under Layers → Zones / sites.
- The canvas version label is checked against `VERSION` by `run-all.sh`.

## [0.3.10] — 2026-11-13

### Fixed
- **Global edge hops.** DNS → CDN → the CDN's WAF → API gateway or regional edge is a valid chain;
  "global → global is not an allowed hop" no longer fires. A WAF attached to a CDN is global: drawing
  region B no longer copies it.
- **Load balancers.** A load balancer whose callers are all private (API gateway through a VPC Link,
  services) is internal and belongs in the application tier: no "skips a perimeter" for GW → LB or
  LB → services, no "belongs in the public tier". An internet-facing load balancer may forward to
  private targets (edge → app).
- **DR findings in two regions.** Region B is the DR plan: regional services (API gateway) no longer
  ask for one, and region-B copies get no findings of their own. Identity providers keep one note:
  user pools are not copied to region B.
- **Managed services in region B.** Drawing region B gave the managed API gateway a private subnet.
- **Shared databases.** A service and its region-B copy are one owner, not two services sharing a
  database (SP-Microservice and the legacy rule).
- **Finding numbers.** Findings from placement, multi-region, workforce sign-in, critical settings
  and Service Packs were listed without a number ("undefined").

### Added
- **Database replication with two regions.** Turning on two regions replicates every single-region
  database (Aurora Global Database on AWS): writes stay in region A, region B reads locally and
  takes over in about a minute. In active-active the finding says writes from region B cross to
  region A and offers Aurora DSQL for writes in both regions. Region B's services then use their own
  database copy, so nothing crosses regions.
- `regions.e2e.mjs` in `run-all.sh`.

## [0.3.9] — 2026-11-13

### Fixed
- **Placement is drawn as the knowledge says.** The canvas now has columns: internet ·
  **global edge** (DNS, CDN, a WAF in front of a CDN) · **regional services, no VPC** (API Gateway,
  Cognito, regional WAF) · the VPC and its subnets · **regional services, no VPC** (S3, SQS, SNS,
  DynamoDB, Bedrock). A CDN was drawn inside the public subnets of region A; managed services sat
  in subnet columns. The VPC frame and the shared platform band no longer include them. New designs
  and Tidy use the same columns; with two regions, each region's services are labelled.
- **Two regions get DNS steering.** Turning on multi-region adds DNS (Route 53 on AWS) if there is
  none, puts it in front of every internet entry point, and points it at the entry of region B when
  the regions are drawn side by side: failover routing for active-passive, latency for
  active-active. The console said "Active-active" for active-passive and "DNS splits users 50/50"
  when there was no DNS.
- **Console:** `add dns` / `add route 53` added nothing or an API endpoint; `add api gateway`,
  `add secrets manager` and similar were wired to the existing component of the same name; `why DB1`
  printed "undefined"; `multi-region active-passive` was not understood. Unknown requests without a
  model print one line instead of three.

### Added
- **The AWS product catalogue in the workbench**: Add component searches all AWS products (367 from
  aws.amazon.com/products); `add <any AWS product>` and `find <words>` in the console. Products NEXUS
  models are added with their name; others say they are not modelled yet and which Service Pack is
  planned; retired products are flagged (App Mesh).
- **One What-if panel** (the rail's What-if, formerly Load): every active what-if with one Clear all,
  the load multiplier, zone, region and component failures, and the demand run. The top bar shows a
  single chip only while a what-if is active; the Inspector no longer has a failure selector.
  Design settings (workload, zones, regions, resilience patterns) moved to Layers.
- Console answers without a model: `what is SVC1`, `list components`, `find …`, `show iac`
  (and other panels), `tidy` (everything, when nothing is selected).

### Changed
- Less noise: "what changed" chips appear only after small edits (three components or fewer), not
  on every component after a new design.

### Added
- **AWS product ground truth** (`packs/catalog/`): AWS's own product list, read from
  aws.amazon.com/products and its product directory (367 entries: 107 on today's page, 278 services),
  joined with a curated NEXUS map (type, scope, Service Pack family, tier) and the packs that exist.
  Generates `docs/design/AWS-GROUND-TRUTH.md`: coverage (3 by Service Packs, 18 by component packs,
  44 drawable without a pack, 302 not modelled) and the Service Pack backlog in order. Tested in
  `packs/tests/catalog.test.mjs`. AWS App Mesh is flagged: AWS ended support on 30 September 2026.

## [0.3.8] — 2026-11-07

### Added
- **Service Packs, first two, at Preview** (on by default; Settings → Service
  packs turns each off and brings back the legacy checks). Each pack lives in
  `packs/services/` with what it covers and does not, organisation policy,
  integration rules, sourced facts and rules with rationale, basis, references
  and a fix; every rule has a must-raise and a must-not test.
- **SP-Microservice 0.1** (ECS Fargate services):
  - **gRPC** between services by default; REST stays at the edge. Console:
    `connect A to B over grpc` / `over rest`.
  - **Connectors** on the block: each call carries its contract, deadline,
    retries, read or write, and idempotency key (flow Inspector).
  - Inspector panel with tabs **Connectors · Inside · Scale & SLO · Rules ·
    Pack**. Inside is the hexagonal view (adapters, ports, domain, Envoy
    sidecar) generated from the connectors.
  - **Scale state on the block** during a demand run: `×3→×5▲` waiting for the
    scale-out delay, `×5▲+2` scaling out, `×10 MAX`, `×6→×3▼` waiting for the
    cool-down, `×3▼−3` scaling in, and an instance bar from minimum to maximum.
  - 13 rules: call loops, synchronous chains longer than 2 hops, deadlines that
    do not shrink, calls without a deadline, retried writes without an
    idempotency key, retries multiplying along a chain, shared databases,
    fewer than 2 copies, in-memory state with several copies, scheduled work in
    every copy, calls without a contract, gRPC from browsers, availability
    targets above what the dependencies give.
- **SP-Kafka 0.1** (Amazon MSK provisioned, Standard brokers):
  - The cluster as a block: broker size (m5, m7g, t3.small), brokers (a
    multiple of the zones), storage per broker (can grow, never shrink) and
    autoscaling, client authentication, TLS, unclean leader election, automatic
    topic creation, offset retention; a per-broker table of partition replicas,
    MB/s and storage against the documented recommendations.
  - **Topics as children** with message size, personal data and hot-key share;
    **consumer groups** with catch-up time after a stop; a **dead-letter topic
    per group by default** (`<topic>.<group>.dlq`), shown under its topic,
    counted in the partitions and generated in Terraform.
  - 21 rules, replacing the legacy messaging rules for Kafka topics while on.
  - Terraform: `aws_msk_configuration` (unclean leader election and automatic
    topic creation off, replication 3 and min in-sync 2 for three zones),
    broker size and storage from the block, IAM access control, storage
    autoscaling, dead-letter topics.
- Designs record the Service Pack versions when a version is saved.

### Changed
- A new MSK cluster starts with brokers in a multiple of the zones (4 for two
  zones, 3 for three).
- Facts checked on 2026-11-07 against the official AWS pages: partitions per
  broker by size, storage limits and the 6-hour wait, brokers per cluster
  (30 ZooKeeper, 60 KRaft), MSK default configuration, broker-size updates,
  tiered storage, authentication and encryption, ALB gRPC, ECS rolling
  deployment defaults.

## [0.3.7] — 2026-11-06

### Added
- **Start from a blank canvas**: New design → "Start from a blank canvas"
  (or type `blank canvas`). No components, flows, subnets or targets;
  principles, ground truth, capabilities, settings and saved versions stay.
  Ctrl+Z brings the previous design back.
- **Unsaved work is confirmed first.** Before a blank canvas or a new design
  replaces a design that differs from its last saved version, NEXUS asks:
  Save as a version, then continue · Don't save · Cancel.
- **Messaging, modelled the way teams run it.** The broker is the component;
  its **channels** live inside it; producers and consumers are the
  connections.
  - Four kinds of channel: Kafka **topics** (partitions, replication factor,
    min.insync.replicas, retention, compaction, key meaning, ordering), SQS
    **queues** (FIFO, visibility timeout, retention), RabbitMQ **exchanges**
    (type, quorum queues, one bound queue per consumer group) and the new
    **Notifications / event bus** component: SNS, EventBridge, Event Grid,
    Pub/Sub push or Eventarc, and RabbitMQ or Knative in a data centre.
  - **Publish connections** carry the channel, key (or FIFO message group),
    event and version, delivery (acks=all with the idempotent producer, or
    confirmed), transactional outbox, and message attributes for filters.
  - **Consume connections** carry the channel, consumer group, concurrency,
    acknowledgement (at least once, at most once, transactional), idempotent
    processing, retries, dead-letter queue and ordering; subscriptions also
    carry protocol (SQS, Lambda, HTTPS, email, SMS, push, Firehose), filter
    and the share of messages that match.
  - Console: `add topic orders to Q1 partitions 12 key orderId ordered`,
    `publish SVC1 to Q1/orders key orderId outbox`,
    `subscribe SVC2 to Q1/orders group billing`,
    `subscribe FN1 to NT1/orders protocol lambda`, `add sns`, `add eventbridge`.
  - Connection labels show the channel, key and group or protocol.
  - **Simulation:** a queue shares each message among its consumers; a topic
    or exchange gives each group a copy, shared within the group; a
    notification topic or bus pushes a copy to every matching subscription;
    the provider's publish quota applies.
  - **Rules** (`core.messaging`, 20 checks), each with a fix where one exists:
    - Ordering and delivery: ordering without a key; parallel processing that
      breaks ordering; at-least-once delivery without idempotent processing;
      acknowledging before processing; fire-and-forget producers.
    - Failure handling: no dead-letter queue; unlimited retries; writing a
      database and publishing without an outbox.
    - Kafka sizing: idle consumers (more than partitions); replication below
      the MSK best practice; partitions per broker above the MSK
      recommendation.
    - Push delivery: SNS straight to Lambda at volume (fix: insert a queue);
      plain-HTTP subscriptions; no filter; FIFO topics, which deliver only to
      SQS (refused as a technical constraint); filters with more than 5
      attributes (refused).
    - Other: cross-region delivery; email or SMS to customers; channels with
      no publisher or no consumer.
  - Provider limits added to the packs (SNS, EventBridge, MSK, SQS FIFO, Event
    Grid, Event Hubs, Pub/Sub), each with its source.
  - Terraform: `kafka_topic`, `aws_sqs_queue` with its dead-letter queue,
    `rabbitmq_exchange`/`_queue`/`_binding`, `aws_sns_topic` and subscriptions
    with filter and redrive policies, EventBridge bus, rules and targets,
    Event Hubs with consumer groups, Service Bus queues, Event Grid
    subscriptions, Pub/Sub subscriptions with dead-letter policies.
- **Changes that interrupt a service are announced before you apply them.**
  The Action Guard shows **Expected disruption** with the documented outage,
  how to avoid it and the source, proposes the maintenance window, and waits
  for an acknowledgement when there is an outage. The decision is recorded.
  The Advisor's scaling options show it too. From the packs:
  - **Databases:**
    - RDS Single-AZ resize: an outage of undocumented length.
    - RDS Multi-AZ: a 60–120 s failover.
    - RDS Multi-AZ DB cluster: under 35 s.
    - Adding a read replica: about 1 s on a Single-AZ source.
    - Storage growth: no outage.
    - Azure PostgreSQL flexible: about 10–30 s.
    - Cloud SQL: a restart of several minutes (Enterprise Plus: under a
      second).
  - **Caches:**
    - ElastiCache node type changes and resharding: online.
    - Azure Cache for Redis: blips (Basic loses its data).
    - Memorystore: about 30 s.
  - **Compute:**
    - EC2 instance type: a stop and start.
    - ECS/Fargate: a rolling deployment, with no outage if there are two or
      more tasks.
  - **Kafka:**
    - MSK broker size: up to 2 minutes of client errors.
    - Adding brokers: no outage, but partitions must be reassigned.
    - More partitions: keys move, so ordering per key is not kept across the
      change.

### Fixed
- **The Action Guard blocked a new design.** A new design replaces the old
  one, so the Guard saw the old components (security controls included) as
  removed and blocked the change or rated it high risk. A new design is now
  reviewed, not blocked: its findings stay open in the Design Advisor.
  Starting a blank canvas is not reviewed at all.
- A new design reusing IDs such as DB1 was not mistaken for a resize.

## [0.3.6] — 2026-11-06

### Added
- **Critical settings: recommendation 1 and 2**, like opinion 1 and 2 in the
  Action Guard. For each open setting, **Recommendation 1** comes from the
  NEXUS rules (Well-Architected, deterministic) and **Recommendation 2** from
  the second-opinion model: "agrees with 1", a different value, or "not
  needed" with its reason. **Apply 1** or **Apply 2** (or **Accept: not
  needed**), or **Apply all 1** / **Apply all 2**. Choosing one when they
  differ records a decision (ADR) with both; values from recommendation 2
  are marked as set by the model, chosen by the architect.

### Changed
- **3D view uses the same flow-line rules**: flows are routed along the floor
  grid instead of diagonals, kept apart, and show their responses back to
  the caller.

## [0.3.5] — 2026-11-06

### Added
- **Responses are shown.** Every request flow now has its response: a thin
  dashed line beside it, with an arrow and dots flowing back to the caller.
  Flows into or out of a queue have none (an event has no reply). Legend →
  "Responses (backward)" turns them off.
- **Critical settings you can act on** (Inspector, Properties → Critical
  settings, or the Advisor's "Open critical settings"). Each item shows the
  setting, its current value (the product's default when nobody set it, for
  example RDS backups: 1 day by API, 7 in the console) and the recommended
  value. **Fix** applies it through the Action Guard, recorded as set by the
  rules; **Fix all open** does the whole component; practices are **Mark
  done**. **Get second opinion** asks the escalation model to check each
  recommendation for this component (agree, change with a better value, or
  not needed); it is shown next to each item and changes nothing by itself.

### Changed
- **Flow lines no longer lie on top of each other.** Lines that leave or
  reach the same side of a component start at different points along it,
  and lines that share a corridor are moved apart.
- The embedded canvas address carries the release, and the edge serves the
  canvas without caching, so an upgrade shows after one reload.

## [0.3.4] — 2026-11-06

### Added
- **Knowledge packs** (`packs/`): the first externalized knowledge, as proposed
  in `docs/design/PACKS.md`. 21 vendor packs hold provider limits with their
  default, minimum, maximum, whether they can be raised, the official source
  and the date checked (AWS, plus Azure and Google Cloud where known). A
  placement pack says what may go in which subnet, zone and region, and why.
  The Route 53 pack checks failover: no health checks, failover slower than
  the RTO (detection plus TTL), and probing private endpoints. Packs are
  validated against a schema, tested (`node --test packs/tests/*.test.mjs`)
  and inlined into the canvas by `node packs/build.mjs`.
- **Subnets in every zone.** A new design gets public, application and data
  subnets with one CIDR per zone, and each component is placed in the subnet
  that fits it best; region B gets its own. Layers → "Add standard subnets"
  does the same for an existing design. Components know their region, subnet
  and zones (Properties → Thinking).
- **Drag and drop between subnets, zones and regions.** While you drag, the
  target turns green (fits), amber (possible, with risks) or red (not
  possible), with the reason. Possible moves follow you: the Action Guard
  shows the pros and cons from the placement pack. Impossible ones (a managed
  queue or API gateway in a subnet, an internet-facing load balancer in a
  private subnet, a full subnet, a subnet in the other region) snap back and
  the console says why. Cancel puts the component back.
- **Zones side by side** (Layers → Zones on the canvas, or "zones side by
  side"): one lane per zone with what runs there: instances, the database
  standby with its replication, zonal services and that zone's subnets.
  Drop a component in another lane to pin it to that zone; a load balancer
  cannot be pinned (it needs two zones).
- **Reconnect a flow.** Select a flow and drag either end to another
  component. The Action Guard shows the effect first: load moved,
  utilisation, errors and latency. Technically wrong connections are refused
  while you hover, with the reason.
- **Properties window**: compact (460 px), movable by its title bar and
  resizable from its corner; it no longer covers the canvas. Tabs:
  Attributes, **Limits and defaults** (from the packs, with sources) and
  **Thinking** (what the component knows, sees and concludes, with fixes).
- **Browser checks** in `poc/tests/` with a simulated model server;
  `./poc/tests/run-all.sh` runs everything in Docker (backend tests in
  `python:3.11-slim`; packs and browser checks in the Playwright image), so
  nothing needs installing on the host. Test plan:
  `docs/test-plans/v0.3.4.md`.

### Changed
- **Singapore by default**: region A is ap-southeast-1 (Singapore) on AWS,
  Southeast Asia on Azure and asia-southeast1 on Google Cloud; region B is
  Jakarta (Hong Kong on Azure).
- The simulator uses the packs' provider limits: CloudFront allows 250,000
  requests per second per distribution by default (was a planning figure of
  100,000). Above it, the Advisor says to request an increase in Service
  Quotas and cites the AWS page; fixed limits say they cannot be raised.
- A value above a provider's hard limit (for example database storage) makes
  the change "not supported" in the Action Guard.
- Route 53 health checks in Terraform use the component's interval and
  failure threshold.

### Fixed
- **Second opinion on a new design was slow or seemed to freeze.** The model
  was asked to rewrite the whole design as operations, with no time limit and
  no limit on the answer. Now a new design is reviewed as a result and may
  only be amended (up to six operations); the answer is streamed, with a
  token count; it stops as soon as a complete answer arrives (some local
  models keep sending blank space); it is capped in length; it gives up after
  a time limit (Settings → Second opinion, default 120 s); and **Stop**
  cancels it while opinion 1 stays available.
- Clicking a flow that crosses a group border selected the group instead.

## [0.3.3] — 2026-11-05

### Fixed
- **"The design is not valid"**: the server's design schema predated DNS
  components and cross-region replication links, so every multi-region
  design was refused when saved. The schema now accepts them, and a test
  covers a multi-region design with AI components.
- When a save is refused, the project page says how many problems there are
  and shows the first; **Details** lists each one with its path in the
  design.

### Added
- **Generative AI** component (Add component → AI and ML): Amazon Bedrock,
  Azure OpenAI (AI Foundry), Vertex AI (Gemini), or vLLM / Ollama on GPU
  servers in the data centre.
- **ML platform** component: Amazon SageMaker, Azure Machine Learning,
  Vertex AI (training and endpoints), or Kubeflow + MLflow on GPU servers.
- Both are managed services with throughput quotas, disaster-recovery
  guidance, list-price estimates and platform links (secrets, keys and
  monitoring; the registry and artifacts for ML). They sit in the
  application layer and generate Terraform: a Bedrock guardrail and
  invocation logging, a SageMaker endpoint, an Azure OpenAI account and
  deployment, an Azure ML workspace, Vertex AI, and vSphere GPU VMs.

## [0.3.2] — 2026-11-05

### Changed
- **New design reads the targets from your words.** Next (or "Read it
  for me") takes availability (99.99%, "four nines"), RTO, RPO ("RTO of 4
  hours", "no data loss") and region loss from the requirement, as well as
  the facts. Each value filled in this way is marked "from your words" or
  "AI", with a confidence, and the mark disappears when you change it.
- **RTO and RPO are in hours** (0.25 = 15 minutes; any size), each with its
  plain reading underneath.
- **Layered view lines** are elbowed with rounded corners, run in the gaps
  between layers instead of over components, and hop where they cross.

### Added
- **Users are drawn as people:** a group for customers, two people for
  staff, on the canvas and in the layered view.
- **Regions on the canvas** (Layers panel, or `regions overlay`, `regions
  stacked`, `regions side by side`, `regions only a`, `regions only b`):
  one stack with region B as a stamp, region B below or beside region A, or
  one region only.
- **Data replication shown:**
  - on the canvas: database badges for the standby in another zone
    (synchronous) and for cross-region replication (synchronous or
    asynchronous), and labelled replication links when region B is drawn
    separately;
  - in the layered view: a Replication overlay with a Region B box of
    replicas;
  - in the Layers panel: a replication table with RPOs.
- **Availability zones as a layer:**
  - each component shows how its instances spread over zones a, b and c (a
    zone that is down turns red), on the canvas ("Show zones on the canvas")
    and in the layered view (Zones overlay);
  - the application, integration and data layers name their zones.
- **Console:** the input is multi-line (Enter sends, Shift+Enter adds a
  line). Your prompts and the system's replies have different colours.
- **Properties** (first item under ▾ on every component, or
  `properties DB1`): every attribute, the configuration and the simulation
  results of the component. Each value shows its source: you, AI (model and
  confidence), the rules, the requirement, or a default. Sources are
  recorded on every change from now on.

## [0.3.1] — 2026-11-05

### Added
- **＋ New design** in the canvas header, a four-step wizard:
  - **Requirement:** explain it in your own words. "Read it for me" fills in
    the name, services, peak load, personal data, events, files, internal
    users and third parties. It uses the console model when one is set up;
    otherwise it picks the facts out of the words.
  - **Resilience:** an availability target (99% to 99.999%) with the
    **expected downtime** it allows per year, month, week and day, plus
    **RTO** and **RPO**, and whether a region loss must be survived. Single
    zone, **multi-AZ**, **multi-region active-passive** and **multi-region
    active-active** are compared on availability, RTO, RPO, cost and
    trade-offs. Each shows whether it meets the targets, and the cheapest
    one that does is recommended.
  - **Layers:** network layers (ingress, secured hub, private application,
    isolated data, egress, shared services, plus their interfaces), security
    ingress and egress, application integration (APIs, queues, distributed
    events) and shared platform per component.
  - **Platform:** compute (Kubernetes, serverless functions, VMs), database
    (one region, global, distributed SQL) and messaging (managed queue,
    Kafka, broker), with trade-offs and list-price estimates at your load
    and resilience pattern.
  - **Create:** builds the design through the Action Guard with zones,
    regions, DNS failover, database replication, two instances across
    zones, platform links and the chosen products, and records an
    architecture decision.
- **Layers** panel and **layered view**:
  - the design placed in its layers, with four overlays to toggle: network
    (layers and interfaces such as internet gateway, Transit Gateway with
    the firewall, PrivateLink, NAT, Direct Connect, named per platform),
    security (ingress and egress paths and their controls, east-west
    default deny), integration (flows between services, queues and
    externals) and platform (links to shared services);
  - best-practice checks, a table of the shared platform each component
    needs (with "link the missing"), an interfaces table, and the
    availability, RTO and RPO targets with their downtime budget.

## [0.2.15] — 2026-11-05

### Added
- **New strategy, in plain words** (NEXUS Strategy → + New strategy), made
  for a business leader:
  - **Idea:** you describe the idea the way you would to the board.
  - **Overview:** the local model drafts the plan in plain language (summary,
    vision, measurable goals, simple rules) and asks what it needs to know.
  - **One step per level:** Business, People, Process, Technology, Data & AI
    and Money. Each shows what it means, **what it requires** and **what it
    depends on** (named by level). Every item can be kept or dropped, edited,
    added, or broken down with **Deeper**, and **Ask AI** revises a step.
  - **Decide:** the architect confirms the decisions for the leadership, the
    risks and the first 12 months.
  - **Create:** the plan is translated for the technology team. It fills
    Strategy on a page and the business case, adds "For your organisation"
    notes in the nine-stage Workflow and drafts the key artefacts (charter,
    vision, target state, dependency map, operating model, talent plan,
    business case, roadmap), and gets the guardrails and approved technology
    ready to hand off to NEXUS.
  - **Without a model:** the steps work by hand.
- **Several strategies per browser:** a switcher, + New strategy and Delete.
  Import adds the file as a new strategy.

## [0.2.14] — 2026-11-05

### Added
- **NEXUS Strategy** (`poc/strategy/`, in the app at **/strategy**): the
  Chief Technology Architect's workbench, a separate module that converges
  with the design workbench.
  - **Workflow:** nine stages from mandate to measurable value. At each stage,
    four lenses (Technology, Business, Financial, CxO) give the activities and
    artefacts, along with who to collaborate with, an exit gate, success
    measures, pitfalls and where the stage meets NEXUS.
  - **Collaboration:** a RACI matrix of 20 roles across the stages.
  - **Artefacts:** 52 artefacts (17 of them delivery artefacts), each with a
    template, status, owner, link and notes, plus filters.
  - **People · Process · Technology:** the delivery artefacts by impact.
  - **Business case:** TCO, NPV, ROI, payback, cumulative cash flow and
    sensitivity.
  - **Strategy on a page:** for the CxOs, with copy as Markdown and print.
  - **Hand-off to NEXUS:** principles, guardrails and the approved stack.
- **Convergence:** in the design canvas, `import strategy` adds the hand-off
  as EA principles, ground-truth rules and Technical Capabilities. It skips
  duplicates, is recorded in the AI log and can be undone. The canvas says
  when a hand-off is waiting.
- **Canvas only** (`./deploy/canvas.sh`, port 8091): the design canvas and
  the Strategy module with no landing page or sign-in, for ideation and
  quick tests. Work stays in the browser.

### Note
- Guardrails imported from a strategy join ground truth. NEXUS checks the
  rule types it already knows automatically (WAF, TLS, encryption, public
  storage, private links, DNS, dedicated circuits). New ones are listed for
  reviewers and the models until a check exists for them.

## [0.2.13] — 2026-11-03

### Added
- **Public landing page** (`landing/`, served by `deploy/landing.sh` on port
  8090): the problem, the business imperative, how it works, chaos
  engineering on the drawing board, multi-cloud, data centre and hybrid,
  Terraform and OpenTofu, LikeC4, and human-in-the-loop decisions. Sign-up
  is **Coming soon**. Screens are marked as subject to change.
- **Design, break, correct walkthrough** on the landing page, replacing the
  old hero picture. It shows users, then DNS, a CDN with the WAF at the edge, a load balancer
  across two zones, services in each zone, and a database primary with a
  synchronous standby. Zone A fails, zone B is overloaded and the database
  fails over. A correction is proposed by an agent (Auto) or made by the
  architect (Manual). The architect approves, and the zone fails again,
  this time without errors. The steps can be clicked, paused and played.
- **Lab instance**: `./deploy/buddy.sh --lab` runs a second, separate NEXUS
  for ideation, development and testing. It has no landing page (`/` goes
  straight to the projects), its own database, settings in `deploy/lab.env`
  and port 8089. Images are tagged `lab`, so it never replaces the main
  instance's images.
- **5-minute product demo** (`landing/media/nexus-demo.mp4`, captions in
  `nexus-demo.vtt`), with intro and outro pages, narrated in the am_michael
  voice. It closes with: NEXUS is coming soon; please contact me to know more.
- The landing page's closing band says NEXUS is coming soon and links to
  Contact me.
- LikeC4 export now includes a **containers view** of the system, as well as
  the system context.

### Changed
- The IaC panel says **Terraform · OpenTofu**. The generated HCL runs with
  either tool.
- `deploy/compose.yml`: image tags follow `NEXUS_IMAGE_TAG` (default
  `latest`), and the web edge reads `NEXUS_LANDING` (default `on`).

## [0.2.12] — 2026-11-01

### Added
- **Active-active database** in Add component → Data and messaging (Aurora
  DSQL on AWS, the provider's equivalent elsewhere), so it can be found by
  searching "dsql". Adding it shows its trade-offs in the Action Guard and
  records a decision for approval. It is the same as Database → Inspector →
  Multi-region → active-active.

## [0.2.11] — 2026-11-01

### Added
- **Move a component between regions** (when region B is drawn separately):
  Inspector → Network placement → Region, drag it into the other region's
  box, or `move SVC5 to region b`. Its sub-design moves with it, and its
  flows are re-labelled: cross-region when they reach the other region
  (with the latency warning), in-network when they stay inside one.
- New components land in region B when region B's box is selected (click its
  label) before adding them; otherwise in region A.

## [0.2.10] — 2026-11-01

### Fixed
- During a region outage with region B drawn separately, the failed region's
  components no longer fill the Advisor with "down" findings and zone
  advice, and no longer distort latency, the bottleneck or "safe up to"
  (which showed 942 ms and 0×). They are the scenario; the numbers now
  describe the surviving region.

## [0.2.9] — 2026-11-01

### Fixed
- A simulated zone or region outage was easy to miss (only "DOWN" at the end
  of a label) and stays saved with the design, so DNS sending 0 rps to the
  failed region looked like a routing bug. The canvas now shows a banner
  while an outage is simulated, with what DNS is doing and an "End
  simulation" button, and the DNS Inspector explains a region's zero share.

## [0.2.8] — 2026-11-01

### Added
- **Resilience patterns** (Load panel → Resilience → Resilience patterns…, or
  `pattern dc-ap`): data centre active/passive; data centre active/active
  (metro); active/active metro plus a remote DR data centre; hybrid (cloud
  workload with Direct Connect to the data centre, single zone); hybrid,
  zone-resilient; hybrid, zone plus regional pair resilient. Each card shows
  a schematic, what it survives, RPO, RTO, cost, constraints and when to
  choose it. Applying one sets zones or sites, regions or data centres
  (active-active or active-passive), DNS or GSLB steering, database
  replication, two or more instances per tier, and Direct Connect for
  on-prem systems and internal users; it goes through the Action Guard and
  records an architecture decision.
- Regions can be **active-passive** as well as active-active; a failover DNS
  policy sends all users to the primary.
- Data centre labels show sites (metro, synchronous) and the standby or
  remote data centre.

### Fixed
- DNS/GSLB and the CDN are global: a zone or site outage no longer takes them
  down.

## [0.2.7] — 2026-11-01

### Added
- **Draw region B separately** (Load panel → Resilience, or
  `draw regions separately` / `regions collapse`). Every regional component
  gets its own copy in region B with its own ID, load, bottleneck and
  findings; DNS splits users by its region share. The database follows its
  multi-region choice: Aurora DSQL gets a peered database in region B;
  Aurora Global Database gets a read-only secondary that forwards writes to
  region A and is promoted on failure; a single-region database stays in
  region A and region B reaches it across regions (with the round-trip
  latency, set by `regions rtt 70`, and inter-region transfer cost). A region
  outage fails every component of that region, and the bottleneck shown is
  in the surviving region.
- **Compare multi-region options before deciding**: the database Inspector
  compares single region, cross-region read replica, Aurora Global Database
  and Aurora DSQL by writes, RPO, RTO, strengths, constraints and when to
  choose each, with links to the AWS documentation. The summary was written
  from AWS documentation up to 2025 and could not be re-checked from this
  environment; it says so. Choosing an option goes through the Action Guard
  with its trade-offs and records an architecture decision for a lead
  architect to approve. DSQL adds a critical setting: constraints confirmed
  against current documentation.

### Fixed
- An active-active (DSQL) database is no longer reported as a single point of
  failure, and is not taken down by a zone outage.

## [0.2.6] — 2026-11-01

### Added
- **Active-active across two regions** (Load panel → Resilience → Regions, or
  `regions active-active eu-west-1 eu-central-1`). The regional stack runs in
  both regions; cost and instances count both. **Region outage**
  (`fail region a`, `restore region`): DNS moves the failed region's users only
  with health checks (and, for geolocation, a default record); the surviving
  region must then carry 100% of the traffic.
- **DNS traffic steering** component (Route 53, Traffic Manager, Cloud DNS,
  GSLB) with routing policy (geolocation, latency, weighted, failover), share
  of users per region, health checks, default record and TTL; Terraform for
  Route 53 health checks and records.
- **Multi-region databases**: none, cross-region read replica, Aurora Global
  Database (active-passive), or **Aurora DSQL** (active-active, no data loss;
  Spanner, Cosmos DB or distributed SQL on other platforms). Writes add an
  estimated cross-region commit latency; DSQL capacity is a planning limit.
- **Ground truth GT6** (internal users over Direct Connect, VPN only as
  backup) and **GT7** (internet users enter through health-checked DNS), added
  to every design and editable in the Ground Truth tab. Internal users now
  default to Direct Connect.
- **Critical settings** for DNS, Direct Connect (internal users) and
  active-active databases, and a **Critical settings report** across all
  components (Advisor → Critical settings, or `critical settings`), with
  "Copy as Markdown".
- DNS traffic steering added to the default Technical Capabilities.

## [0.2.5] — 2026-11-01

### Added
- **Zone outage simulation**: set the zones in the region (1–3) and fail one,
  in the Load panel (Resilience) or with `fail zone a` / `restore zone` /
  `zones 3`. Each component is affected by how it is deployed:
  instances spread round-robin over the zones lose their share; a single
  instance (zone a) or a component pinned by its subnet's zone goes down; a
  database fails over to its standby (1–2 minutes) or goes down without one;
  regional managed services survive; zonal ones survive only one per zone.
  A failed cache sends its reads to the database. The result says whether
  the design survives, with errors, the bottleneck, and a fix per component;
  the Inspector shows each component's zone placement.
- **Internal users**: Add component → People and outside → Internal users
  (company network), or set "Comes from" on any Users component. New flows
  use a site-to-site VPN by default. Rules: internal users enter through an
  internal load balancer or API gateway (zero trust), are flagged when routed
  over the public internet, and need workforce sign-in federated to the
  corporate directory. Their traffic is not billed as internet data transfer.

## [0.2.4] — 2026-11-01

### Added
- **Workload profile** for the Load slider and the load test, in the Load
  panel or with `workload request 4kb response 64kb reads 70% cache hit 90%`:
  - **Request and response size (KB)**: payload-heavy components (services,
    VMs, functions, gateways, load balancers, WAF, egress) lose capacity as
    payloads grow (half at about 120 KB per round trip); latency adds
    internet transfer time; the panel shows throughput in Mbps.
  - **Data transfer out** is priced per provider at tiered list prices and
    included in the cost estimate.
  - **Reads %** is the default read share for every database without its own
    value (set one in the Inspector to override it).
  - **Cache hit %** sets how many reads a cache in front of a database absorbs
    (was fixed at 80%).
  - Provider request-size limits become findings: Amazon API Gateway 10 MB,
    AWS Lambda 6 MB synchronous, Cloud Run 32 MiB.

## [0.2.3] — 2026-11-01

### Fixed
- **Building from a blank design**: adding a component was blocked by ground
  truth because the new, unwired component had no route. A change that only
  adds components is now reviewed, not blocked; connecting and removing keep
  full enforcement. This also unblocked load testing on new designs.
- The load test explains what is missing when there is no traffic (no Users
  component, or zero load) instead of doing nothing.

### Added
- **External systems**: a direct network path (VPC to VPC, same network) to an
  external system or SaaS is a technical constraint. Use private connectivity,
  a site-to-site VPN, a dedicated circuit, or the API over the internet.
- **Opinion 1** names its engine (rules with their versions, plus the
  simulator) and its confidence; an ⓘ opens the rationale with citations.
  **Opinion 2** shows the model's own confidence and how grounded its points
  were, with its rationale behind the same ⓘ. A progress gauge runs while the
  second opinion is fetched.
- **Critical configuration** per component, mapped to Well-Architected pillars,
  with provider-specific wording and "Confirm all recommended". Settings that
  already exist (replicas, standby, encryption, rate limits) are read, not
  asked twice. One advisor finding lists unconfirmed critical settings.
- **Subnets**: create from Add component → Network, or
  `create subnet app-a tier app cidr 10.0.1.0/24 zone a with SVC1 SVC2`; move
  components by dragging them into a subnet, from the Inspector, or with
  `move DB1 to data-a`. Placement is checked against tiers (a data store in a
  public subnet is critical).
- **Security groups and application groups**: drawn as coloured outlines;
  security groups are default-deny, and flows from outside the allowed
  sources become findings with a one-click fix
  (`create security group sg-db with DB1 allow from sg-app`,
  `allow sg-db from sg-app`).
- **Windows**: every dialog moves by its title and resizes; the side panel
  resizes by its left edge; the canvas stays usable while a dialog is open.

### Changed
- **Tidy** arranges the selected network segment. Click a segment's label or
  border first; selecting the outer network tidies all of its subnets, while
  internet users and third parties stay where they are.
- Legend: standard text size, no Tidy button, a toggle for groups.

## [0.2.2] — 2026-11-01

### Fixed
- The Action Guard opened as a narrow column because an older dialog width
  rule overrode it; it now uses the full width, with the two opinions side by
  side.

## [0.2.1] — 2026-11-01

### Fixed
- `deploy/buddy.sh` stopped with "command not found" when the administrator's
  name contained a space: it no longer runs `deploy/.env` as a shell script,
  and it quotes the values it writes.

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
