#!/usr/bin/env bash
# removes node_modules and does a fresh npm install in blockchain/ and front-end/
# run this once when setting up, or when package.json changes

set -e

root="$(cd "$(dirname "$0")" && pwd)"

reinstall() {
  local dir="$1"
  local label="$2"

  echo "[$label] removing node_modules..."
  rm -rf "$dir/node_modules"

  echo "[$label] installing..."
  cd "$dir"
  npm install
  echo "[$label] done"
  echo ""
}

reinstall "$root/blockchain" "blockchain"
reinstall "$root/front-end" "front-end"

echo "all done -- run ./start-local.sh to start the dev environment"
