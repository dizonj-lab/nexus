#!/usr/bin/env bash
# Run on Buddy: pulls the latest code and (re)starts the public landing page (port 8090 by default).
# Optional settings in deploy/landing.env (never committed): NEXUS_SITE_PORT, NEXUS_SITE_BIND.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only 2>/dev/null || true
ENV=deploy/landing.env; [ -f "$ENV" ] || printf 'NEXUS_SITE_PORT=8090\nNEXUS_SITE_BIND=0.0.0.0\n' > "$ENV"
port="$(grep -E '^NEXUS_SITE_PORT=' "$ENV" | tail -1 | cut -d= -f2)"; port="${port:-8090}"
docker compose --env-file "$ENV" -f deploy/landing.compose.yml up -d --remove-orphans
for i in $(seq 1 20); do curl -fsS "http://127.0.0.1:$port/healthz" >/dev/null 2>&1 && break; sleep 1; done
ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "NEXUS landing page  →  http://$ip:$port/"
[ -f landing/media/nexus-demo.mp4 ] && echo "Demo video: published" || echo "Demo video: not found (landing/media/nexus-demo.mp4); the page says it is coming soon"
