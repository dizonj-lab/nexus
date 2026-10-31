#!/usr/bin/env bash
# Builds the static test site into ./site (no Docker needed).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf site && mkdir -p site
npx -y likec4@1.60.0 validate architecture/likec4
npx -y likec4@1.60.0 build architecture/likec4 -o site/c4 --base /c4/ --use-hash-history --title "NEXUS architecture"
cp poc/prototype/index.html site/index.html
cp VERSION site/version.txt
echo "Site ready in ./site  (serve with: python3 -m http.server 8080 -d site)"
