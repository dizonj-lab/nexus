#!/usr/bin/env bash
# Runs every automated check for the canvas and the knowledge packs.
#   ./poc/tests/run-all.sh            (from the repository root)
# Needs Node 22 and Playwright with Chromium; Python 3 for the static server.
set -uo pipefail
cd "$(dirname "$0")/../.."
fail=0
echo "== packs: build check and unit tests"
node packs/build.mjs --check || fail=1
node --test packs/tests/*.test.mjs 2>&1 | grep -E "^# (pass|fail)" ; node --test packs/tests/*.test.mjs >/dev/null 2>&1 || fail=1
echo "== browser checks (simulated model server on :18080, canvas on :18081)"
node poc/tests/mock-llm.mjs 18080 >/tmp/nexus-mock-llm.log 2>&1 & M=$!
(cd poc && python3 -m http.server 18081 >/dev/null 2>&1) & H=$!
trap 'kill $M $H 2>/dev/null' EXIT
sleep 1
for t in second-opinion placement reconnect properties dns; do
  echo "-- $t"; node "poc/tests/$t.e2e.mjs" || fail=1
done
[ $fail = 0 ] && echo "ALL PASSED" || { echo "SOME CHECKS FAILED"; exit 1; }
