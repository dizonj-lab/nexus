#!/usr/bin/env bash
# Run on Buddy from the repo root: pulls the latest code and (re)starts the site.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only 2>/dev/null || true
docker compose -f deploy/compose.yml up -d --build
port="${NEXUS_PORT:-8088}"
for i in $(seq 1 20); do curl -fsS "http://127.0.0.1:$port/healthz" >/dev/null && break; sleep 1; done
curl -fsS "http://127.0.0.1:$port/version.txt" | sed 's/^/NEXUS v/'
echo "Prototype: http://$(hostname -I 2>/dev/null | awk '{print $1}'):$port/"
if curl -fsS -m 5 -H "Origin: http://$(hostname -I 2>/dev/null | awk '{print $1}'):$port" "http://127.0.0.1:$port/llm/v1/models" >/tmp/nexus-models.json 2>/dev/null; then
  echo "Model server: reachable at /llm/v1 · $(grep -o '"id":"[^"]*"' /tmp/nexus-models.json | head -5 | cut -d'"' -f4 | tr '\n' ' ')"
else
  echo "Model server: NOT reachable at /llm/v1. Set NEXUS_LLM_UPSTREAM (see deploy/compose.yml). The console falls back to rules."
fi
echo "LikeC4:    http://$(hostname -I 2>/dev/null | awk '{print $1}'):$port/c4/"
