import React, { useState, useEffect } from 'react';
import contract, { ROLES, switchToSepolia } from '../contract';
import { WalletNotConnected, alertClass } from './TabHelpers';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Role options for the dropdown
const ROLE_OPTIONS = [
  { label: 'Producer', value: 1 },
  { label: 'Consumer', value: 2 },
  { label: 'Distributor', value: 3 },
  { label: 'Retailer', value: 4 },
  { label: 'Admin', value: 5 },
];

function AdminTab(props) {
  const account = props.account;
  const role = props.role;
  const adminAddress = props.adminAddress;

  const isAdmin = role === 5;

  const [assignForm, setAssignForm] = useState({ address: '', role: '1' });
  const [lookupAddr, setLookupAddr] = useState('');
  const [lookupRole, setLookupRole] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [txState, setTxState] = useState({ status: null, message: '' });
  const [knownUsers, setKnownUsers] = useState([]);

  useEffect(function() {
    fetch(`${BACKEND_URL}/api/users`)
      .then(function(r) { return r.json(); })
      .then(function(data) { setKnownUsers(data.users || []); })
      .catch(function() {});
  }, []);

  // Pick badge color for a role number
  function roleBadgeColor(r) {
    if (r === 1) return 'bg-primary';
    if (r === 2) return 'bg-success';
    if (r === 3) return 'bg-info text-dark';
    if (r === 4) return 'bg-warning text-dark';
    if (r === 5) return 'bg-danger';
    return 'bg-secondary';
  }

  // Form submit for assigning a role
  async function handleAssignRole(e) {
    e.preventDefault();
    setTxState({ status: 'pending', message: 'Waiting for transaction confirmation...' });
    try {
      await switchToSepolia();
      await contract.methods
        .assignRole(assignForm.address, Number(assignForm.role))
        .send({ from: account, gas: '100000' });
      const roleLabel = ROLES[Number(assignForm.role)];
      const msg = 'Role "' + roleLabel + '" assigned to ' + assignForm.address;
      setTxState({ status: 'success', message: msg });
      setAssignForm({ address: '', role: '1' });
    } catch (err) {
      const errMsg = err.message || 'Transaction failed.';
      setTxState({ status: 'error', message: errMsg });
    }
  }

  // Look up role for an address
  async function handleLookupRole(e) {
    e.preventDefault();
    setLookupRole(null);
    setLookupError('');
    try {
      const r = await contract.methods.rolesMapping(lookupAddr).call();
      setLookupRole(Number(r));
    } catch (err) {
      setLookupError('Failed to fetch role. Check the address and try again.');
    }
  }

  if (!account) {
    return <WalletNotConnected roleName="Admin" />;
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-5">
        <div className="fs-1">🔐</div>
        <h4>Admin Access Required</h4>
        <p className="text-muted">Only the contract Admin can access this panel.</p>
        <p className="text-muted">Admin address: <code>{adminAddress || '—'}</code></p>
      </div>
    );
  }

  // Build the options list
  const roleOptionsList = ROLE_OPTIONS.map(function(opt) {
    return <option key={opt.value} value={opt.value}>{opt.label}</option>;
  });

  // Show tx feedback if there's a message
  let txAlert = null;
  if (txState.message) {
    txAlert = (
      <div className={'alert ' + alertClass(txState.status) + ' mt-2 py-2 small'}>
        {txState.message}
      </div>
    );
  }

  // Show lookup result if we got one
  let lookupResult = null;
  if (lookupRole !== null) {
    lookupResult = (
      <div className="mt-3">
        <span className="text-muted me-2">Current Role:</span>
        <span className={'badge ' + roleBadgeColor(lookupRole)}>
          {ROLES[lookupRole] || 'Unknown'}
        </span>
      </div>
    );
  }

  return (
    <div>
      <h4>🔐 Admin Panel</h4>
      <p className="text-muted">Assign and manage user roles across the supply chain.</p>

      <div className="row g-4 mt-1">
        {/* Assign Role */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">🎖️ Assign Role</div>
            <div className="card-body">
              <form onSubmit={handleAssignRole}>
                <div className="mb-3">
                  <label className="form-label">Wallet Address</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="0x..."
                    value={assignForm.address}
                    onChange={function(e) { setAssignForm({ address: e.target.value, role: assignForm.role }); }}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={assignForm.role}
                    onChange={function(e) { setAssignForm({ address: assignForm.address, role: e.target.value }); }}
                  >
                    {roleOptionsList}
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={txState.status === 'pending'}
                >
                  {txState.status === 'pending' ? 'Processing...' : 'Assign Role'}
                </button>
                {txAlert}
              </form>
            </div>
          </div>
        </div>

        {/* Look Up Role */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">🔎 Look Up Role</div>
            <div className="card-body">
              <form onSubmit={handleLookupRole}>
                <div className="mb-3">
                  <label className="form-label">Wallet Address</label>
                  <input
                    className="form-control"
                    type="text"
                    list="known-users-list"
                    placeholder="0x… or pick from list"
                    value={lookupAddr}
                    onChange={function(e) { setLookupAddr(e.target.value); }}
                    required
                  />
                  <datalist id="known-users-list">
                    {knownUsers.map(function(u) {
                      return (
                        <option key={u.address} value={u.address}>
                          {u.role_name} — {u.address.slice(0,6)}…{u.address.slice(-4)}
                        </option>
                      );
                    })}
                  </datalist>
                </div>
                <button className="btn btn-secondary" type="submit">Check Role</button>
                {lookupError ? (
                  <div className="alert alert-danger mt-2 py-2 small">{lookupError}</div>
                ) : null}
                {lookupResult}
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Admin address info */}
      <div className="card mt-4">
        <div className="card-body d-flex align-items-center gap-2">
          <span>ℹ️</span>
          <div>
            <strong>Contract Admin:</strong>{' '}
            <code className="small">{adminAddress}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminTab;
