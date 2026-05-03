import React, { useState, useEffect } from "react";
import contract, { PRODUCT_STATUSES, switchToSepolia } from "../contract";
import { AccessDenied, alertClass } from "./TabHelpers";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

// ProductStatus enum values
const IN_STORE_STATUS = 11;
const SOLD_STATUS = 12;
// Role enum values
const RETAILER_ROLE = 4;

/**
 * Inline history modal — shows a combined status/ownership timeline for one product.
 * Each row: source status → target status, source owner → target owner, timestamp.
 * Sorted descending by block number.
 */
function HistoryModal({ prodId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!prodId) return;
    setLoading(true);
    setError("");
    fetch(`${BACKEND_URL}/api/consumer/products/${prodId}/history`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);

        // Sort status history ascending by block to compute prev-status
        const statusAsc = [...(data.status_history || [])].sort(
          (a, b) => a.block_number - b.block_number || a.id - b.id
        );

        // Build an ownership lookup by block_number for quick access
        const ownerByBlock = {};
        for (const o of data.ownership_history || []) {
          ownerByBlock[o.block_number] = ownerByBlock[o.block_number] || [];
          ownerByBlock[o.block_number].push(o);
        }

        // Build unified rows

        const built = statusAsc.map((s, idx) => {
          const prevStatus = idx === 0 ? "—" : (PRODUCT_STATUSES[statusAsc[idx - 1].new_status] || statusAsc[idx - 1].new_status_name || String(statusAsc[idx - 1].new_status));
          const targetStatus = PRODUCT_STATUSES[s.new_status] || s.new_status_name || String(s.new_status);

          // Look for ownership transfer at same block
          const ownershipAtBlock = (ownerByBlock[s.block_number] || [])[0];
          const fromOwner = ownershipAtBlock ? ownershipAtBlock.previous_owner : (idx === 0 ? s.updated_by : "—");
          const toOwner = ownershipAtBlock ? ownershipAtBlock.new_owner : s.updated_by;

          const ts = s.block_timestamp
            ? new Date(s.block_timestamp).toLocaleString()
            : `Block ${s.block_number}`;

          // Add ipfsHash for display
          return { id: s.id, block: s.block_number, prevStatus, targetStatus, fromOwner, toOwner, ts, ipfsHash: s.ipfs_hash };
        });

        // Descending order for display
        built.sort((a, b) => b.block - a.block || b.id - a.id);
        setRows(built);
      })
      .catch((err) => setError(err.message || "Failed to load history."))
      .finally(() => setLoading(false));
  }, [prodId]);

  return (
    <>
      <div className="modal-backdrop show" style={{ zIndex: 1040 }} onClick={onClose} />
      <div
        className="modal show d-block"
        tabIndex="-1"
        style={{ zIndex: 1050 }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">🔍 Product #{prodId} — Provenance History</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">
              {loading && <div className="text-center text-muted py-4">Loading history…</div>}
              {error && <div className="alert alert-danger">{error}</div>}
              {!loading && !error && rows.length === 0 && (
                <div className="text-muted text-center py-4">No history events found for this product.</div>
              )}
              {!loading && !error && rows.length > 0 && (
                <div className="table-responsive">
                    <table className="table table-sm table-striped table-bordered align-middle mb-0">
                      <thead className="table-dark">
                        <tr>
                          <th>Date/Time</th>
                          <th>From Status</th>
                          <th>To Status</th>
                          {/* <th>From Owner</th> */}
                          <th>To Owner</th>
                          <th>IPFS Hash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={`${r.block}-${r.id}`}>
                            <td className="text-nowrap small">{r.ts}</td>
                            <td><span className="badge bg-secondary">{r.prevStatus}</span></td>
                            <td><span className="badge bg-primary">{r.targetStatus}</span></td>
                            {/* <td><code className="small">{r.fromOwner}</code></td> */}
                            <td><code className="small">{r.toOwner}</code></td>
                            <td className="small">
                              {r.ipfsHash ? (
                                <a
                                  href={`https://ipfs.io/ipfs/${r.ipfsHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={r.ipfsHash}
                                >
                                  {r.ipfsHash.slice(0, 12)}…
                                </a>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ConsumerTab({ account, role, onConnect }) {
  const isConsumer = role === 2;

  // --- Buy Product state ---
  const [retailers, setRetailers] = useState([]);
  const [retailersLoading, setRetailersLoading] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState("");
  const [inStoreProducts, setInStoreProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProdId, setSelectedProdId] = useState("");
  const [buyState, setBuyState] = useState({ status: null, message: "" });

  // --- Verify Product state ---
  const [verifyMode, setVerifyMode] = useState("in-store"); // "in-store" | "sold"
  const [verifyRetailer, setVerifyRetailer] = useState("");
  const [verifyInStoreProducts, setVerifyInStoreProducts] = useState([]);
  const [verifyInStoreLoading, setVerifyInStoreLoading] = useState(false);
  const [mySoldProducts, setMySoldProducts] = useState([]);
  const [mySoldLoading, setMySoldLoading] = useState(false);
  const [verifyProdId, setVerifyProdId] = useState("");
  const [historyModal, setHistoryModal] = useState(null); // prodId when open, null when closed

  // Load retailers from the backend on mount
  useEffect(() => {
    setRetailersLoading(true);
    fetch(`${BACKEND_URL}/api/users?role=${RETAILER_ROLE}`)
      .then((r) => r.json())
      .then((data) => setRetailers(data.users || []))
      .catch(() => setRetailers([]))
      .finally(() => setRetailersLoading(false));
  }, []);

  // Load in-store products whenever a retailer is selected
  useEffect(() => {
    if (!selectedRetailer) {
      setInStoreProducts([]);
      setSelectedProdId("");
      return;
    }
    setProductsLoading(true);
    fetch(
      `${BACKEND_URL}/api/products?status=${IN_STORE_STATUS}&owner=${selectedRetailer}`
    )
      .then((r) => r.json())
      .then((data) => setInStoreProducts(data.products || []))
      .catch(() => setInStoreProducts([]))
      .finally(() => setProductsLoading(false));
  }, [selectedRetailer]);

  function handleRetailerChange(e) {
    setSelectedRetailer(e.target.value);
    setSelectedProdId("");
    setBuyState({ status: null, message: "" });
  }

  async function handleBuy(e) {
    e.preventDefault();
    if (!account) {
      setBuyState({ status: "error", message: "Please connect your wallet first." });
      return;
    }
    if (!isConsumer) {
      setBuyState({ status: "error", message: "Your wallet does not have the Consumer role." });
      return;
    }
    if (!selectedProdId) {
      setBuyState({ status: "error", message: "Please select a product to buy." });
      return;
    }
    setBuyState({ status: "pending", message: "Submitting purchase transaction…" });
    try {
      await switchToSepolia();
      await contract.methods
        .purchaseProduct(selectedProdId, "")
        .send({ from: account, gas: "300000" });
      setBuyState({ status: "success", message: `Product #${selectedProdId} purchased successfully!` });
      // Refresh the in-store list so the bought product disappears
      setSelectedProdId("");
      const data = await fetch(
        `${BACKEND_URL}/api/products?status=${IN_STORE_STATUS}&owner=${selectedRetailer}`
      ).then((r) => r.json());
      setInStoreProducts(data.products || []);
    } catch (err) {
      setBuyState({ status: "error", message: err.message || "Purchase transaction failed." });
    }
  }

  // Load in-store products for verify mode when retailer changes
  useEffect(() => {
    if (verifyMode !== "in-store" || !verifyRetailer) {
      setVerifyInStoreProducts([]);
      setVerifyProdId("");
      return;
    }
    setVerifyInStoreLoading(true);
    fetch(`${BACKEND_URL}/api/products?status=${IN_STORE_STATUS}&owner=${verifyRetailer}`)
      .then((r) => r.json())
      .then((data) => setVerifyInStoreProducts(data.products || []))
      .catch(() => setVerifyInStoreProducts([]))
      .finally(() => setVerifyInStoreLoading(false));
  }, [verifyRetailer, verifyMode]);

  // Load consumer's own sold products when sold mode is active
  useEffect(() => {
    if (verifyMode !== "sold" || !account) {
      setMySoldProducts([]);
      setVerifyProdId("");
      return;
    }
    setMySoldLoading(true);
    fetch(`${BACKEND_URL}/api/products?status=${SOLD_STATUS}&owner=${account}`)
      .then((r) => r.json())
      .then((data) => setMySoldProducts(data.products || []))
      .catch(() => setMySoldProducts([]))
      .finally(() => setMySoldLoading(false));
  }, [account, verifyMode]);

  function handleVerifyModeChange(mode) {
    setVerifyMode(mode);
    setVerifyRetailer("");
    setVerifyProdId("");
  }

  return (
    <div>
      <h4>🛒 Consumer Dashboard</h4>

      {!account ? (
        <div className="alert alert-warning d-flex justify-content-between align-items-center mb-4">
          <span>Wallet not connected.</span>
          <button className="btn btn-sm btn-dark" type="button" onClick={onConnect}>
            Connect Wallet
          </button>
        </div>
      ) : null}

      {account && !isConsumer ? (
        <AccessDenied icon="🧾" roleName="Consumer" />
      ) : (
        <div className="row g-4">
          {/* ── Card 1: Buy Product ── */}
          <div className="col-12 col-lg-6">
            <div className="card h-100">
              <div className="card-header fw-semibold">🛍️ Buy Product from Retailer</div>
              <div className="card-body">
                <form onSubmit={handleBuy}>
                  {/* Retailer dropdown */}
                  <div className="mb-3">
                    <label className="form-label">Select Retailer</label>
                    <select
                      className="form-select"
                      value={selectedRetailer}
                      onChange={handleRetailerChange}
                      disabled={retailersLoading}
                    >
                      <option value="">
                        {retailersLoading ? "Loading retailers…" : "— Choose a retailer —"}
                      </option>
                      {retailers.map((r) => (
                        <option key={r.address} value={r.address}>
                          {r.address}
                        </option>
                      ))}
                    </select>
                    {!retailersLoading && retailers.length === 0 ? (
                      <div className="form-text text-warning">No retailers found in the indexer.</div>
                    ) : null}
                  </div>

                  {/* In-Store products dropdown */}
                  <div className="mb-3">
                    <label className="form-label">Select Product (In Store)</label>
                    <select
                      className="form-select"
                      value={selectedProdId}
                      onChange={(e) => {
                        setSelectedProdId(e.target.value);
                        setBuyState({ status: null, message: "" });
                      }}
                      disabled={!selectedRetailer || productsLoading}
                    >
                      <option value="">
                        {!selectedRetailer
                          ? "— Select a retailer first —"
                          : productsLoading
                          ? "Loading products…"
                          : "— Choose a product —"}
                      </option>
                      {inStoreProducts.map((p) => (
                        <option key={p.prod_id} value={p.prod_id}>
                          Product #{p.prod_id}
                          {p.ipfs_hash ? ` · ${p.ipfs_hash.slice(0, 16)}…` : ""}
                        </option>
                      ))}
                    </select>
                    {selectedRetailer && !productsLoading && inStoreProducts.length === 0 ? (
                      <div className="form-text text-muted">No in-store products for this retailer.</div>
                    ) : null}
                  </div>

                  <button
                    className="btn btn-success"
                    type="submit"
                    disabled={!selectedProdId || buyState.status === "pending"}
                  >
                    {buyState.status === "pending" ? "Processing…" : "Buy Product"}
                  </button>
                </form>

                {buyState.message ? (
                  <div className={`alert ${alertClass(buyState.status)} mt-3 py-2`}>
                    {buyState.message}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* ── Card 2: Verify Product History ── */}
          <div className="col-12 col-lg-6">
            <div className="card h-100">
              <div className="card-header fw-semibold">🔍 Verify Product History</div>
              <div className="card-body">
                {/* Radio: In Store vs My Purchases */}
                <div className="mb-3">
                  <div className="form-check form-check-inline">
                    <input
                      className="form-check-input"
                      type="radio"
                      id="verify-instore"
                      name="verifyMode"
                      value="in-store"
                      checked={verifyMode === "in-store"}
                      onChange={() => handleVerifyModeChange("in-store")}
                    />
                    <label className="form-check-label" htmlFor="verify-instore">In Store</label>
                  </div>
                  <div className="form-check form-check-inline">
                    <input
                      className="form-check-input"
                      type="radio"
                      id="verify-sold"
                      name="verifyMode"
                      value="sold"
                      checked={verifyMode === "sold"}
                      onChange={() => handleVerifyModeChange("sold")}
                    />
                    <label className="form-check-label" htmlFor="verify-sold">My Purchased Products</label>
                  </div>
                </div>

                {/* In Store mode: Retailer → Product dropdowns */}
                {verifyMode === "in-store" && (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Select Retailer</label>
                      <select
                        className="form-select"
                        value={verifyRetailer}
                        onChange={(e) => { setVerifyRetailer(e.target.value); setVerifyProdId(""); }}
                        disabled={retailersLoading}
                      >
                        <option value="">
                          {retailersLoading ? "Loading retailers…" : "— Choose a retailer —"}
                        </option>
                        {retailers.map((r) => (
                          <option key={r.address} value={r.address}>{r.address}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Select Product (In Store)</label>
                      <select
                        className="form-select"
                        value={verifyProdId}
                        onChange={(e) => setVerifyProdId(e.target.value)}
                        disabled={!verifyRetailer || verifyInStoreLoading}
                      >
                        <option value="">
                          {!verifyRetailer
                            ? "— Select a retailer first —"
                            : verifyInStoreLoading
                            ? "Loading products…"
                            : "— Choose a product —"}
                        </option>
                        {verifyInStoreProducts.map((p) => (
                          <option key={p.prod_id} value={p.prod_id}>
                            Product #{p.prod_id}{p.name ? ` — ${p.name}` : ""}
                          </option>
                        ))}
                      </select>
                      {verifyRetailer && !verifyInStoreLoading && verifyInStoreProducts.length === 0 && (
                        <div className="form-text text-muted">No in-store products for this retailer.</div>
                      )}
                    </div>
                  </>
                )}

                {/* Sold mode: My purchased products dropdown */}
                {verifyMode === "sold" && (
                  <div className="mb-3">
                    <label className="form-label">Select My Purchased Product</label>
                    <select
                      className="form-select"
                      value={verifyProdId}
                      onChange={(e) => setVerifyProdId(e.target.value)}
                      disabled={mySoldLoading || !account}
                    >
                      <option value="">
                        {!account
                          ? "— Connect wallet first —"
                          : mySoldLoading
                          ? "Loading your products…"
                          : "— Choose a product —"}
                      </option>
                      {mySoldProducts.map((p) => (
                        <option key={p.prod_id} value={p.prod_id}>
                          Product #{p.prod_id}{p.name ? ` — ${p.name}` : ""}
                        </option>
                      ))}
                    </select>
                    {!mySoldLoading && account && mySoldProducts.length === 0 && (
                      <div className="form-text text-muted">No purchased products found for your address.</div>
                    )}
                  </div>
                )}

                <button
                  className="btn btn-outline-primary"
                  type="button"
                  disabled={!verifyProdId}
                  onClick={() => setHistoryModal(verifyProdId)}
                >
                  Verify History
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyModal && (
        <HistoryModal prodId={historyModal} onClose={() => setHistoryModal(null)} />
      )}
    </div>
  );
}

export default ConsumerTab;
