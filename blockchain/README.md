# Blockchain Folder Overview

This folder contains the full smart contract workspace for the project. It is built with **Hardhat 3** and manages everything related to contract development: contract code, deployment, and tests.

## What this folder is responsible for

- Defining the on-chain business logic for supply-chain provenance.
- Compiling Solidity contracts.
- Deploying contracts locally and to Sepolia.
- Running automated tests for role access and lifecycle transitions.
- Syncing local deployed contract address to the front-end app.

## Folder structure

### contracts/
- Contains Solidity contracts.
- Main contract: `SupplyChainProvenance.sol`.
- This contract defines:
	- Roles (`Producer`, `Distributor`, `Retailer`, `Consumer`, etc.)
	- Product states (`InProduction`, `InWarehouse`, `InStore`, `Sold`, etc.)
	- Functions for role assignment, product creation, shipping, retailer/store actions, and purchase.

### ignition/modules/
- Hardhat Ignition deployment module(s).
- `SupplyChainProvenance.js` tells Ignition how to deploy the `SupplyChainProvenance` contract.

### scripts/
- Utility scripts for non-test workflows.
- `send-op-tx.ts`: sample transaction script for OP-style chain type testing.
- `sync-local.js`: reads local deployment output and writes `front-end/.env.local` with:
	- `REACT_APP_CONTRACT_ADDRESS`
	- `REACT_APP_RPC_URL`

### test/
- Mocha/Chai tests for contract behavior.
- `SupplyChainProvenance.ts` validates:
	- Admin role setup and role assignment
	- Producer product creation
	- Distributor receiving / quality / warehouse flow
	- Retailer in-store flow
	- Consumer purchase and negative cases

## Configuration files

### package.json
- Declares dependencies and scripts:
	- `npm run compile`
	- `npm test`
	- `npm run deploy:local`
	- `npm run deploy:sepolia`

### hardhat.config.js
- Sets Solidity version (`0.8.28`).
- Configures networks:
	- `localhost` (for local node)
	- `sepolia` (via RPC URL + private key from `.env`)

### tsconfig.json
- TypeScript config for tests/scripts in this folder.

## Typical development flow

1. Implement or update contract code in `contracts/`.
2. Compile:
	 - `npm run compile`
3. Run tests:
	 - `npm test`
4. Deploy locally:
	 - `npm run deploy:local`
5. Start front-end and use auto-synced contract address from `front-end/.env.local`.

## How this connects to the whole project

- This `blockchain/` folder is the source of truth for on-chain logic.
- The `front-end/` reads the deployed contract address (written by `sync-local.js`) and then calls contract functions.
- If contract ABI or function signatures change, front-end integration should be updated accordingly.

