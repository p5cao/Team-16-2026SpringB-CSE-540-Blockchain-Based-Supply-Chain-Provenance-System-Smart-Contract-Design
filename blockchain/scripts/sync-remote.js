/**
 * After a Sepolia deployment, this script reads the deployed contract address
 * from Hardhat Ignition's output and updates REACT_APP_CONTRACT_ADDRESS in
 * front-end/.env.local, preserving all other existing variables (e.g. Infura
 * RPC URL, Pinata JWT) so they are not overwritten.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const deployedPath = resolve(
  __dirname,
  "../ignition/deployments/chain-11155111/deployed_addresses.json"
);

let addresses;
try {
  addresses = JSON.parse(readFileSync(deployedPath, "utf8"));
} catch {
  console.error("Could not read deployed_addresses.json — did you run deploy:sepolia first?");
  process.exit(1);
}

const address = addresses["SupplyChainProvenanceModule#SupplyChainProvenance"];
if (!address) {
  console.error("Contract address not found in deployed_addresses.json");
  process.exit(1);
}

const envPath = resolve(__dirname, "../../front-end/.env.local");

// Read existing .env.local and update only REACT_APP_CONTRACT_ADDRESS,
// keeping all other lines (RPC URL, Pinata JWT, etc.) intact.
let lines = [];
if (existsSync(envPath)) {
  lines = readFileSync(envPath, "utf8").split("\n");
}

const key = "REACT_APP_CONTRACT_ADDRESS";
const newLine = `${key}=${address}`;
const idx = lines.findIndex((l) => l.startsWith(key + "="));

if (idx >= 0) {
  lines[idx] = newLine;
} else {
  lines.unshift(newLine);
}

writeFileSync(envPath, lines.join("\n"));
console.log(`Updated front-end/.env.local`);
console.log(`  REACT_APP_CONTRACT_ADDRESS=${address}`);
