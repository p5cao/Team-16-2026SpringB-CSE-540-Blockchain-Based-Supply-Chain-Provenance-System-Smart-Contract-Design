import React, { useState, useEffect } from 'react';
import { readContract, PRODUCT_STATUSES } from '../contract';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
const IPFS_GATEWAY = 'https://beige-obliged-woodpecker-273.mypinata.cloud/ipfs';

const STATUS_BADGE_CLS = {
  0: 'bg-secondary',
  1: 'bg-primary',  2: 'bg-info text-dark', 3: 'bg-info text-dark',
  4: 'bg-success', 5: 'bg-warning text-dark',
  6: 'bg-success', 7: 'bg-info text-dark', 8: 'bg-info text-dark', 9: 'bg-success',
  10: 'bg-warning text-dark', 11: 'bg-primary',
  12: 'bg-dark',
};

function DetailRow({ label, value }) {
  return (
    <tr>
      <th scope="row"
        className="text-muted fw-normal ps-3 text-nowrap"
        style={{ width: '180px' }}>{label}</th>
      <td className="text-break">{value ?? <span className="text-muted fst-italic">—</span>}</td>
    </tr>
  );
}

function ProductDetailModal({ prodId, onClose }) {
  const [chain, setChain] = useState(null);
  const [ipfsData,setIpfsData] = useState(null);
  const [dbData, setDbData]         = useState(null);
  const [chain_loading, setChainLoad] = useState(false);
  const [ipfsLoading, setIpfsLoading]   = useState(false);
  const [dbLoad,setDbLoad] = useState(false);
  const [chainErr, setChainErr] = useState('');

  useEffect(() => {
    if (!prodId) return;

    // reset everything when prodId changes
    setChain(null);
    setIpfsData(null);
    setDbData(null);

    setChainErr('');

    // fetch on-chain data first
    setChainLoad(true);
    readContract.methods.getProduct(prodId).call()
      .then(result => {
        setChain(result);
        // if theres an ipfs hash, go grab the metadata too
        // TODO: add a loading timeout here, pinata can be slow
        if (result.ipfsHash) {
          setIpfsLoading(true);
          fetch(`${IPFS_GATEWAY}/${result.ipfsHash}`)
            .then(r => r.ok ? r.json() : null)
            .then(function(data) { setIpfsData(data); })
            .catch(() => setIpfsData(null))
            .finally(() => setIpfsLoading(false));
        }
      })
      .catch(err => {
        const msg = err.message || '';
        setChainErr(msg.includes('does not exist')
          ? `Product #${prodId} does not exist on-chain.`
          : 'Chain lookup failed: ' + msg);
      })
      .finally(() => setChainLoad(false));

    // also hit the backend db in parallel
    setDbLoad(true);
    fetch(`${BACKEND_URL}/api/products/${prodId}`)
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(data => setDbData(data))
      .catch(() => setDbData(null))
      .finally(() => setDbLoad(false));
  }, [prodId]);

  if (!prodId) return null;

  const status_num = chain ? Number(chain.currentStatus) : null;

  const statusTxt    = status_num !== null ? (PRODUCT_STATUSES[status_num] || 'Unknown') : '';
  const BadgeCls = status_num !== null ? (STATUS_BADGE_CLS[status_num] || 'bg-secondary') : '';

  const ipfs_hash     = chain?.ipfsHash || '';
  const ipfsURL = ipfs_hash ? `${IPFS_GATEWAY}/${ipfs_hash}` : null;

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop show" style={{ zIndex: 1040 }} onClick={onClose} />

      {/* Modal */}
      <div
        className="modal show d-block"
        tabIndex="-1"
        style={{ zIndex: 1050 }}
        role="dialog"
        aria-modal="true"
        onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">

            {/* Header */}
            <div className="modal-header">
              <div className="d-flex align-items-center gap-2">
                <h5 className="modal-title mb-0">Product #{prodId}</h5>
                {statusTxt && <span className={`badge ${BadgeCls}`}>{statusTxt}</span>}
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            {/* Body */}
            <div className="modal-body">
              {chain_loading && (
                <div className="text-center text-muted py-4">Loading on-chain data…</div>
              )}
              {chainErr && (
                <div className="alert alert-danger">{chainErr}</div>
              )}

              {chain && (
                <>
                  {/* on-chain stuff */}
                  <div className="card mb-3">
                    <div className="card-header py-2 fw-semibold small">⛓️ Blockchain Data</div>
                    <div className="card-body p-0">
                      <table className="table table-sm table-borderless mb-0">
                        <tbody>
                          <DetailRow label="Batch / Product ID" value={chain.prodId?.toString()} />
                          <DetailRow label="Current Status" value={statusTxt} />
                          <DetailRow
                            label="Current Owner"
                            value={<code className="small">{chain.currentOwner}</code>} />
                          <DetailRow label="IPFS Hash" value={
                            ipfsURL
                              ? <a href={ipfsURL} target="_blank" rel="noopener noreferrer"><code className="small">{ipfs_hash}</code></a>
                              : <code className="small">{ipfs_hash || '—'}</code>
                          } />
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ipfs metadata section */}
                  <div className="card mb-3">
                    <div className="card-header py-2 fw-semibold small d-flex justify-content-between">
                      <span>📄 IPFS Metadata</span>
                      {ipfsURL && (
                        <a href={ipfsURL} target="_blank" rel="noopener noreferrer" className="small fw-normal">open ↗</a>
                      )}
                    </div>
                    <div className="card-body p-0">
                      {ipfsLoading && <div className="p-3 text-muted small">Fetching IPFS data…</div>}
                      {!ipfsLoading && !ipfsData && (
                        <div className="p-3 text-muted small fst-italic">
                          IPFS data unavailable (gateway may require authentication).
                        </div>
                      )}
                      {!ipfsLoading && ipfsData && (
                        <table className="table table-sm table-borderless mb-0">
                          <tbody>
                            <DetailRow label="Name" value={ipfsData.name} />
                            <DetailRow label="Producer Wallet" value={ipfsData.producer_wallet ? <code className="small">{ipfsData.producer_wallet}</code> : null} />
                            <DetailRow label="Producer Batch ID" value={ipfsData.producer_batch_id} />
                            <DetailRow label="Current Batch ID" value={ipfsData.current_batch_id} />
                            <DetailRow
                              label="Parent Batch ID"
                              value={ipfsData.parent_batch_id} />
                            <DetailRow label="Expiration Date" value={ipfsData.expiration_date} />
                            <DetailRow label="Certificate" value={ipfsData.certificate ? <a href={ipfsData.certificate} target="_blank" rel="noopener noreferrer">{ipfsData.certificate}</a> : null} />
                            <DetailRow label="Origin" value={ipfsData.attributes?.origin} />
                            <DetailRow
                              label="Registered At" value={ipfsData.attributes?.registered_at} />
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* backend db - shows indexed data */}
                  {/* TODO: show ownership + status history tabs here someday */}
                  <div className="card mb-1">
                    <div className="card-header py-2 fw-semibold small">🗄️ Database (Backend)</div>
                    <div className="card-body p-0">
                      {dbLoad && <div className="p-3 text-muted small">Fetching backend data…</div>}
                      {!dbLoad && !dbData && (
                        <div className="p-3 text-muted small fst-italic">
                          Not yet indexed in backend database (sync may be pending).
                        </div>
                      )}
                      {!dbLoad && dbData && (
                        <table className="table table-sm table-borderless mb-0">
                          <tbody>
                            <DetailRow label="Name" value={dbData.name} />
                            <DetailRow
                              label="Producer Wallet"
                              value={dbData.producer_wallet ? <code className="small">{dbData.producer_wallet}</code> : null} />
                            <DetailRow
                              label="Producer Batch ID"
                              value={dbData.producer_batch_id}
                            />
                            <DetailRow label="Current Batch ID" value={dbData.current_batch_id} />
                            <DetailRow label="Parent Batch ID" value={dbData.parent_batch_id} />
                            <DetailRow label="Expiration Date" value={dbData.expiration_date} />
                            <DetailRow label="Origin" value={dbData.origin} />
                            <DetailRow label="Certificate" value={dbData.certificate
                              ? <a href={dbData.certificate} target="_blank" rel="noopener noreferrer">{dbData.certificate}</a>
                              : null} />
                            <DetailRow label="Registered At" value={dbData.registered_at} />
                            <DetailRow label="IPFS Synced" value={dbData.ipfs_synced ? '✅ Yes' : '⏳ Pending'} />
                            <DetailRow label="Created at Block" value={dbData.created_at_block} />
                            <DetailRow label="Created Tx" value={dbData.created_tx_hash ? <code className="small">{dbData.created_tx_hash}</code> : null} />
                            <DetailRow
                              label="Last Updated Block"
                              value={dbData.last_updated_block} />
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductDetailModal;
