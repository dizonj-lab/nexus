# NEXUS knowledge packs

What NEXUS knows about each cloud service, kept as data next to the code and
reviewed like code. Design: [docs/design/PACKS.md](../docs/design/PACKS.md).

| Folder | What |
|---|---|
| `components/` | One pack per service and provider (`aws.cdn`, `aws.dns`, `azure.obj` …): facts with default, minimum, maximum, whether it can be raised, the official source and the date checked; optional rules |
| `services/` | **Service Packs** (`sp.microservice`, `sp.kafka`): one service family to a defined standard. Besides facts and rules: `sp` (level, status, what it covers and does not, legacy checks it replaces), `policy` (organisation defaults the rules read), `integration` (allowed connections). Every rule has a rationale, basis, references and a fix (or "no automatic fix"), and a must-raise and must-not test in `tests/sp.test.mjs`. Design: [SERVICE-PACKS.md](../docs/design/SERVICE-PACKS.md) |
| `catalog/` | **Provider catalogues**: AWS's product list (from aws.amazon.com/products) joined with how NEXUS models each product and which Service Pack should own it. The ground truth for new packs; see `catalog/README.md` and `docs/design/AWS-GROUND-TRUTH.md` |
| `core/` | `core.placement`: which component may go in which subnet tier, zone and region, with pros, cons and the reason when it cannot |
| `schema/` | `pack.schema.json`, checked by `backend/tests/test_packs.py` |
| `runtime.js` | The evaluator used by the canvas and the tests: facts, placement verdicts, findings, "think" |
| `tests/` | Small designs that must, or must not, raise a finding or place a component a certain way |

## Change a pack

1. Edit the JSON. Every fact needs `source` (an official documentation URL) and
   `checked` (the date you read it). Mark anything you could not confirm with
   `"verified": false`.
2. Add or update a test in `tests/runtime.test.mjs`.
3. Inline the packs into the canvas, then run all checks (Docker only):

   ```bash
   docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -w /w node:22-slim node packs/build.mjs
   ./poc/tests/run-all.sh
   ```
4. Bump the pack's `version` (patch for a corrected number, minor for a new fact
   or rule).

Fact kinds: **quota** (provider default, adjustable on request), **limit**
(hard, cannot be raised), **setting** (you choose within min and max),
**behaviour** (how the service acts, for example typical failover time).

Provider quotas differ per account and sometimes per Region: the packs hold the
documented defaults, so check Service Quotas (or the Azure and Google Cloud
equivalents) before relying on a number.
