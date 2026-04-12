import React, { useState } from 'react';
import contract, { switchToSepolia, PRODUCT_STATUSES } from '../contract';
import { WalletNotConnected, AccessDenied, alertClass } from './TabHelpers';

// Shows product details after a lookup
function ProductCard(props) {
  const product = props.product;
  if (!product) return null;

  let statusNum = Number(product.currentStatus);
  let statusLabel = PRODUCT_STATUSES[statusNum];
  if (!statusLabel) statusLabel = 'Unknown';

  // Pick badge color based on status
  function getStatusBadge() {
    if (statusNum === 0) return 'bg-secondary';
    if (statusNum === 1) return 'bg-primary';
    if (statusNum === 5) return 'bg-warning text-dark';
    if (statusNum === 12) return 'bg-success';
    return 'bg-info text-dark';
  }

  // Show expiration date or dash if not set
  let expirationDisplay = '—';
  if (product.expirationDate && product.expirationDate.toString() !== '0') {
    expirationDisplay = new Date(Number(product.expirationDate) * 1000).toLocaleDateString();
  }

  let prodIdStr = product.prodId ? product.prodId.toString() : '';
  let batchIdStr = product.currentBatchId ? product.currentBatchId.toString() : '';
  let parentBatchStr = product.parentBatchId ? product.parentBatchId.toString() : '';
  let ipfsHash = product.ipfsHash || '—';

  return (
    <div className="card mt-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <strong>Product #{prodIdStr}</strong>
        <span className={'badge ' + getStatusBadge()}>{statusLabel}</span>
      </div>
      <div className="card-body p-0">
        <table className="table table-sm table-borderless mb-0">
          <tbody>
            <tr>
              <th scope="row" className="text-muted fw-normal ps-3" style={{ width: '140px' }}>Producer</th>
              <td><code className="small">{product.producer}</code></td>
            </tr>
            <tr>
              <th scope="row" className="text-muted fw-normal ps-3">Current Owner</th>
              <td><code className="small">{product.currentOwner}</code></td>
            </tr>
            <tr>
              <th scope="row" className="text-muted fw-normal ps-3">IPFS Hash</th>
              <td><code className="small">{ipfsHash}</code></td>
            </tr>
            <tr>
              <th scope="row" className="text-muted fw-normal ps-3">Batch ID</th>
              <td>{batchIdStr}</td>
            </tr>
            <tr>
              <th scope="row" className="text-muted fw-normal ps-3">Parent Batch</th>
              <td>{parentBatchStr}</td>
            </tr>
            <tr>
              <th scope="row" className="text-muted fw-normal ps-3">Expiration</th>
              <td>{expirationDisplay}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProducerTab(props) {
  const account = props.account;
  const role = props.role;

  const isProducer = role === 1;

  const [createForm, setCreateForm] = useState({ prodId: '', ipfsHash: '' });
  const [produceForm, setProduceForm] = useState({ prodId: '', ipfsHash: '' });
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [txState, setTxState] = useState({ type: null, status: null, message: '' });

  // Helper to reduce repetition when setting tx state
  function setTx(type, status, message) {
    setTxState({ type: type, status: status, message: message });
  }

  // Create a new product on-chain
  async function handleCreateProduct(e) {
    e.preventDefault();
    setTx('create', 'pending', 'Waiting for transaction confirmation...');
    try {
      await switchToSepolia();
      await contract.methods
        .createProduct(createForm.prodId, createForm.ipfsHash)
        .send({ from: account, gas: '300000' });
      setTx('create', 'success', 'Product #' + createForm.prodId + ' registered on-chain.');
      setCreateForm({ prodId: '', ipfsHash: '' });
    } catch (err) {
      setTx('create', 'error', err.message || 'Transaction failed.');
    }
  }

  // Mark a product ready to ship
  async function handleProduce(e) {
    e.preventDefault();
    setTx('produce', 'pending', 'Waiting for transaction confirmation...');
    try {
      await switchToSepolia();
      await contract.methods
        .produce(produceForm.prodId, produceForm.ipfsHash)
        .send({ from: account, gas: '300000' });
      setTx('produce', 'success', 'Product #' + produceForm.prodId + ' marked as Ready to Ship.');
      setProduceForm({ prodId: '', ipfsHash: '' });
    } catch (err) {
      setTx('produce', 'error', err.message || 'Transaction failed.');
    }
  }

  // Look up product by ID
  async function handleLookup(e) {
    e.preventDefault();
    setLookupResult(null);
    setLookupError('');
    try {
      const result = await contract.methods.productLedger(lookupId).call();
      const noProduct = result.prodId && result.prodId.toString() === '0'
        && result.producer === '0x0000000000000000000000000000000000000000';
      if (noProduct) {
        setLookupError('No product found with this ID.');
      } else {
        setLookupResult(result);
      }
    } catch (err) {
      setLookupError('Failed to fetch product. Check the ID and try again.');
    }
  }

  if (!account) {
    return <WalletNotConnected roleName="Producer" />;
  }

  if (!isProducer) {
    return <AccessDenied icon="🏭" roleName="Producer" />;
  }

  // Pre-build the tx alerts so JSX stays clean
  let createAlert = null;
  if (txState.type === 'create' && txState.message) {
    createAlert = (
      <div className={'alert ' + alertClass(txState.status) + ' mt-2 py-2 small'}>
        {txState.message}
      </div>
    );
  }

  let produceAlert = null;
  if (txState.type === 'produce' && txState.message) {
    produceAlert = (
      <div className={'alert ' + alertClass(txState.status) + ' mt-2 py-2 small'}>
        {txState.message}
      </div>
    );
  }

  return (
    <div>
      <h4>🏭 Producer Dashboard</h4>
      <p className="text-muted">Register new product batches and manage their initial lifecycle stages.</p>

      <div className="row g-4 mt-1">
        {/* Create Product form */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">➕ Create Product</div>
            <div className="card-body">
              <p className="card-text text-muted small">Register a new product batch in <em>In Production</em> status.</p>
              <form onSubmit={handleCreateProduct}>
                <div className="mb-3">
                  <label className="form-label">Product ID</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="e.g. 1001"
                    value={createForm.prodId}
                    onChange={function(e) { setCreateForm({ prodId: e.target.value, ipfsHash: createForm.ipfsHash }); }}
                    required
                    min="1"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">IPFS Hash</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="QmXxxx..."
                    value={createForm.ipfsHash}
                    onChange={function(e) { setCreateForm({ prodId: createForm.prodId, ipfsHash: e.target.value }); }}
                    required
                  />
                </div>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={txState.type === 'create' && txState.status === 'pending'}
                >
                  {txState.type === 'create' && txState.status === 'pending' ? 'Processing...' : 'Register Product'}
                </button>
                {createAlert}
              </form>
            </div>
          </div>
        </div>

        {/* Mark Ready to Ship form */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">🚚 Mark Ready to Ship</div>
            <div className="card-body">
              <p className="card-text text-muted small">Transition a product batch to <em>Ready to Ship</em> status.</p>
              <form onSubmit={handleProduce}>
                <div className="mb-3">
                  <label className="form-label">Product ID</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="e.g. 1001"
                    value={produceForm.prodId}
                    onChange={function(e) { setProduceForm({ prodId: e.target.value, ipfsHash: produceForm.ipfsHash }); }}
                    required
                    min="1"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Updated IPFS Hash</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="QmXxxx..."
                    value={produceForm.ipfsHash}
                    onChange={function(e) { setProduceForm({ prodId: produceForm.prodId, ipfsHash: e.target.value }); }}
                    required
                  />
                </div>
                <button
                  className="btn btn-success"
                  type="submit"
                  disabled={txState.type === 'produce' && txState.status === 'pending'}
                >
                  {txState.type === 'produce' && txState.status === 'pending' ? 'Processing...' : 'Mark Ready to Ship'}
                </button>
                {produceAlert}
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Product Lookup */}
      <div className="card mt-4">
        <div className="card-header">🔍 Product Lookup</div>
        <div className="card-body">
          <form className="d-flex gap-2" onSubmit={handleLookup}>
            <input
              className="form-control"
              type="number"
              placeholder="Enter Product ID"
              value={lookupId}
              onChange={function(e) { setLookupId(e.target.value); }}
              required
              min="1"
            />
            <button className="btn btn-secondary" type="submit">Look Up</button>
          </form>
          {lookupError ? (
            <div className="alert alert-danger mt-2 py-2 small">{lookupError}</div>
          ) : null}
          {lookupResult ? <ProductCard product={lookupResult} /> : null}
        </div>
      </div>
    </div>
  );
}

export { ProductCard };
export default ProducerTab;
