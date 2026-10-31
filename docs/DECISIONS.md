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
