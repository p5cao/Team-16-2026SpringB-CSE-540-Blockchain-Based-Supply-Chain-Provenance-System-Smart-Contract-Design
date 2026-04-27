#!/usr/bin/env bash
# points the frontend at the sepolia deployment and starts the react app . assumes the contract has already been deployed to sepolia

set -euo pipefail


root="$(cd "$(dirname "$0")" && pwd)"
frontend_dir="$root/front-end"
cd "$frontend_dir"

frontend_env="$frontend_dir/.env.local"

contract_address=0x685E3d760E481a684e0607b4d1792FB3a5d4DBCD

cat > "$frontend_env" <<EOF
REACT_APP_CONTRACT_ADDRESS=$contract_address
REACT_APP_RPC_URL=https://sepolia.infura.io/v3/f76af6a79d7948a7bca7ae5c9bfbaea9
REACT_APP_NETWORK=sepolia
EOF

echo "frontend is now pointed at sepolia"
echo "contract address: $contract_address"
echo "make sure metamask is connected to the sepolia network"

cd "$frontend_dir"
npm start