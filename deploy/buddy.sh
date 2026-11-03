#!/usr/bin/env bash
# Run on Buddy from anywhere: pulls the latest code and (re)starts NEXUS.
# First run creates deploy/.env with random secrets and asks for the first administrator.
#   ./deploy/buddy.sh         the main instance (landing page, port 8088)
#   ./deploy/buddy.sh --lab   the lab instance for ideation, development and testing: no landing page,
#                             its own database, settings in deploy/lab.env, port 8089. Run it from a second
#                             checkout (e.g. ~/nexus-lab on another branch) to try changes before main.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only 2>/dev/null || true
LAB=false; [ "${1:-}" = "--lab" ] && LAB=true
if $LAB; then ENV=deploy/lab.env; PROJECT=nexus-lab; PORT0=8089; else ENV=deploy/.env; PROJECT=nexus; PORT0=8088; fi
rnd() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
if [ ! -f "$ENV" ]; then
  echo "First run: creating $ENV"
  read -rp "Administrator email: " admin_email
  read -rp "Administrator name: " admin_name
  admin_pw="Nx-$(rnd 6)-$(rnd 6)-7a"
  umask 077
  cat > "$ENV" <<CONF
POSTGRES_PASSWORD=$(rnd 32)
NEXUS_SECRET_KEY=$(rnd 64)
NEXUS_ADMIN_EMAIL="$admin_email"
NEXUS_ADMIN_PASSWORD="$admin_pw"
NEXUS_ADMIN_NAME="$admin_name"
NEXUS_PORT=$PORT0
NEXUS_BIND=0.0.0.0
NEXUS_COOKIE_SECURE=false
NEXUS_LLM_UPSTREAM=http://host.docker.internal:11434
NEXUS_SLM_MODEL=qwen2.5:7b-instruct
NEXUS_LLM_MODEL=gpt-oss:latest
CONF
  if $LAB; then printf 'NEXUS_LANDING=off\nNEXUS_IMAGE_TAG=lab\n' >> "$ENV"; fi
  echo "First administrator: $admin_email  password: $admin_pw"
  echo "Sign in and change it under your name (top right). It is also in $ENV until you remove that line."
fi
# Read single settings without executing the file (values may contain spaces).
setting() { grep -E "^$1=" "$ENV" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
docker compose -p "$PROJECT" --env-file "$ENV" -f deploy/compose.yml up -d --build --remove-orphans
port="$(setting NEXUS_PORT)"; port="${port:-$PORT0}"
for i in $(seq 1 60); do curl -fsS "http://127.0.0.1:$port/api/healthz" >/dev/null 2>&1 && break; sleep 2; done
ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
$LAB && echo "Lab instance (no landing page, separate database)"
echo "NEXUS v$(curl -fsS "http://127.0.0.1:$port/version.txt")  →  http://$ip:$port/"
curl -fsS "http://127.0.0.1:$port/api/healthz" >/dev/null && echo "API: ok" || echo "API: not answering yet (docker compose -p $PROJECT -f deploy/compose.yml logs backend)"
if docker compose -p "$PROJECT" --env-file "$ENV" -f deploy/compose.yml exec -T backend python -c "
import httpx,os;r=httpx.get(os.environ['NEXUS_LLM_BASE_URL']+'/models',timeout=5);print(' '.join(m['id'] for m in r.json()['data'][:6]))" 2>/dev/null; then
  echo "Model server: reachable from the agents"
else
  echo "Model server: NOT reachable. Set NEXUS_LLM_UPSTREAM in $ENV. Agents will report the model as unreachable."
fi
echo "Agent evals: docker compose -p $PROJECT -f deploy/compose.yml exec backend python -m app.harness.evals"
