// This is the web3 contract setup for the supply chain project

import { Web3 as Web3Class } from 'web3';
import web3 from "./web3";

// Contract address — set REACT_APP_CONTRACT_ADDRESS in .env.local for local dev
// or in .env for production (Sepolia). Falls back to the last known Sepolia address.
export const CONTRACT_ADDRESS =
  process.env.REACT_APP_CONTRACT_ADDRESS ||
  "0xE40395b469F6E5b95E4bE18aC475C2aE40a4EA97";

// ABI generated from blockchain/artifacts/contracts/SupplyChainProvenance.sol/SupplyChainProvenance.json
export const CONTRACT_ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "producer", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "ProductCreated", "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }
    ],
    "name": "ProductOwnershipTransferred", "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "indexed": false, "internalType": "enum SupplyChainProvenance.ProductStatus", "name": "newStatus", "type": "uint8" },
      { "indexed": true, "internalType": "address", "name": "updatedBy", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "ProductStatusChanged", "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "enum SupplyChainProvenance.Role", "name": "role", "type": "uint8" }
    ],
    "name": "RoleAssigned", "type": "event"
  },
  {
    "inputs": [],
    "name": "admin",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "enum SupplyChainProvenance.Role", "name": "role", "type": "uint8" }
    ],
    "name": "assignRole", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "uint256", "name": "producerBatchId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" },
      { "internalType": "uint256", "name": "expirationDate", "type": "uint256" }
    ],
    "name": "createProduct", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "prodId", "type": "uint256" }],
    "name": "getProduct",
    "outputs": [{
      "components": [
        { "internalType": "uint256", "name": "prodId", "type": "uint256" },
        { "internalType": "address", "name": "producer", "type": "address" },
        { "internalType": "uint256", "name": "producerBatchId", "type": "uint256" },
        { "internalType": "string", "name": "ipfsHash", "type": "string" },
        { "internalType": "uint256", "name": "expirationDate", "type": "uint256" },
        { "internalType": "uint256", "name": "currentBatchId", "type": "uint256" },
        { "internalType": "enum SupplyChainProvenance.ProductStatus", "name": "currentStatus", "type": "uint8" },
        { "internalType": "address", "name": "currentOwner", "type": "address" },
        { "internalType": "uint256", "name": "parentBatchId", "type": "uint256" }
      ],
      "internalType": "struct SupplyChainProvenance.Product", "name": "", "type": "tuple"
    }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "markReadyToShip", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "productLedger",
    "outputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "address", "name": "producer", "type": "address" },
      { "internalType": "uint256", "name": "producerBatchId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" },
      { "internalType": "uint256", "name": "expirationDate", "type": "uint256" },
      { "internalType": "uint256", "name": "currentBatchId", "type": "uint256" },
      { "internalType": "enum SupplyChainProvenance.ProductStatus", "name": "currentStatus", "type": "uint8" },
      { "internalType": "address", "name": "currentOwner", "type": "address" },
      { "internalType": "uint256", "name": "parentBatchId", "type": "uint256" }
    ],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "passWarehouseQualityCheck", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "placeInStore", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "purchaseProduct", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "receiveAtWarehouse", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "receiveReturnedFromRetailer", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "retailerReceiveProduct", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "rolesMapping",
    "outputs": [{ "internalType": "enum SupplyChainProvenance.Role", "name": "", "type": "uint8" }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "address", "name": "distributor", "type": "address" }
    ],
    "name": "shipToDistributor", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "address", "name": "retailer", "type": "address" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "shipToRetailer", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "storeInWarehouse", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "returnToWarehouse", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "prodId", "type": "uint256" }],
    "name": "verifyProduct",
    "outputs": [{
      "components": [
        { "internalType": "uint256", "name": "prodId", "type": "uint256" },
        { "internalType": "address", "name": "producer", "type": "address" },
        { "internalType": "uint256", "name": "producerBatchId", "type": "uint256" },
        { "internalType": "string", "name": "ipfsHash", "type": "string" },
        { "internalType": "uint256", "name": "expirationDate", "type": "uint256" },
        { "internalType": "uint256", "name": "currentBatchId", "type": "uint256" },
        { "internalType": "enum SupplyChainProvenance.ProductStatus", "name": "currentStatus", "type": "uint8" },
        { "internalType": "address", "name": "currentOwner", "type": "address" },
        { "internalType": "uint256", "name": "parentBatchId", "type": "uint256" }
      ],
      "internalType": "struct SupplyChainProvenance.Product", "name": "", "type": "tuple"
    }],
    "stateMutability": "view", "type": "function"
  }
];

// Role mapping, not perfect but works
export const ROLES = {
  1: "Producer",
  2: "Consumer",
  3: "Distributor",
  4: "Retailer",
  5: "Admin"
};


// Product status codes, just for UI
export const PRODUCT_STATUSES = {
  0: "In Production",
  1: "Ready to Ship",
  2: "In Transit to Warehouse",
  3: "Shipped to Warehouse",
  4: "WH Quality Check Passed",
  5: "Returned to Producer",
  6: "In Warehouse",
  7: "In Transit to Retailer",
  8: "Shipped to Retailer",
  9: "Retailer Quality Check Passed",
  10: "Retailer Returned to Warehouse",
  11: "In Store",
  12: "Sold"
};


// Helper to switch to Sepolia testnet
export async function switchToSepolia() {
  // Not handling errors here, just a quick helper
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }],
  });
}

// The contract instance (uses MetaMask provider — for write transactions)
const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
export default contract;

// Read-only contract instance backed by the Infura RPC URL.
// This bypasses MetaMask's current network state and always reads from Sepolia,
// preventing race conditions where a call fires before the network switch completes.
const RPC_URL =
  process.env.REACT_APP_RPC_URL ||
  'https://sepolia.infura.io/v3/f76af6a79d7948a7bca7ae5c9bfbaea9';
const readWeb3 = new Web3Class(RPC_URL);
export const readContract = new readWeb3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
