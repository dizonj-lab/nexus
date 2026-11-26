#!/usr/bin/env bash
# Run on Buddy: the ML Algorithm Atlas on port 8095 (override with NEXUS_ATLAS_PORT in deploy/atlas.env).
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only 2>/dev/null || true
ENV=deploy/atlas.env
[ -f "$ENV" ] || printf 'NEXUS_ATLAS_PORT=8095\nNEXUS_ATLAS_BIND=0.0.0.0\n' > "$ENV"
port="$(grep -E '^NEXUS_ATLAS_PORT=' "$ENV" | tail -1 | cut -d= -f2)"; port="${port:-8095}"
docker compose --env-file "$ENV" -f deploy/atlas.compose.yml up -d --force-recreate --remove-orphans
for i in $(seq 1 20); do curl -fsS "http://127.0.0.1:$port/healthz" >/dev/null 2>&1 && break; sleep 1; done
ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "ML Algorithm Atlas  →  http://$ip:$port/"
