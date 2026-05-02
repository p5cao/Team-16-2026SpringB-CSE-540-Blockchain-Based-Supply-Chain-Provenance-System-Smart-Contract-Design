import React, { useState } from "react";
import contract, { PRODUCT_STATUSES, switchToSepolia } from "../contract";
import { AccessDenied, alertClass } from "./TabHelpers";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

function ConsumerTab({ account, role, onConnect }) {
  const isConsumer = role === 2;
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState("");
  const [purchaseForm, setPurchaseForm] = useState({ prodId: "", ipfsHash: "" });
  const [relayForm, setRelayForm] = useState({ prodId: "", ipfsHash: "" });
  const [txState, setTxState] = useState({ status: null, message: "" });
  const [relayState, setRelayState] = useState({ status: null, message: "" });
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  function statusLabel(status) {
    return PRODUCT_STATUSES[Number(status)] || "Unknown";
  }

  async function handleLookup(e) {
    e.preventDefault();
    setLookupError("");
    setLookupResult(null);
    try {
      const product = await contract.methods.verifyProduct(lookupId).call();
      setLookupResult(product);
    } catch (err) {
      setLookupError("Product not found or network mismatch. Please check Product ID and network.");
    }
  }

  async function loadIndexerHistory(e) {
    e.preventDefault();
    setHistoryError("");
    setHistoryData(null);
    if (!lookupId) {
      setHistoryError("Enter a Product ID first.");
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/consumer/products/${lookupId}/history`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Indexer request failed");
      setHistoryData(json);
    } catch (err) {
      setHistoryError(err.message || "Could not load indexer history. Is the backend running?");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handlePurchase(e) {
    e.preventDefault();
    if (!account) {
      setTxState({ status: "error", message: "Please connect wallet first." });
      return;
    }
    if (!isConsumer) {
      setTxState({ status: "error", message: "Your wallet is not assigned Consumer role." });
      return;
    }
    setTxState({ status: "pending", message: "Submitting purchase transaction..." });
    try {
      await switchToSepolia();
      await contract.methods
        .purchaseProduct(purchaseForm.prodId, purchaseForm.ipfsHash)
        .send({ from: account, gas: "300000" });
      setTxState({ status: "success", message: "Purchase successful. Product marked as Sold." });
      setPurchaseForm({ prodId: "", ipfsHash: "" });
    } catch (err) {
      setTxState({ status: "error", message: err.message || "Purchase transaction failed." });
    }
  }

  async function handleRelayPurchase(e) {
    e.preventDefault();
    setRelayState({ status: "pending", message: "Sending purchase via backend relay..." });
    try {
      const res = await fetch(`${BACKEND_URL}/api/consumer/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prodId: relayForm.prodId,
          saleIpfsHash: relayForm.ipfsHash,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.hint || "Relay failed");
      setRelayState({
        status: "success",
        message: `Relay OK — tx ${json.txHash}`,
      });
      setRelayForm({ prodId: "", ipfsHash: "" });
    } catch (err) {
      setRelayState({ status: "error", message: err.message || "Relay purchase failed." });
    }
  }

  return (
    <div>
      <h4>🔍 Consumer Dashboard</h4>
      <p className="text-muted mb-3">
        On-chain verify via MetaMask RPC; indexer history + IPFS fields come from the backend (
        <code>{BACKEND_URL}</code>
        ). Set <code>REACT_APP_BACKEND_URL</code> if needed.
      </p>

      {!account ? (
        <div className="alert alert-warning d-flex justify-content-between align-items-center">
          <span>Wallet not connected. You are in read-only verification mode.</span>
          <button className="btn btn-sm btn-dark" type="button" onClick={onConnect}>
            Connect Wallet
          </button>
        </div>
      ) : null}

      <div className="card mb-4">
        <div className="card-header">Product Verification (on-chain)</div>
        <div className="card-body">
          <form className="d-flex gap-2" onSubmit={handleLookup}>
            <input
              className="form-control"
              type="number"
              min="1"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Enter Product ID"
              required
            />
            <button className="btn btn-secondary" type="submit">
              Verify
            </button>
          </form>
          {lookupError ? <div className="alert alert-danger mt-3 py-2">{lookupError}</div> : null}
          {lookupResult ? (
            <div className="mt-3">
              <div><strong>Product ID:</strong> {lookupResult.prodId?.toString?.() ?? lookupResult.prodId}</div>
              <div><strong>Status:</strong> {statusLabel(lookupResult.currentStatus)}</div>
              <div><strong>Current Owner:</strong> <code>{lookupResult.currentOwner}</code></div>
              {lookupResult.producer ? (
                <div><strong>Producer:</strong> <code>{lookupResult.producer}</code></div>
              ) : null}
              <div><strong>IPFS:</strong> <code>{lookupResult.ipfsHash || "—"}</code></div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header">Product history (indexer: DB + events + IPFS rows)</div>
        <div className="card-body">
          <p className="small text-muted mb-2">
            Loads <code>products</code>, <code>status_history</code>, and <code>ownership_history</code> filled by the event listener (unified events: RoleAssigned, ProductCreated, ProductStatusChanged, ProductOwnershipTransferred).
          </p>
          <button
            className="btn btn-outline-primary btn-sm"
            type="button"
            disabled={historyLoading || !lookupId}
            onClick={loadIndexerHistory}
          >
            {historyLoading ? "Loading…" : "Load indexed history"}
          </button>
          {historyError ? <div className="alert alert-warning mt-3 py-2 small">{historyError}</div> : null}
          {historyData ? (
            <div className="mt-3">
              {historyData.product ? (
                <div className="small mb-2">
                  <strong>Cached product row:</strong> status {historyData.product.current_status}, owner{" "}
                  <code>{historyData.product.current_owner}</code>
                  {historyData.product.ipfs_synced ? " · IPFS synced" : " · IPFS pending"}
                </div>
              ) : (
                <div className="text-muted small mb-2">No product row in DB yet (listener may still be catching up).</div>
              )}
              <h6 className="mt-3">Status timeline</h6>
              <div className="table-responsive">
                <table className="table table-sm table-striped">
                  <thead>
                    <tr>
                      <th>Block</th>
                      <th>Status</th>
                      <th>By</th>
                      <th>IPFS</th>
                      <th>Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(historyData.status_history || []).map((row) => (
                      <tr key={`s-${row.id}`}>
                        <td>{row.block_number}</td>
                        <td>{row.new_status_name ?? row.new_status}</td>
                        <td><code className="small">{row.updated_by}</code></td>
                        <td><code className="small">{row.ipfs_hash || "—"}</code></td>
                        <td className="small">{row.tx_hash?.slice(0, 10)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h6 className="mt-3">Ownership timeline</h6>
              <div className="table-responsive">
                <table className="table table-sm table-striped">
                  <thead>
                    <tr>
                      <th>Block</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(historyData.ownership_history || []).map((row) => (
                      <tr key={`o-${row.id}`}>
                        <td>{row.block_number}</td>
                        <td><code className="small">{row.previous_owner}</code></td>
                        <td><code className="small">{row.new_owner}</code></td>
                        <td className="small">{row.tx_hash?.slice(0, 10)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {account && !isConsumer ? (
        <AccessDenied icon="🧾" roleName="Consumer" />
      ) : null}

      {account && isConsumer ? (
        <div className="card mb-4">
          <div className="card-header">Purchase Product (wallet — contract checks Consumer)</div>
          <div className="card-body">
            <form onSubmit={handlePurchase}>
              <div className="mb-3">
                <label className="form-label">Product ID</label>
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  required
                  value={purchaseForm.prodId}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, prodId: e.target.value })
                  }
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Sale Receipt / IPFS Hash</label>
                <input
                  className="form-control"
                  type="text"
                  required
                  placeholder="Qm..."
                  value={purchaseForm.ipfsHash}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, ipfsHash: e.target.value })
                  }
                />
              </div>
              <button className="btn btn-success" type="submit">
                Purchase with MetaMask
              </button>
            </form>
            {txState.message ? (
              <div className={`alert ${alertClass(txState.status)} mt-3 py-2`}>
                {txState.message}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="card mb-4">
        <div className="card-header">Purchase via backend relay (optional)</div>
        <div className="card-body">
          <p className="small text-muted">
            Server holds <code>CONSUMER_RELAYER_PRIVATE_KEY</code>; contract still requires{" "}
            <code>Role.Consumer</code> for <code>msg.sender</code>. Admin must assign Consumer to that address.
          </p>
          <form onSubmit={handleRelayPurchase}>
            <div className="mb-3">
              <label className="form-label">Product ID</label>
              <input
                className="form-control"
                type="number"
                min="1"
                required
                value={relayForm.prodId}
                onChange={(e) => setRelayForm({ ...relayForm, prodId: e.target.value })}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Sale Receipt / IPFS Hash</label>
              <input
                className="form-control"
                type="text"
                required
                value={relayForm.ipfsHash}
                onChange={(e) => setRelayForm({ ...relayForm, ipfsHash: e.target.value })}
              />
            </div>
            <button className="btn btn-outline-success" type="submit">
              Purchase via backend
            </button>
          </form>
          {relayState.message ? (
            <div className={`alert ${alertClass(relayState.status)} mt-3 py-2`}>
              {relayState.message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ConsumerTab;
