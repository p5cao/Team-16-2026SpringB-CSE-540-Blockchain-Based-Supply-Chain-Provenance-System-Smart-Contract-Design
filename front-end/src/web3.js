// Web3 setup for the app
import { Web3 } from "web3";

// You can use Infura or MetaMask, here we just use whatever is injected
// const web3 = new Web3("https://sepolia.infura.io/v3/f76af6a79d7948a7bca7ae5c9bfbaea9");
const web3 = new Web3(window.ethereum);

// Export the instance
export default web3;
