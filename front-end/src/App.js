import React, { useState, useEffect, useCallback } from 'react';
import contract, { ROLES, PRODUCT_STATUSES, switchToSepolia } from './contract';
import Header from './components/Header';
import ProducerTab from './components/ProducerTab';
import DistributorTab from './components/DistributorTab';
import RetailerTab from './components/RetailerTab';
import ConsumerTab from './components/ConsumerTab';
import AdminTab from './components/AdminTab';
import ProductDetailModal from './components/ProductDetailModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const STATUS_BADGE = {
  0: 'bg-secondary', 1: 'bg-primary', 2: 'bg-info text-dark',
  3: 'bg-info text-dark', 4: 'bg-success', 5: 'bg-warning text-dark',
  6: 'bg-success', 7: 'bg-info text-dark', 8: 'bg-info text-dark',
  9: 'bg-success', 10: 'bg-warning text-dark', 11: 'bg-primary', 12: 'bg-dark',
};

function MyProductsTable({ account, role }) {
  const [products, setProducts]         = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [selectedProdId, setSelectedProdId] = useState(null);

  const isAdmin = role === 5;

  const load = useCallback(() => {
    if (!account) return;
    setLoading(true);
    setError('');
    const url = isAdmin
      ? `${BACKEND_URL}/api/products?limit=100`
      : `${BACKEND_URL}/api/users/${account}/products`;
    fetch(url)
      .then(r => r.json())
      .then(data => setProducts(data.products || []))
      .catch(() => setError('Could not load products from backend.'))
      .finally(() => setLoading(false));
  }, [account, isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!account) return null;

  return (
    <div className="container pt-4 pb-0">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0 fw-semibold">
          {isAdmin ? '📦 All Products' : '📦 My Products'}
        </h6>
        <button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
      {error && <div className="alert alert-warning py-2 small">{error}</div>}
      {!loading && products.length === 0 && !error && (
        <p className="text-muted small">No products found. Register a batch to get started.</p>
      )}
      {products.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm table-hover table-bordered align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Batch ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Owner Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const statusNum = p.current_status;
                const statusLabel = PRODUCT_STATUSES[statusNum] || statusNum;
                const badgeCls = STATUS_BADGE[statusNum] || 'bg-secondary';
                const ownerRole = p.owner_role_name || 'Unregistered';
                return (
                  <tr key={p.prod_id}>
                    <td><strong>#{p.prod_id}</strong></td>
                    <td>{p.name || <span className="text-muted fst-italic">—</span>}</td>
                    <td><span className={`badge ${badgeCls}`}>{statusLabel}</span></td>
                    <td><code className="small">{p.current_owner ? `${p.current_owner.slice(0,6)}…${p.current_owner.slice(-4)}` : '—'}</code></td>
                    <td><span className="badge bg-light text-dark border">{ownerRole}</span></td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-primary py-0 px-2"
                        onClick={function() { setSelectedProdId(p.prod_id); }}
                      >
                        🔍 View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedProdId && (
        <ProductDetailModal
          prodId={selectedProdId}
          onClose={function() { setSelectedProdId(null); }}
        />
      )}
    </div>
  );
}

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
  
      {/* Products owned by current user (or all products for admin) */}
      <MyProductsTable account={account} role={role} />

      <hr className="mt-4 mb-0" />

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
        {activeTab === "consumer" ? <ConsumerTab account={account} role={role} onConnect={connectWallet} /> : null}
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
          0xE40395…EA97
        </a>
      </footer>
    </div>
  );
}

export default App;
