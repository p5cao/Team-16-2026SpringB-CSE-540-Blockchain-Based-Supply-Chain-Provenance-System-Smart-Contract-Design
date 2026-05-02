import React, { useState, useEffect, useCallback } from 'react';
import contract, { ROLES, switchToSepolia } from './contract';
import Header from './components/Header';
import ProducerTab from './components/ProducerTab';
import DistributorTab from './components/DistributorTab';
import RetailerTab from './components/RetailerTab';
import ConsumerTab from './components/ConsumerTab';
import AdminTab from './components/AdminTab';

const TABS = [
  { id: 'producer',    label: 'Producer',    icon: '🏭' },
  { id: 'distributor', label: 'Distributor',  icon: '🏬' },
  { id: 'retailer',    label: 'Retailer',     icon: '🛍️' },
  { id: 'consumer',    label: 'Consumer',     icon: '🔍' },
  { id: 'admin',       label: 'Admin',        icon: '🔐' },
];

function App() {
  const [account, setAccount]       = useState('');
  const [role, setRole]             = useState(0);
  const [adminAddress, setAdmin]    = useState('');
  const [activeTab, setActiveTab]   = useState('producer');


  // Loads account data from contract
  const loadAccountData = useCallback(async function(addr) {
    try {
      // Not using destructuring for clarity
      const arr = await Promise.all([
        contract.methods.rolesMapping(addr).call(),
        contract.methods.admin().call()
      ]);
      setRole(Number(arr[0]));
      setAdmin(arr[1]);
    } catch (e) {
      // Sometimes contract is not reachable
    }
  }, []);

  // Connects to MetaMask wallet
  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install it to use this app.");
      return;
    }
    try {
      await switchToSepolia();
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      await loadAccountData(accounts[0]);
    } catch (err) {
      // Not perfect error handling
      console.log("Wallet connection failed:", err);
    }
  }

  // Try to auto-connect if already authorized
  useEffect(() => {
    async function autoConnect() {
      if (!window.ethereum) return;
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        await loadAccountData(accounts[0]);
      }
    }
    autoConnect();
  
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", async function(accounts) {
        let addr = accounts[0] || "";
        setAccount(addr);
        if (addr) {
          await loadAccountData(addr);
        } else {
          setRole(0);
          setAdmin("");
        }
      });
    }
  }, [loadAccountData]);

  // Get label for role
  let roleLabel = ROLES[role];
  if (!roleLabel) roleLabel = "Unknown";

  // Shows a badge if the tab matches the user's role
  function getTabBadge(tabId) {
    let match = false;
    if (tabId === "producer" && role === 1) match = true;
    if (tabId === "distributor" && role === 3) match = true;
    if (tabId === "retailer" && role === 4) match = true;
    if (tabId === "consumer" && role === 2) match = true;
    if (tabId === "admin" && role === 5) match = true;
    return account && match;
  }

  // Main render
  return (
    <div>
      {/* Header bar */}
      <Header
        account={account}
        role={role}
        adminAddress={adminAddress}
        onConnect={connectWallet}
      />
  
      {/* Navigation tabs */}
      <ul className="nav nav-tabs border-bottom px-3 bg-light">
        {TABS.map(function(tab) {
          return (
            <li className="nav-item" key={tab.id}>
              <button
                className={"nav-link " + (activeTab === tab.id ? "active" : "text-secondary")}
                onClick={function() { setActiveTab(tab.id); }}
              >
                {tab.icon} {tab.label}
                {getTabBadge(tab.id) ? (
                  <span className="badge bg-primary ms-1" title="Your role">●</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
  
      {/* Tab content */}
      <div className="container py-4">
        {activeTab === "producer" ? <ProducerTab account={account} role={role} /> : null}
        {activeTab === "distributor" ? <DistributorTab account={account} role={role} /> : null}
        {activeTab === "retailer" ? <RetailerTab account={account} role={role} /> : null}
        {activeTab === "consumer" ? <ConsumerTab account={account} role={role} /> : null}
        {activeTab === "admin" ? <AdminTab account={account} role={role} adminAddress={adminAddress} /> : null}
      </div>
  
      {/* Footer */}
      <footer className="border-top text-center text-muted py-3 small">
        Supply Chain Provenance &middot; Sepolia Testnet &nbsp;·&nbsp;
        Contract:{" "}
        <a
          href="https://sepolia.etherscan.io/address/0xf68F4A5aaE2F444aA43111004CE56f1261C1234f"
          target="_blank"
          rel="noreferrer"
        >
          
        </a>
      </footer>
    </div>
  );
}

export default App;
