import React, { useCallback, useEffect, useState } from 'react';
import contract, { readContract, switchToSepolia } from '../contract';
import { WalletNotConnected, AccessDenied, alertClass } from './TabHelpers';
import ProductDetailModal from './ProductDetailModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

function RetailerTab(props) {
  const account = props.account;
  const role = props.role;

  const isRetailer = role === 4;

  const [receiveForm, setReceiveForm] = useState({ prodId: '', ipfsHash: '' });
  const [storeForm, setStoreForm] = useState({ prodId: '', ipfsHash: '' });
  const [returnForm, setReturnForm] = useState({ prodId: '', ipfsHash: '' });
  const [retailerProducts, setRetailerProducts] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [lookupProdId, setLookupProdId] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [txState, setTxState] = useState({ type: null, status: null, message: '' });

  const refreshDbLists = useCallback(function() {
    if (!account || !isRetailer) return;
    setDbLoading(true);
    Promise.all([
      fetch(`${BACKEND_URL}/api/users/${account}/products`).then(function(r) { return r.json(); }).catch(function() { return {}; }),
      fetch(`${BACKEND_URL}/api/users?role=3`).then(function(r) { return r.json(); }).catch(function() { return {}; })
    ]).then(function(results) {
      const productResp = results[0];
      const distributorResp = results[1];
      setRetailerProducts(Array.isArray(productResp.products) ? productResp.products : []);
      setDistributors(Array.isArray(distributorResp.users) ? distributorResp.users : []);
    }).finally(function() {
      setDbLoading(false);
    });
  }, [account, isRetailer]);

  useEffect(function() {
    refreshDbLists();
  }, [refreshDbLists]);

  function setTx(type, status, message) {
    setTxState({ type: type, status: status, message: message });
  }

  function productLabel(product) {
    const name = product.name ? ' - ' + product.name : '';
    return '#' + product.prod_id + name;
  }

  function productOptions(statuses) {
    return retailerProducts
      .filter(function(product) { return statuses.indexOf(Number(product.current_status)) >= 0; })
      .map(function(product) {
        return <option key={product.prod_id} value={product.prod_id}>{productLabel(product)}</option>;
      });
  }

  function distributorOptions() {
    return distributors.map(function(user) {
      return (
        <option key={user.address} value={user.address}>
          {user.address.slice(0, 6)}...{user.address.slice(-4)}
        </option>
      );
    });
  }

  async function handleReceiveProduct(e) {
    e.preventDefault();
    setTx('receive', 'pending', 'Waiting for transaction confirmation...');
    try {
      await switchToSepolia();
      await contract.methods
        .retailerReceiveProduct(receiveForm.prodId, receiveForm.ipfsHash)
        .send({ from: account, gas: '300000' });
      setTx('receive', 'success', 'Product #' + receiveForm.prodId + ' received and quality checked.');
      setReceiveForm({ prodId: '', ipfsHash: '' });
      refreshDbLists();
    } catch (err) {
      setTx('receive', 'error', err.message || 'Transaction failed.');
    }
  }

  async function handlePlaceInStore(e) {
    e.preventDefault();
    setTx('store', 'pending', 'Waiting for transaction confirmation...');
    try {
      await switchToSepolia();
      await contract.methods
        .placeInStore(storeForm.prodId, storeForm.ipfsHash)
        .send({ from: account, gas: '300000' });
      setTx('store', 'success', 'Product #' + storeForm.prodId + ' placed in store.');
      setStoreForm({ prodId: '', ipfsHash: '' });
      refreshDbLists();
    } catch (err) {
      setTx('store', 'error', err.message || 'Transaction failed.');
    }
  }

  async function handleReturnToWarehouse(e) {
    e.preventDefault();
    setTx('return', 'pending', 'Waiting for transaction confirmation...');
    try {
      await switchToSepolia();
      await contract.methods
        .returnToWarehouse(returnForm.prodId, returnForm.ipfsHash)
        .send({ from: account, gas: '300000' });
      setTx('return', 'success', 'Product #' + returnForm.prodId + ' marked for return to warehouse.');
      setReturnForm({ prodId: '', ipfsHash: '' });
      refreshDbLists();
    } catch (err) {
      setTx('return', 'error', err.message || 'Transaction failed.');
    }
  }

  async function handleLookup(e) {
    e.preventDefault();
    setLookupProdId(null);
    setLookupError('');
    try {
      await readContract.methods.getProduct(lookupId).call();
      setLookupProdId(Number(lookupId));
    } catch (err) {
      const errMsg = err.message || '';
      if (errMsg.includes('Product does not exist')) {
        setLookupError('No product found with ID ' + lookupId + '.');
      } else {
        setLookupError('Lookup failed: ' + errMsg);
      }
    }
  }

  if (!account) {
    return <WalletNotConnected roleName="Retailer" />;
  }

  if (!isRetailer) {
    return <AccessDenied icon="🛍️" roleName="Retailer" />;
  }

  let receiveAlert = null;
  if (txState.type === 'receive' && txState.message) {
    receiveAlert = (
      <div className={'alert ' + alertClass(txState.status) + ' mt-2 py-2 small'}>
        {txState.message}
      </div>
    );
  }

  let storeAlert = null;
  if (txState.type === 'store' && txState.message) {
    storeAlert = (
      <div className={'alert ' + alertClass(txState.status) + ' mt-2 py-2 small'}>
        {txState.message}
      </div>
    );
  }

  let returnAlert = null;
  if (txState.type === 'return' && txState.message) {
    returnAlert = (
      <div className={'alert ' + alertClass(txState.status) + ' mt-2 py-2 small'}>
        {txState.message}
      </div>
    );
  }

  return (
    <div>
      <h4>🛍️ Retailer Dashboard</h4>
      <p className="text-muted">Handle incoming shipments, store inventory, and return rejected products to the warehouse.</p>
      {dbLoading ? (
        <div className="text-muted small mb-2">Loading products and distributors from backend...</div>
      ) : null}

      <div className="row g-4 mt-1">
        {/* Receive Product */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">📬 Receive Product</div>
            <div className="card-body">
              <p className="card-text text-muted small">Confirm a distributor shipment and mark retailer quality check passed.</p>
              <form onSubmit={handleReceiveProduct}>
                <div className="mb-3">
                  <label className="form-label">Product ID</label>
                  <select
                    className="form-select"
                    value={receiveForm.prodId}
                    onChange={function(e) { setReceiveForm({ prodId: e.target.value, ipfsHash: receiveForm.ipfsHash }); }}
                    required
                  >
                    <option value="">-- select shipped product --</option>
                    {productOptions([8])}
                  </select>
                  {!dbLoading && productOptions([8]).length === 0 ? (
                    <div className="form-text text-warning">No products are currently shipped to this retailer.</div>
                  ) : null}
                </div>
                <div className="mb-3">
                  <label className="form-label">Updated IPFS Hash</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="QmXxxx..."
                    value={receiveForm.ipfsHash}
                    onChange={function(e) { setReceiveForm({ prodId: receiveForm.prodId, ipfsHash: e.target.value }); }}
                    required
                  />
                </div>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={txState.type === 'receive' && txState.status === 'pending'}
                >
                  {txState.type === 'receive' && txState.status === 'pending' ? 'Processing...' : 'Confirm Receipt'}
                </button>
                {receiveAlert}
              </form>
            </div>
          </div>
        </div>

        {/* Place In Store */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">🛒 Place In Store</div>
            <div className="card-body">
              <p className="card-text text-muted small">Move an approved product into store inventory for consumer purchase.</p>
              <form onSubmit={handlePlaceInStore}>
                <div className="mb-3">
                  <label className="form-label">Product ID</label>
                  <select
                    className="form-select"
                    value={storeForm.prodId}
                    onChange={function(e) { setStoreForm({ prodId: e.target.value, ipfsHash: storeForm.ipfsHash }); }}
                    required
                  >
                    <option value="">-- select received product --</option>
                    {productOptions([9])}
                  </select>
                  {!dbLoading && productOptions([9]).length === 0 ? (
                    <div className="form-text text-warning">No retailer quality-checked products are ready for store placement.</div>
                  ) : null}
                </div>
                <div className="mb-3">
                  <label className="form-label">Updated IPFS Hash</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="QmXxxx..."
                    value={storeForm.ipfsHash}
                    onChange={function(e) { setStoreForm({ prodId: storeForm.prodId, ipfsHash: e.target.value }); }}
                    required
                  />
                </div>
                <button
                  className="btn btn-success"
                  type="submit"
                  disabled={txState.type === 'store' && txState.status === 'pending'}
                >
                  {txState.type === 'store' && txState.status === 'pending' ? 'Processing...' : 'Place In Store'}
                </button>
                {storeAlert}
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Return To Warehouse */}
      <div className="card mt-4">
        <div className="card-header">↩️ Return To Warehouse</div>
        <div className="card-body">
          <p className="card-text text-muted small">Mark a retailer-held product as returned so the distributor can receive it back.</p>
          <form onSubmit={handleReturnToWarehouse}>
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Product ID</label>
                <select
                  className="form-select"
                  value={returnForm.prodId}
                  onChange={function(e) { setReturnForm({ prodId: e.target.value, ipfsHash: returnForm.ipfsHash }); }}
                  required
                >
                  <option value="">-- select product --</option>
                  {productOptions([8, 9, 11])}
                </select>
                {!dbLoading && productOptions([8, 9, 11]).length === 0 ? (
                  <div className="form-text text-warning">No retailer-held products are returnable.</div>
                ) : null}
              </div>
              <div className="col-md-3">
                <label className="form-label">Distributor</label>
                <select className="form-select" disabled defaultValue="">
                  <option value="">-- backend list --</option>
                  {distributorOptions()}
                </select>
                <div className="form-text">Reference only; the contract return function does not take a distributor address.</div>
              </div>
              <div className="col-md-4">
                <label className="form-label">Updated IPFS Hash</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="QmXxxx..."
                  value={returnForm.ipfsHash}
                  onChange={function(e) { setReturnForm({ prodId: returnForm.prodId, ipfsHash: e.target.value }); }}
                  required
                />
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button
                  className="btn btn-warning w-100"
                  type="submit"
                  disabled={txState.type === 'return' && txState.status === 'pending'}
                >
                  {txState.type === 'return' && txState.status === 'pending' ? 'Processing...' : 'Return'}
                </button>
              </div>
            </div>
            {returnAlert}
          </form>
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
        </div>
      </div>

      {lookupProdId ? (
        <ProductDetailModal
          prodId={lookupProdId}
          onClose={function() { setLookupProdId(null); }}
        />
      ) : null}
    </div>
  );
}

export default RetailerTab;
