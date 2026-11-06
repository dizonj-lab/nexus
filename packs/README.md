# NEXUS knowledge packs

What NEXUS knows about each cloud service, kept as data next to the code and
reviewed like code. Design: [docs/design/PACKS.md](../docs/design/PACKS.md).

| Folder | What |
|---|---|
| `components/` | One pack per service and provider (`aws.cdn`, `aws.dns`, `azure.obj` …): facts with default, minimum, maximum, whether it can be raised, the official source and the date checked; optional rules |
| `core/` | `core.placement`: which component may go in which subnet tier, zone and region, with pros, cons and the reason when it cannot |
| `schema/` | `pack.schema.json`, checked by `backend/tests/test_packs.py` |
| `runtime.js` | The evaluator used by the canvas and the tests: facts, placement verdicts, findings, "think" |
| `tests/` | Small designs that must, or must not, raise a finding or place a component a certain way |

## Change a pack

1. Edit the JSON. Every fact needs `source` (an official documentation URL) and
   `checked` (the date you read it). Mark anything you could not confirm with
   `"verified": false`.
2. Add or update a test in `tests/runtime.test.mjs`.
3. Run `node packs/build.mjs` to inline the packs into the canvas, then
   `node --test packs/tests/*.test.mjs` and `pytest backend/tests/test_packs.py`.
4. Bump the pack's `version` (patch for a corrected number, minor for a new fact
   or rule).

Fact kinds: **quota** (provider default, adjustable on request), **limit**
(hard, cannot be raised), **setting** (you choose within min and max),
**behaviour** (how the service acts, for example typical failover time).

Provider quotas differ per account and sometimes per Region: the packs hold the
documented defaults, so check Service Quotas (or the Azure and Google Cloud
equivalents) before relying on a number.
