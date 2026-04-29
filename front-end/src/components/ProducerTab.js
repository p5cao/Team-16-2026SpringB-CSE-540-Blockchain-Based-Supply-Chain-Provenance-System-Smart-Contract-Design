import React, { useState } from 'react';
import contract, { readContract, switchToSepolia, PRODUCT_STATUSES } from '../contract';
import { uploadToIPFS } from '../utils/ipfs';
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

  // Registration form: captures metadata fields before IPFS upload
  const [regForm, setRegForm] = useState({ prodId: '', name: '', origin: '', certUrl: '' });
  const [isRegistering, setIsRegistering] = useState(false);

  // Ship to distributor form
  const [shipForm, setShipForm] = useState({ prodId: '', distributor: '' });

  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [txState, setTxState] = useState({ type: null, status: null, message: '' });

  function setTx(type, status, message) {
    setTxState({ type: type, status: status, message: message });
  }

  // --- WORKFLOW 1: Register Product (IPFS upload → blockchain anchor) ---
  async function handleRegister(e) {
    e.preventDefault();
    setIsRegistering(true);
    setTx('register', 'pending', 'Uploading metadata to IPFS...');
    try {
      // Step 1: Package metadata and upload to Pinata/IPFS
      const metadata = {
        id: regForm.prodId,
        name: regForm.name,
        producer_wallet: account,
        certificate: regForm.certUrl,
        attributes: {
          origin: regForm.origin,
          registered_at: new Date().toISOString(),
        },
      };
      const cid = await uploadToIPFS(metadata);

      // Step 2: Anchor the CID to the blockchain
      setTx('register', 'pending', 'Waiting for MetaMask confirmation...');
      await switchToSepolia();
      await contract.methods
        .createProduct(regForm.prodId, regForm.prodId, cid, 0)
        .send({ from: account, gas: '300000' });

      setTx('register', 'success', `Batch #${regForm.prodId} registered. IPFS CID: ${cid}`);
      setRegForm({ prodId: '', name: '', origin: '', certUrl: '' });
    } catch (err) {
      setTx('register', 'error', err.message || 'Registration failed.');
    } finally {
      setIsRegistering(false);
    }
  }

  // --- WORKFLOW 2: Ship Product to Distributor ---
  async function handleShipToDistributor(e) {
    e.preventDefault();
    setTx('ship', 'pending', 'Waiting for MetaMask confirmation...');
    try {
      await switchToSepolia();
      await contract.methods
        .shipToDistributor(shipForm.prodId, shipForm.distributor)
        .send({ from: account, gas: '300000' });
      setTx('ship', 'success', `Batch #${shipForm.prodId} custody transferred to ${shipForm.distributor}.`);
      setShipForm({ prodId: '', distributor: '' });
    } catch (err) {
      setTx('ship', 'error', err.message || 'Shipment failed. Is the address an authorized distributor?');
    }
  }

  // Look up product by ID
  async function handleLookup(e) {
    e.preventDefault();
    setLookupResult(null);
    setLookupError('');
    try {
      // getProduct reverts with "Product does not exist" for unknown IDs,
      // giving a clear error rather than a silent zero-struct from productLedger.
      const result = await readContract.methods.getProduct(lookupId).call();
      console.log('[Lookup] raw result for ID', lookupId, ':', result);
      setLookupResult(result);
    } catch (err) {
      console.error('[Lookup] error:', err);
      const msg = err.message || '';
      if (msg.includes('Product does not exist')) {
        setLookupError('No product found with ID ' + lookupId + '. Make sure the batch was registered on Sepolia.');
      } else {
        setLookupError('Lookup failed: ' + msg);
      }
    }
  }

  if (!account) {
    return <WalletNotConnected roleName="Producer" />;
  }

  if (!isProducer) {
    return <AccessDenied icon="🏭" roleName="Producer" />;
  }

  function txAlert(type) {
    if (txState.type !== type || !txState.message) return null;
    return (
      <div className={'alert ' + alertClass(txState.status) + ' mt-2 py-2 small'}>
        {txState.message}
      </div>
    );
  }

  return (
    <div>
      <h4>🏭 Producer Control Panel</h4>
      <p className="text-muted">Create the digital twin of a physical batch and manage custody transfer to distributors.</p>

      <div className="row g-4 mt-1">
        {/* WORKFLOW 1: Register / Mint Digital Twin */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header">➕ Register New Batch</div>
            <div className="card-body">
              <p className="card-text text-muted small">
                Uploads origin metadata to IPFS and anchors the CID to Ethereum, creating the product's provenance trail.
              </p>
              <form onSubmit={handleRegister}>
                <div className="mb-3">
                  <label className="form-label">Batch ID</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="e.g. 1001"
                    value={regForm.prodId}
                    onChange={function(e) { setRegForm({ ...regForm, prodId: e.target.value }); }}
                    required
                    min="1"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Product Name</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="e.g. Organic Coffee Beans"
                    value={regForm.name}
                    onChange={function(e) { setRegForm({ ...regForm, name: e.target.value }); }}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Farm / Origin Location</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="e.g. Huila, Colombia"
                    value={regForm.origin}
                    onChange={function(e) { setRegForm({ ...regForm, origin: e.target.value }); }}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Certificate / Document URL</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="https://... (PDF or image link)"
                    value={regForm.certUrl}
                    onChange={function(e) { setRegForm({ ...regForm, certUrl: e.target.value }); }}
                    required
                  />
                </div>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={isRegistering}
                >
                  {isRegistering ? 'Uploading to IPFS & Blockchain...' : 'Mint Digital Twin'}
                </button>
                {txAlert('register')}
              </form>
            </div>
          </div>
        </div>

        {/* WORKFLOW 2: Transfer Custody to Distributor */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header">🚚 Transfer Custody to Distributor</div>
            <div className="card-body">
              <p className="card-text text-muted small">
                Ships a registered batch to an authorized distributor in a single on-chain transaction.
                The product must be in <em>In Production</em> or <em>Ready to Ship</em> status.
              </p>
              <form onSubmit={handleShipToDistributor}>
                <div className="mb-3">
                  <label className="form-label">Batch ID</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="e.g. 1001"
                    value={shipForm.prodId}
                    onChange={function(e) { setShipForm({ ...shipForm, prodId: e.target.value }); }}
                    required
                    min="1"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Distributor Wallet Address</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="0x..."
                    value={shipForm.distributor}
                    onChange={function(e) { setShipForm({ ...shipForm, distributor: e.target.value }); }}
                    required
                  />
                </div>
                <button
                  className="btn btn-success"
                  type="submit"
                  disabled={txState.type === 'ship' && txState.status === 'pending'}
                >
                  {txState.type === 'ship' && txState.status === 'pending' ? 'Processing...' : 'Transfer Custody'}
                </button>
                {txAlert('ship')}
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
              placeholder="Enter Batch / Product ID"
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
