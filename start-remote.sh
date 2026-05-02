#!/usr/bin/env bash
# Deploys the contract to Sepolia, runs tests, updates frontend, and starts the React app

set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
blockchain_dir="$root/blockchain"
frontend_dir="$root/front-end"
backend_dir="$root/back-end"
frontend_env="$frontend_dir/.env.local"

# Deploy contract to Sepolia and sync frontend config
cd "$blockchain_dir"
echo "Deploying contract to Sepolia..."
echo "yes" | npm run deploy:sepolia

# Extract contract address (written by sync-remote.js)
contract_address=$(jq -r '."SupplyChainProvenanceModule#SupplyChainProvenance"' "$blockchain_dir/ignition/deployments/chain-11155111/deployed_addresses.json")
if [[ -z "$contract_address" || "$contract_address" == "null" ]]; then
	echo "Failed to extract contract address from deployment output."
	exit 1
fi

# Run tests
echo "Running tests..."
npm test

echo "frontend is now pointed at sepolia"
echo "contract address: $contract_address"
echo "make sure metamask is connected to the sepolia network"

# Start backend in background
echo "Starting backend..."
cd "$backend_dir"
npm start &
backend_pid=$!
echo "Backend started (PID $backend_pid)"
cd "$root"

# Start frontend in background
cd "$frontend_dir"
npm start &
frontend_pid=$!
cd "$root"

# Trap script exit and kill both
trap "echo 'Stopping backend (PID $backend_pid) and frontend (PID $frontend_pid)...'; kill $backend_pid $frontend_pid 2>/dev/null; exit" SIGINT SIGTERM

# Wait for both to exit
wait $backend_pid $frontend_pid