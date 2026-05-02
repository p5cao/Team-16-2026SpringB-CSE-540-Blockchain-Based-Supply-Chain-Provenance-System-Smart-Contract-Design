// Web3 setup for the app
import { Web3 } from "web3";

// Prefer injected wallet provider when available; otherwise allow read-only RPC.
const FALLBACK_RPC =
  process.env.REACT_APP_SEPOLIA_RPC_URL || "https://rpc.sepolia.org";

const provider =
  typeof window !== "undefined" && window.ethereum
    ? window.ethereum
    : FALLBACK_RPC;

const web3 = new Web3(provider);

export default web3;
