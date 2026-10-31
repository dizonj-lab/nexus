# NEXUS

An interactive, agentic architecture workbench. Architects design systems on a
live canvas that simulates traffic and shows bottlenecks, while an advisor checks
every change against the organisation's Technical Capabilities, Enterprise
Architecture principles and Ground Truth (standards, policy as code). Terraform
and LikeC4 are generated from the same design model.

**Version:** see [`VERSION`](VERSION) and [`CHANGELOG.md`](CHANGELOG.md).

## What is here

| Path | Contents |
| ---- | -------- |
| `poc/prototype/index.html` | Clickable single-file prototype (v0.1.0). Open it in a browser. |
| `architecture/likec4/nexus.c4` | Target architecture as a LikeC4 model |
| `architecture/diagrams/` | Rendered views: context, containers, MCP layer, what-if flow |
| `docs/` | Architecture, decisions, roadmap, current state |

## Run

```bash
# prototype
open poc/prototype/index.html        # or xdg-open on Linux

# architecture diagrams, interactive
cd architecture/likec4 && npx likec4 start
```

## Test deployment

One site: prototype at `/`, LikeC4 architecture at `/c4/`.

```bash
bash deploy/build-site.sh && python3 -m http.server 8080 -d site
```

```bash
docker build -f deploy/Dockerfile -t nexus-site . && docker run --rm -p 8080:8080 nexus-site
```

On Buddy (home LLM server, 192.168.1.93):

```bash
bash deploy/buddy.sh
```

Prototype at `http://192.168.1.93:8088/`, LikeC4 at `http://192.168.1.93:8088/c4/`.

## Versioning

Semantic Versioning. `0.x` while the work packages in `docs/ROADMAP.md` are being
built: each completed work package raises the minor version (WP1 → 0.2.0) and
fixes raise the patch. `1.0.0` is the first release teams can share and run.
Every release is a git tag `vX.Y.Z` with a `CHANGELOG.md` entry.
