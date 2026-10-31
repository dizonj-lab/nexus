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
echo "LikeC4:    http://$(hostname -I 2>/dev/null | awk '{print $1}'):$port/c4/"
