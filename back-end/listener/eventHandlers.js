import db from '../db/db.js'
import {roleName, statusName} from '../utils/constants.js'
import { fetchAndCacheIpfs } from './ipfsFetcher.js'

export async function handleRoleAssigned(log, provider) {
  const address = log.args.user.toLowerCase()
  const role = Number(log.args.role)
  const ts = await getBlockTime(provider, log.blockNumber)

  db.prepare(`
    INSERT INTO users (address, role, role_name, assigned_at_block, assigned_tx_hash, updated_at)
    VALUES (@address, @role, @role_name, @block, @txHash, @ts)
    ON CONFLICT(address) DO UPDATE SET
      role = excluded.role,
      role_name = excluded.role_name,
      assigned_at_block = excluded.assigned_at_block,
      assigned_tx_hash = excluded.assigned_tx_hash,
      updated_at = excluded.updated_at
  `).run({
    address, role,
    role_name: roleName(role),
    block: log.blockNumber,
    txHash: log.transactionHash,
    ts
  })

  console.log(`[RoleAssigned] ${address} -> ${roleName(role)} (block ${log.blockNumber})`)
}

export async function handleProductCreated(log, provider) {
  const prodId = Number(log.args.prodId)
  const owner = log.args.producer.toLowerCase()
  const ipfsHash = log.args.ipfsHash
  const block = log.blockNumber
  const txHash = log.transactionHash

  db.prepare(`
    INSERT INTO products (prod_id, ipfs_hash, current_status, current_owner, created_at_block, created_tx_hash, last_updated_block, last_updated_tx, ipfs_synced)
    VALUES (@prodId, @ipfsHash, 0, @owner, @block, @txHash, @block, @txHash, 0)
    ON CONFLICT(prod_id) DO UPDATE SET
      ipfs_hash = excluded.ipfs_hash,
      current_owner = excluded.current_owner,
      created_at_block = excluded.created_at_block,
      created_tx_hash = excluded.created_tx_hash,
      last_updated_block = excluded.last_updated_block,
      last_updated_tx = excluded.last_updated_tx,
      ipfs_synced = 0
  `).run({ prodId, ipfsHash, owner, block, txHash })

  console.log(`[ProductCreated] prodId=${prodId} (block ${block})`)
  fetchAndCacheIpfs(prodId, ipfsHash).catch(err => console.error('[IPFS] failed for prodId=' + prodId, err.message))
}

export async function handleProductStatusChanged(log, provider) {
  const prodId = Number(log.args.prodId)
  const newStatus = Number(log.args.newStatus)
  const updatedBy = log.args.updatedBy.toLowerCase()
  const ipfsHash = log.args.ipfsHash
  const block = log.blockNumber
  const txHash = log.transactionHash
  const ts = await getBlockTime(provider, block)

  db.prepare('UPDATE products SET current_status = @newStatus, ipfs_hash = @ipfsHash, last_updated_block = @block, last_updated_tx = @txHash WHERE prod_id = @prodId')
    .run({ newStatus, ipfsHash, block, txHash, prodId })

  db.prepare(`
    INSERT INTO status_history (prod_id, new_status, new_status_name, updated_by, ipfs_hash, block_number, tx_hash, block_timestamp)
    VALUES (@prodId, @newStatus, @newStatusName, @updatedBy, @ipfsHash, @block, @txHash, @ts)
  `).run({ prodId, newStatus, newStatusName: statusName(newStatus), updatedBy, ipfsHash, block, txHash, ts })

  console.log(`[StatusChanged] prodId=${prodId} -> ${statusName(newStatus)} (block ${block})`)
}

export async function handleProductOwnershipTransferred(log, provider) {
  const prodId = Number(log.args.prodId)
  const prevOwner = log.args.previousOwner.toLowerCase()
  const newOwner = log.args.newOwner.toLowerCase()
  const block = log.blockNumber
  const txHash = log.transactionHash
  const ts = await getBlockTime(provider, block)

  db.prepare('UPDATE products SET current_owner = @newOwner, last_updated_block = @block, last_updated_tx = @txHash WHERE prod_id = @prodId')
    .run({ newOwner, block, txHash, prodId })

  db.prepare(`
    INSERT INTO ownership_history (prod_id, previous_owner, new_owner, block_number, tx_hash, block_timestamp)
    VALUES (@prodId, @prevOwner, @newOwner, @block, @txHash, @ts)
  `).run({ prodId, prevOwner, newOwner, block, txHash, ts })

  console.log(`[OwnershipTransferred] prodId=${prodId} ${prevOwner} -> ${newOwner}`)
}

// cache timestamps so we don't re-fetch the same block over and over
const tsCache = new Map()

async function getBlockTime(provider, blockNum) {
  if (tsCache.has(blockNum)) return tsCache.get(blockNum)
  try {
    const b = await provider.getBlock(blockNum)
    const ts = b ? new Date(b.timestamp * 1000).toISOString() : null
    tsCache.set(blockNum, ts)
    if (tsCache.size > 500) tsCache.delete(tsCache.keys().next().value)
    return ts
  } catch(e) {
    return null
  }
}

