import React, { useState } from "react";
import contract, { PRODUCT_STATUSES, switchToSepolia } from "../contract";
import { AccessDenied, alertClass } from "./TabHelpers";

function ConsumerTab({ account, role, onConnect }) {
  const isConsumer = role === 2;
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState("");
  const [purchaseForm, setPurchaseForm] = useState({ prodId: "", ipfsHash: "" });
  const [txState, setTxState] = useState({ status: null, message: "" });

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

  return (
    <div>
      <h4>🔍 Consumer Dashboard</h4>
      <p className="text-muted mb-3">
        You can verify any product without wallet connection. Purchase requires MetaMask + Consumer role.
      </p>

      {!account ? (
        <div className="alert alert-warning d-flex justify-content-between align-items-center">
          <span>Wallet not connected. You are in read-only verification mode.</span>
          <button className="btn btn-sm btn-dark" onClick={onConnect}>
            Connect Wallet
          </button>
        </div>
      ) : null}

      <div className="card mb-4">
        <div className="card-header">Product Verification</div>
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
              <div><strong>Product ID:</strong> {lookupResult.prodId?.toString()}</div>
              <div><strong>Status:</strong> {statusLabel(lookupResult.currentStatus)}</div>
              <div><strong>Current Owner:</strong> <code>{lookupResult.currentOwner}</code></div>
              <div><strong>Producer:</strong> <code>{lookupResult.producer}</code></div>
              <div><strong>IPFS:</strong> <code>{lookupResult.ipfsHash || "—"}</code></div>
            </div>
          ) : null}
        </div>
      </div>

      {account && !isConsumer ? (
        <AccessDenied icon="🧾" roleName="Consumer" />
      ) : null}

      {account && isConsumer ? (
        <div className="card">
          <div className="card-header">Purchase Product</div>
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
                Purchase
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
    </div>
  );
}

export default ConsumerTab;
