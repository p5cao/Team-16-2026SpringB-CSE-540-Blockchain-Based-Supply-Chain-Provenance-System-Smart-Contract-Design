#!/usr/bin/env bash
# starts hardhat locally, deploys the contract, and runs the react frontend
# run ./setup-local.sh first if you haven't installed dependencies yet

set -e

root="$(cd "$(dirname "$0")" && pwd)"
blockchain_dir="$root/blockchain"
frontend_dir="$root/front-end"

# kill anything already running on 8545 so we get a clean node
if lsof -ti tcp:8545 &>/dev/null; then
  echo "port 8545 is in use, stopping it first..."
  kill "$(lsof -ti tcp:8545)" 2>/dev/null || true
  sleep 1
fi

# start the hardhat node in the background, log output to logs/
echo "starting hardhat node..."
cd "$blockchain_dir"
npx hardhat node > "$root/logs/hardhat-node.log" 2>&1 &
node_pid=$!

# wait up to 20 seconds for the node to come up
echo "waiting for node on port 8545..."
for i in $(seq 1 20); do
  if curl -s -X POST http://127.0.0.1:8545 \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
      &>/dev/null; then
    echo "node is up"
    break
  fi
  sleep 1
done

# deploy the contract and write the address to front-end/.env.local
echo "deploying contract..."
npm run deploy:local

# stop the node when the script exits (ctrl+c)
trap 'echo "stopping hardhat node..."; kill $node_pid 2>/dev/null || true' EXIT

# start the frontend
echo "starting frontend..."
cd "$frontend_dir"
npm start
