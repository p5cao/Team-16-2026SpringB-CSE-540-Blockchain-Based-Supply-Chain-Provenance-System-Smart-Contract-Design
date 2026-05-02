/**
 * Consumer-facing API: aggregated indexer reads + optional on-chain relay purchase.
 * Contract still enforces Role.Consumer on msg.sender (relay wallet must be Consumer).
 */
import { Router } from 'express';
import { ethers } from 'ethers';
import db from '../../db/db.js';

const router = Router();

const WRITE_IFACE = [
  'function purchaseProduct(uint256 prodId, string ipfsHash)',
  'function rolesMapping(address) view returns (uint8)',
];

/**
 * GET /api/consumer/products/:prodId/history
 * Single response: DB snapshot + ownership + status timelines (from indexed chain events).
 * IPFS-enriched fields live on `products` / `status_history.ipfs_hash` when listener synced.
 */
router.get('/products/:prodId/history', (req, res) => {
  const id = parseInt(req.params.prodId, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'prodId must be an integer' });
  }

  const product = db.prepare('SELECT * FROM products WHERE prod_id = ?').get(id);
  const ownership_history = db
    .prepare(
      'SELECT * FROM ownership_history WHERE prod_id = ? ORDER BY block_number ASC, id ASC'
    )
    .all(id);
  const status_history = db
    .prepare(
      'SELECT * FROM status_history WHERE prod_id = ? ORDER BY block_number ASC, id ASC'
    )
    .all(id);

  res.json({
    prod_id: id,
    source: 'sqlite_indexer',
    product: product || null,
    ownership_history,
    status_history,
    counts: {
      ownership: ownership_history.length,
      status: status_history.length,
    },
  });
});

/**
 * POST /api/consumer/purchase
 * Body: { prodId: number|string, saleIpfsHash: string }
 * Relayer must hold Consumer on-chain (same permission model as contract).
 */
router.post('/purchase', async (req, res) => {
  const pk = process.env.CONSUMER_RELAYER_PRIVATE_KEY;
  if (!pk) {
    return res.status(501).json({
      error: 'CONSUMER_RELAYER_PRIVATE_KEY not set',
      hint: 'Admin assigns Role.Consumer to this key’s address; used only for demo relay.',
    });
  }

  const contractAddress = process.env.CONTRACT_ADDRESS;
  const rpcUrl = process.env.RPC_URL;
  if (!contractAddress || !rpcUrl) {
    return res.status(500).json({ error: 'CONTRACT_ADDRESS and RPC_URL required' });
  }

  const { prodId, saleIpfsHash } = req.body || {};
  if (prodId === undefined || saleIpfsHash === undefined) {
    return res.status(400).json({ error: 'prodId and saleIpfsHash required' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(pk, provider);
    const contract = new ethers.Contract(contractAddress, WRITE_IFACE, wallet);
    const role = await contract.rolesMapping(wallet.address);
    if (Number(role) !== 2) {
      return res.status(403).json({
        error: 'Relay wallet is not Consumer on-chain',
        relayer: wallet.address,
      });
    }
    const tx = await contract.purchaseProduct(BigInt(prodId), String(saleIpfsHash));
    const receipt = await tx.wait();
    return res.json({
      ok: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: e.shortMessage || e.message || 'purchase_failed' });
  }
});

export default router;
