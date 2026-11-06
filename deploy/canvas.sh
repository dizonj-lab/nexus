#!/usr/bin/env bash
# Run on Buddy: the NEXUS canvas without the landing page or sign-in (port 8091 by default).
# Settings in deploy/canvas.env (never committed): NEXUS_CANVAS_PORT, NEXUS_CANVAS_BIND, NEXUS_LLM_UPSTREAM.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only 2>/dev/null || true
ENV=deploy/canvas.env
[ -f "$ENV" ] || printf 'NEXUS_CANVAS_PORT=8091\nNEXUS_CANVAS_BIND=0.0.0.0\nNEXUS_LLM_UPSTREAM=http://host.docker.internal:11434\n' > "$ENV"
port="$(grep -E '^NEXUS_CANVAS_PORT=' "$ENV" | tail -1 | cut -d= -f2)"; port="${port:-8091}"
docker compose --env-file "$ENV" -f deploy/canvas.compose.yml up -d --force-recreate --remove-orphans
for i in $(seq 1 20); do curl -fsS "http://127.0.0.1:$port/healthz" >/dev/null 2>&1 && break; sleep 1; done
ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
ver="$(curl -fsS "http://127.0.0.1:$port/prototype/index.html" 2>/dev/null | grep -o 'Architecture Workbench · v[0-9.]*' | head -1 | sed 's/.*· //')"
echo "NEXUS canvas ${ver:-?} (no sign-in)  →  http://$ip:$port/   ·   Strategy  →  http://$ip:$port/strategy/"
