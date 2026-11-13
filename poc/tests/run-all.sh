#!/usr/bin/env bash
# Runs every automated check for the canvas and the knowledge packs.
#   ./poc/tests/run-all.sh            (from the repository root)
# Everything runs inside the official Playwright container (Node, Chromium): only Docker is needed on the host.
set -uo pipefail
cd "$(dirname "$0")/../.."
PW_VERSION=1.55.0
if [ -z "${NEXUS_IN_CONTAINER:-}" ]; then
  command -v docker >/dev/null || { echo "Docker is required."; exit 1; }
  extra=()
  for v in HTTPS_PROXY HTTP_PROXY NO_PROXY https_proxy http_proxy no_proxy; do [ -n "${!v:-}" ] && extra+=(-e "$v"); done
  ca="${NODE_EXTRA_CA_CERTS:-}"; [ -f "$ca" ] || ca=""; [ -n "$ca" ] && extra+=(-v "$ca:/etc/nexus-ca.crt:ro" -e NODE_EXTRA_CA_CERTS=/etc/nexus-ca.crt -e npm_config_cafile=/etc/nexus-ca.crt)
  echo "== backend tests (python:3.11-slim)"
  docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -e PIP_DISABLE_PIP_VERSION_CHECK=1 "${extra[@]}" ${ca:+-e PIP_CERT=/etc/nexus-ca.crt -e SSL_CERT_FILE=/etc/nexus-ca.crt} \
    -v "$PWD":/work -w /work/backend python:3.11-slim bash -c 'set -o pipefail; python -m venv /tmp/v && /tmp/v/bin/pip install -q -e ".[dev]" && /tmp/v/bin/python -m pytest -q -p no:cacheprovider 2>&1 | tail -1' || backend_fail=1
  rm -rf backend/*.egg-info 2>/dev/null
  export BACKEND_FAIL="${backend_fail:-}"
  echo "== canvas and packs (mcr.microsoft.com/playwright:v$PW_VERSION-noble)"
  exec docker run --rm --init --ipc=host -e BACKEND_FAIL -u "$(id -u):$(id -g)" -e HOME=/tmp -e NEXUS_IN_CONTAINER=1 -e npm_config_update_notifier=false "${extra[@]}" \
    -v "$PWD":/work -w /work "mcr.microsoft.com/playwright:v$PW_VERSION-noble" ./poc/tests/run-all.sh
fi
# The Playwright library is cached in poc/tests/.pw (ignored by git); the browsers come with the image.
PW=poc/tests/.pw; export NODE_PATH="$PWD/$PW/node_modules"
if ! node -e "require('playwright')" >/dev/null 2>&1; then
  echo "Installing playwright@$PW_VERSION into $PW (first run only)"
  npm install --no-save --no-audit --no-fund --loglevel=error --prefix "$PW" "playwright@$PW_VERSION" || { echo "could not install playwright"; exit 1; }
fi
fail=0
echo "== version labels match VERSION"
v="$(cat VERSION)"
for f in frontend/package.json backend/app/main.py frontend/app/page.tsx poc/prototype/index.html; do
  grep -q "$v" "$f" || { echo "$f does not say $v"; fail=1; }
done
grep -o 'Architecture Workbench · v[0-9.]*' poc/prototype/index.html | grep -qx "Architecture Workbench · v$v" || { echo "canvas label is not v$v"; fail=1; }
echo "== packs: build check and unit tests"
node packs/build.mjs --check || fail=1
out="$(node --test packs/tests/*.test.mjs 2>&1)" || fail=1
echo "$out" | grep -E "^# (pass|fail)"
echo "== browser checks (simulated model server on :18080, canvas on :18081)"
node poc/tests/mock-llm.mjs 18080 >/tmp/nexus-mock-llm.log 2>&1 & M=$!
node poc/tests/serve.mjs 18081 >/dev/null 2>&1 & H=$!
trap 'kill $M $H 2>/dev/null' EXIT
sleep 1
for t in second-opinion placement reconnect properties dns settings flows messaging disruption blank sp-microservice sp-kafka workbench regions edit; do
  echo "-- $t"; node "poc/tests/$t.e2e.mjs" || fail=1
done
[ -n "${BACKEND_FAIL:-}" ] && { echo "backend tests failed (see above)"; fail=1; }
[ $fail = 0 ] && echo "ALL PASSED" || { echo "SOME CHECKS FAILED"; exit 1; }
