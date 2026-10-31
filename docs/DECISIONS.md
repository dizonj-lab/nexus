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
