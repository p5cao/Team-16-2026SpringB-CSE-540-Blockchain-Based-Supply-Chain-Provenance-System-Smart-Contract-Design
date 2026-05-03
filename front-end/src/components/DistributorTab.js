import React, { useCallback, useEffect, useState } from 'react';
import contract, { readContract, switchToSepolia } from '../contract';
import { WalletNotConnected, AccessDenied, alertClass } from './TabHelpers';
import ProductDetailModal from './ProductDetailModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

function TxAlert(props) {
  if (!props.visible || !props.message) return null;
  return (
    <div className={'alert ' + alertClass(props.status) + ' mt-2 py-2 small'}>
      {props.message}
    </div>
  );
}

function ProductStepForm(props) {
  const form = props.form;
  const setForm = props.setForm;
  const pending = props.pending;
  const productOptions = props.productOptions || [];

  return (
    <form onSubmit={props.onSubmit}>
      <div className="mb-3">
        <label className="form-label">Product ID</label>
        <select
          className="form-select"
          value={form.prodId}
          onChange={function(e) { var pid = e.target.value; var found = (props.productsData || []).find(function(p) { return String(p.prod_id) === String(pid); }); setForm({ prodId: pid, ipfsHash: found ? (found.ipfs_hash || '') : '' }); }}
          required
        >
          <option value="">{props.placeholder}</option>
          {productOptions}
        </select>
        {!props.loading && productOptions.length === 0 ? (
          <div className="form-text text-warning">{props.emptyMessage}</div>
        ) : null}
      </div>
      <div className="mb-3">
        <label className="form-label">IPFS Hash</label>
        <input
          className="form-control"
          type="text"
          placeholder="Auto-populated from product record"
          value={form.ipfsHash}
          onChange={function(e) { setForm({ prodId: form.prodId, ipfsHash: e.target.value }); }}
          disabled
          required
        />
      </div>
      <button className={'btn ' + props.buttonClass} type="submit" disabled={pending}>
        {pending ? 'Processing...' : props.buttonText}
      </button>
      {props.children}
    </form>
  );
}

function DistributorTab(props) {
  const account = props.account;
  const role = props.role;
  const isDistributor = role === 3;

  const [receiveForm, setReceiveForm] = useState({ prodId: '', ipfsHash: '' });
  const [qcForm, setQcForm] = useState({ prodId: '', ipfsHash: '' });
  const [storeForm, setStoreForm] = useState({ prodId: '', ipfsHash: '' });
  const [shipForm, setShipForm] = useState({ prodId: '', retailer: '', ipfsHash: '' });
  const [returnForm, setReturnForm] = useState({ prodId: '', ipfsHash: '' });
  const [distributorProducts, setDistributorProducts] = useState([]);
  const [returnableProducts, setReturnableProducts] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [lookupProdId, setLookupProdId] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [txState, setTxState] = useState({ type: null, status: null, message: '' });

  const refreshDbLists = useCallback(function() {
    if (!account || !isDistributor) return;
    setDbLoading(true);
    Promise.all([
      fetch(`${BACKEND_URL}/api/users/${account}/products`).then(function(r) { return r.json(); }).catch(function() { return {}; }),
      fetch(`${BACKEND_URL}/api/products?status=10&limit=100`).then(function(r) { return r.json(); }).catch(function() { return {}; }),
      fetch(`${BACKEND_URL}/api/users?role=4`).then(function(r) { return r.json(); }).catch(function() { return {}; })
    ]).then(function(results) {
      const productResp = results[0];
      const returnResp = results[1];
      const retailerResp = results[2];
      setDistributorProducts(Array.isArray(productResp.products) ? productResp.products : []);
      setReturnableProducts(Array.isArray(returnResp.products) ? returnResp.products : []);
      setRetailers(Array.isArray(retailerResp.users) ? retailerResp.users : []);
    }).finally(function() {
      setDbLoading(false);
    });
  }, [account, isDistributor]);

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

  function productOptions(products, statuses) {
    return products
      .filter(function(product) { return statuses.indexOf(Number(product.current_status)) >= 0; })
      .map(function(product) {
        return <option key={product.prod_id} value={product.prod_id}>{productLabel(product)}</option>;
      });
  }

  async function sendProductStep(type, methodName, form, resetForm, successMessage) {
    setTx(type, 'pending', 'Waiting for transaction confirmation...');
    try {
      await switchToSepolia();
      await contract.methods[methodName](form.prodId, form.ipfsHash)
        .send({ from: account, gas: '300000' });
      setTx(type, 'success', successMessage(form.prodId));
      resetForm({ prodId: '', ipfsHash: '' });
      refreshDbLists();
    } catch (err) {
      setTx(type, 'error', err.message || 'Transaction failed.');
    }
  }

  async function handleReceive(e) {
    e.preventDefault();
    await sendProductStep(
      'receive',
      'receiveAtWarehouse',
      receiveForm,
      setReceiveForm,
      function(prodId) { return 'Product #' + prodId + ' received at warehouse.'; }
    );
  }

  async function handleQc(e) {
    e.preventDefault();
    await sendProductStep(
      'qc',
      'passWarehouseQualityCheck',
      qcForm,
      setQcForm,
      function(prodId) { return 'Warehouse quality check passed for product #' + prodId + '.'; }
    );
  }

  async function handleStore(e) {
    e.preventDefault();
    await sendProductStep(
      'store',
      'storeInWarehouse',
      storeForm,
      setStoreForm,
      function(prodId) { return 'Product #' + prodId + ' stored in warehouse.'; }
    );
  }

  async function handleReceiveReturn(e) {
    e.preventDefault();
    await sendProductStep(
      'return',
      'receiveReturnedFromRetailer',
      returnForm,
      setReturnForm,
      function(prodId) { return 'Returned product #' + prodId + ' received back into warehouse.'; }
    );
  }

  async function handleShipToRetailer(e) {
    e.preventDefault();
    setTx('ship', 'pending', 'Waiting for transaction confirmation...');
    try {
      await switchToSepolia();
      await contract.methods
        .shipToRetailer(shipForm.prodId, shipForm.retailer, shipForm.ipfsHash)
        .send({ from: account, gas: '300000' });
      setTx('ship', 'success', 'Product #' + shipForm.prodId + ' shipped to retailer ' + shipForm.retailer + '.');
      setShipForm({ prodId: '', retailer: '', ipfsHash: '' });
      refreshDbLists();
    } catch (err) {
      setTx('ship', 'error', err.message || 'Transaction failed.');
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
    return <WalletNotConnected roleName="Distributor" />;
  }

  if (!isDistributor) {
    return <AccessDenied icon="🏬" roleName="Distributor" />;
  }

  return (
    <div>
      <h4>🏬 Distributor Dashboard</h4>
      <p className="text-muted">Receive producer shipments, perform warehouse checks, store inventory, and ship approved products to retailers.</p>
      {dbLoading ? (
        <div className="text-muted small mb-2">Loading products and retailers from backend...</div>
      ) : null}

      <div className="row g-4 mt-1">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header">📦 Receive At Warehouse</div>
            <div className="card-body">
              <p className="card-text text-muted small">Accept a product shipped by the producer into distributor custody.</p>
              <ProductStepForm
                form={receiveForm}
                setForm={setReceiveForm}
                onSubmit={handleReceive}
                productsData={distributorProducts}
                pending={txState.type === 'receive' && txState.status === 'pending'}
                loading={dbLoading}
                placeholder="-- select inbound product --"
                productOptions={productOptions(distributorProducts, [2])}
                emptyMessage="No products are currently in transit to this distributor."
                buttonClass="btn-primary"
                buttonText="Receive Product"
              >
                <TxAlert visible={txState.type === 'receive'} status={txState.status} message={txState.message} />
              </ProductStepForm>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header">✅ Warehouse QC</div>
            <div className="card-body">
              <p className="card-text text-muted small">Record warehouse quality check approval after receiving the product.</p>
              <ProductStepForm
                form={qcForm}
                setForm={setQcForm}
                onSubmit={handleQc}
                productsData={distributorProducts}
                pending={txState.type === 'qc' && txState.status === 'pending'}
                loading={dbLoading}
                placeholder="-- select received product --"
                productOptions={productOptions(distributorProducts, [3])}
                emptyMessage="No received warehouse products are ready for QC."
                buttonClass="btn-success"
                buttonText="Pass QC"
              >
                <TxAlert visible={txState.type === 'qc'} status={txState.status} message={txState.message} />
              </ProductStepForm>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header">🏬 Store In Warehouse</div>
            <div className="card-body">
              <p className="card-text text-muted small">Move a quality-checked product into warehouse inventory.</p>
              <ProductStepForm
                form={storeForm}
                setForm={setStoreForm}
                onSubmit={handleStore}
                productsData={distributorProducts}
                pending={txState.type === 'store' && txState.status === 'pending'}
                loading={dbLoading}
                placeholder="-- select quality-checked product --"
                productOptions={productOptions(distributorProducts, [4])}
                emptyMessage="No quality-checked products are ready for warehouse storage."
                buttonClass="btn-secondary"
                buttonText="Store Product"
              >
                <TxAlert visible={txState.type === 'store'} status={txState.status} message={txState.message} />
              </ProductStepForm>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mt-1">
        <div className="col-md-8">
          <div className="card h-100">
            <div className="card-header">🚛 Ship To Retailer</div>
            <div className="card-body">
              <p className="card-text text-muted small">Send warehouse inventory to an authorized retailer so they can receive it in the Retailer tab.</p>
              <form onSubmit={handleShipToRetailer}>
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label">Product ID</label>
                    <select
                      className="form-select"
                      value={shipForm.prodId}
                      onChange={function(e) { var pid = e.target.value; var found = distributorProducts.find(function(p) { return String(p.prod_id) === String(pid); }); setShipForm({ prodId: pid, retailer: shipForm.retailer, ipfsHash: found ? (found.ipfs_hash || '') : '' }); }}
                      required
                    >
                      <option value="">-- select warehouse product --</option>
                      {productOptions(distributorProducts, [6])}
                    </select>
                    {!dbLoading && productOptions(distributorProducts, [6]).length === 0 ? (
                      <div className="form-text text-warning">No warehouse products are ready to ship.</div>
                    ) : null}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Retailer Address</label>
                    <input
                      className="form-control"
                      type="text"
                      list="retailer-list"
                      placeholder="0x... or pick from list"
                      value={shipForm.retailer}
                      onChange={function(e) { setShipForm({ prodId: shipForm.prodId, retailer: e.target.value, ipfsHash: shipForm.ipfsHash }); }}
                      required
                    />
                    <datalist id="retailer-list">
                      {retailers.map(function(u) {
                        return (
                          <option key={u.address} value={u.address}>
                            {u.address.slice(0, 6)}...{u.address.slice(-4)}
                          </option>
                        );
                      })}
                    </datalist>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">IPFS Hash</label>
                    <input
                      className="form-control"
                      type="text"
                      placeholder="Auto-populated from product record"
                      value={shipForm.ipfsHash}
                      onChange={function(e) { setShipForm({ prodId: shipForm.prodId, retailer: shipForm.retailer, ipfsHash: e.target.value }); }}
                      disabled
                      required
                    />
                  </div>
                  <div className="col-md-2 d-flex align-items-end">
                    <button
                      className="btn btn-primary w-100"
                      type="submit"
                      disabled={txState.type === 'ship' && txState.status === 'pending'}
                    >
                      {txState.type === 'ship' && txState.status === 'pending' ? 'Processing...' : 'Ship'}
                    </button>
                  </div>
                </div>
                <TxAlert visible={txState.type === 'ship'} status={txState.status} message={txState.message} />
              </form>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header">↩️ Receive Return</div>
            <div className="card-body">
              <p className="card-text text-muted small">Accept a product that the retailer marked for warehouse return.</p>
              <ProductStepForm
                form={returnForm}
                setForm={setReturnForm}
                onSubmit={handleReceiveReturn}
                productsData={returnableProducts}
                pending={txState.type === 'return' && txState.status === 'pending'}
                loading={dbLoading}
                placeholder="-- select returned product --"
                productOptions={productOptions(returnableProducts, [10])}
                emptyMessage="No products are currently marked as returned by retailers."
                buttonClass="btn-warning"
                buttonText="Receive Return"
              >
                <TxAlert visible={txState.type === 'return'} status={txState.status} message={txState.message} />
              </ProductStepForm>
            </div>
          </div>
        </div>
      </div>

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

export default DistributorTab;
