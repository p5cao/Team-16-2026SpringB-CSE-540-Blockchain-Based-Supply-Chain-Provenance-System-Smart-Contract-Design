#!/usr/bin/env bash
# start-local.sh
# Starts a local Hardhat node, deploys the contract, syncs the address to
# front-end/.env.local, and launches the React dev server.
#
# Usage: ./start-local.sh
#
# Requirements: Node.js + npm installed, dependencies already installed in
#   ./blockchain and ./front-end (run `npm install` in each once).

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BLOCKCHAIN="$ROOT/blockchain"
FRONTEND="$ROOT/front-end"

# ── 1. Kill any existing process on port 8545 ────────────────────────────────
echo "→ Checking port 8545..."
if lsof -ti tcp:8545 &>/dev/null; then
  echo "  Port 8545 in use — killing existing process..."
  kill "$(lsof -ti tcp:8545)" 2>/dev/null || true
  sleep 1
fi

# ── 2. Start Hardhat node in the background ───────────────────────────────────
echo "→ Starting Hardhat local node..."
cd "$BLOCKCHAIN"
npx hardhat node > "$ROOT/logs/hardhat-node.log" 2>&1 &
HARDHAT_PID=$!
echo "  Hardhat node PID: $HARDHAT_PID"

# Wait for node to be ready
echo "  Waiting for node to be ready..."
for i in $(seq 1 20); do
  if curl -s -X POST http://127.0.0.1:8545 \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
      &>/dev/null; then
    echo "  Node is ready."
    break
  fi
  sleep 1
done

# ── 3. Deploy contract and sync address to front-end ─────────────────────────
echo "→ Deploying contract to localhost..."
npm run deploy:local

# ── 4. Start React front-end ─────────────────────────────────────────────────
echo "→ Starting React front-end..."
cd "$FRONTEND"
npm start

# ── Cleanup on exit ──────────────────────────────────────────────────────────
trap 'echo "→ Stopping Hardhat node..."; kill $HARDHAT_PID 2>/dev/null || true' EXIT
