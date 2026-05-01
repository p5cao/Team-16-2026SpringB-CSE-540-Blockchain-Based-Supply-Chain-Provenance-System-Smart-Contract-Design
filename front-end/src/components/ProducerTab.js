import React, { useState, useEffect } from 'react';
import contract, { readContract, switchToSepolia } from '../contract';
import { uploadToIPFS } from '../utils/ipfs';
import { WalletNotConnected, AccessDenied, alertClass } from './TabHelpers';
import ProductDetailModal from './ProductDetailModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

function ProducerTab(props) {
  const { account, role } = props;

  const isProducer = role === 1;

  // form for registering a new product - all the metadata fields
  const [regForm, setRegForm] = useState({ prodId: '', name: '', origin: '', certUrl: '', producerBatchId: '', expirationDate: '', parentBatchId: '' });
  const [isRegistering, setIsRegistering] = useState(false);

  const [ship_form, setShipForm] = useState({prodId: '', distributor: ''});
  const [ownedProducts,setOwnedProducts] = useState([]);
  const [distList, setDistList] = useState([]);
  const [shipLoading, setShipLoading]   = useState(false);

  const [lookupId, setLookupId] = useState('');
  const [lookup_prod_id,setLookupProdId] = useState(null);
  const [lookupErr, setLookupErr] = useState('');
  const [txState, setTxState]  = useState({ type: null, status: null, message: '' });

  // load owned products + distributors when tab is first shown
  // TODO: refresh this after a successful register/ship
  useEffect(() => {
    if (!account || !isProducer) return;

    setShipLoading(true);
    const userProductsUrl = `${BACKEND_URL}/api/users/${account}/products`;
    const distUrl = `${BACKEND_URL}/api/users?role=3`;
    Promise.all([
      fetch(userProductsUrl).then(r => r.json()).catch(() => ({})),
      fetch(distUrl).then(function(r) { return r.json(); }).catch(() => ({})),
    ]).then(([prodResp, userResp]) => {
      setOwnedProducts(Array.isArray(prodResp.products) ? prodResp.products : []);
      setDistList(Array.isArray(userResp.users) ? userResp.users : []);
    }).finally(() => setShipLoading(false));
  }, [account, isProducer]);

  function setTx(type, status, message) {
    setTxState({type, status, message});
  }

  async function handleRegister(e) {
    e.preventDefault();
    setIsRegistering(true);
    setTx('register', 'pending', 'Uploading metadata to IPFS...');
    try {
      const ipfsMeta = {
        id: regForm.prodId,
        name: regForm.name,
        producer_wallet: account,
        producer_batch_id: regForm.producerBatchId || regForm.prodId,
        current_batch_id: regForm.producerBatchId || regForm.prodId,
        parent_batch_id: regForm.parentBatchId || null,
        expiration_date: regForm.expirationDate || null,
        certificate: regForm.certUrl,
        attributes: {
          origin: regForm.origin,
          registered_at: new Date().toISOString(),
        },
      };
      const CID = await uploadToIPFS(ipfsMeta);

      // now anchor the cid on chain
      setTx('register', 'pending', 'Waiting for MetaMask confirmation...');
      await switchToSepolia();
      await contract.methods
        .createProduct(regForm.prodId, CID)
        .send({ from: account, gas: '300000' });

      setTx('register', 'success', `Batch #${regForm.prodId} registered. IPFS CID: ${CID}`);
      setRegForm({ prodId: '', name: '', origin: '', certUrl: '', producerBatchId: '', expirationDate: '', parentBatchId: '' });
    } catch (err) {
      setTx('register', 'error', err.message || 'Registration failed.');
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleShipToDistributor(e) {
    e.preventDefault();
    setTx('ship', 'pending', 'Waiting for MetaMask confirmation...');
    try {
      await switchToSepolia();
      const { prodId: batchId, distributor: distAddr } = ship_form;
      await contract.methods
        .shipToDistributor(batchId, distAddr)
        .send({ from: account, gas: '300000' });
      setTx('ship', 'success', 'Batch #' + batchId + ' custody transferred to ' + distAddr + '.');
      setShipForm({ prodId: '', distributor: '' });
    } catch (err) {
      setTx('ship', 'error', err.message || 'Shipment failed. Is the address an authorized distributor?');
    }
  }

  const handleLookup = async (e) => {
    e.preventDefault();
    setLookupProdId(null);
    setLookupErr('');
    try {
      await readContract.methods.getProduct(lookupId).call();
      setLookupProdId(Number(lookupId));
    } catch (err) {
      const errMsg = err.message || '';
      if (errMsg.includes('Product does not exist')) {
        setLookupErr('No product found with ID ' + lookupId + '. Make sure the batch was registered on Sepolia.');
      } else {
        setLookupErr('Lookup failed: ' + errMsg);
      }
    }
  }

  if (!account) {
    return <WalletNotConnected roleName="Producer" />;
  }

  if (!isProducer) {
    return <AccessDenied icon="🏭" roleName="Producer" />;
  }

  const txAlert = (type) => {
    if (txState.type !== type || !txState.message) return null;
    return <div className={'alert ' + alertClass(txState.status) + ' mt-2 py-2 small'}>{txState.message}</div>;
  };

  return (
    <div>
      <h4>🏭 Producer Control Panel</h4>
      <p className="text-muted">Create the digital twin of a physical batch and manage custody transfer to distributors.</p>

      <div className="row g-4 mt-1">
        {/* register form */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header">➕ Register New Batch</div>
            <div className="card-body">
              <p className="card-text text-muted small">Uploads origin metadata to IPFS and anchors the CID to Ethereum, creating the product's provenance trail.</p>
              <form onSubmit={handleRegister}>
                <div className="mb-3">
                  <label className="form-label">Batch ID</label>
                  <input className="form-control" type="number"
                    placeholder="e.g. 1001"
                    value={regForm.prodId}
                    onChange={e => setRegForm({ ...regForm, prodId: e.target.value })}
                    required min="1"
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
                    onChange={e => setRegForm({...regForm, origin: e.target.value})}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Producer Batch ID</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="e.g. 5001 (stored in IPFS)"
                    value={regForm.producerBatchId}
                    onChange={function(e) { setRegForm({ ...regForm, producerBatchId: e.target.value }); }}
                    min="1"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Parent Batch ID <span className="text-muted small">(optional)</span></label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="e.g. 4000 (if derived from another batch)"
                    value={regForm.parentBatchId}
                    onChange={e => setRegForm({ ...regForm, parentBatchId: e.target.value })}
                    min="1"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Expiration Date <span className="text-muted small">(optional, stored in IPFS)</span></label>
                  <input
                    className="form-control"
                    type="date" value={regForm.expirationDate}
                    onChange={function(e) { setRegForm({ ...regForm, expirationDate: e.target.value }); }}
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
                  className="btn btn-primary" type="submit"
                  disabled={isRegistering}
                >
                  {isRegistering ? 'Uploading to IPFS & Blockchain...' : 'Create Product'}
                </button>
                {txAlert('register')}
              </form>
            </div>
          </div>
        </div>

        {/* ship to distributor */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header">🚚 Ship to Distributor</div>
            <div className="card-body">
              <p className="card-text text-muted small">Ships a registered batch to an authorized distributor in a single on-chain transaction. The product must be in <em>In Production</em> or <em>Ready to Ship</em> status.</p>
              {shipLoading && (
                <div className="text-muted small mb-2">Loading your batches and distributors...</div>
              )}
              {/* TODO: auto-refresh distList after a new role is assigned */}
              <form onSubmit={handleShipToDistributor}>
                <div className="mb-3">
                  <label className="form-label">Batch ID</label>
                  <select className="form-select" value={ship_form.prodId}
                    onChange={function(e) { setShipForm({...ship_form, prodId: e.target.value}); }}
                    required>
                    <option value="">— select your batch —</option>
                    {ownedProducts.map(p => (
                      <option key={p.prod_id} value={p.prod_id}>#{p.prod_id}{p.name ? ' — ' + p.name : ''}</option>
                    ))}
                  </select>
                  {!shipLoading && ownedProducts.length === 0 && (
                    <div className="form-text text-warning">No batches found in backend. Register a batch first or wait for sync.</div>
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label">Distributor</label>
                  <select
                    className="form-select"
                    value={ship_form.distributor}
                    onChange={e => setShipForm({ ...ship_form, distributor: e.target.value })}
                    required
                  >
                    <option value="">— select a distributor —</option>
                    {distList.map(function(u) {
                      const shortAddr = u.address.slice(0,6) + '…' + u.address.slice(-4);
                      return <option key={u.address} value={u.address}>{shortAddr}</option>;
                    })}
                  </select>
                  {!shipLoading && distList.length === 0 && (
                    <div className="form-text text-warning">No distributors registered on-chain yet.</div>
                  )}
                </div>
                <button
                  className="btn btn-success"
                  type="submit"
                  disabled={txState.type === 'ship' && txState.status === 'pending'}
                >
                  {txState.type === 'ship' && txState.status === 'pending' ? 'Processing...' : 'Ship to Distributor'}
                </button>
                {txAlert('ship')}
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* product lookup */}
      <div className="card mt-4">
        <div className="card-header">🔍 Product Lookup</div>
        <div className="card-body">
          <form className="d-flex gap-2" onSubmit={handleLookup}>
            <input
              className="form-control" type="number"
              placeholder="Enter Batch / Product ID"
              value={lookupId} onChange={e => setLookupId(e.target.value)}
              required min="1"
            />
            <button className="btn btn-secondary" type="submit">Look Up</button>
          </form>
          {lookupErr ? (
            <div className="alert alert-danger mt-2 py-2 small">{lookupErr}</div>
          ) : null}
        </div>
      </div>

      {lookup_prod_id && (
        <ProductDetailModal
          prodId={lookup_prod_id}
          onClose={function() { setLookupProdId(null); }}
        />
      )}
    </div>
  );
}

export default ProducerTab;
