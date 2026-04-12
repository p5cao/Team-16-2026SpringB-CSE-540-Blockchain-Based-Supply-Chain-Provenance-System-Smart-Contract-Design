// This is the web3 contract setup for the supply chain project
import web3 from "./web3";

// Contract address (hardcoded for now)
export const CONTRACT_ADDRESS = "0x685E3d760E481a684e0607b4d1792FB3a5d4DBCD";

// ABI for the contract, copy-pasted from compilation output
export const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "admin",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "enum SupplyChainProvenance.Role", "name": "role", "type": "uint8" }
    ],
    "name": "assignRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "createProduct",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prodId", "type": "uint256" },
      { "internalType": "string", "name": "ipfsHash", "type": "string" }
    ],
    "name": "produce",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
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
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "rolesMapping",
    "outputs": [{ "internalType": "enum SupplyChainProvenance.Role", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
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

// The contract instance
const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
export default contract;
