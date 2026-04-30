import db from '../db/db.js'
import {roleName, statusName} from '../utils/constants.js'
import {fetchAndCacheIpfs} from './ipfsFetcher.js'

export async function handleRoleAssigned(log, provider) {
  const userAddr = log.args.user.toLowerCase()
  const roleNum = Number(log.args.role)
  // TODO: maybe emit socket event here later

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
    address: userAddr, role: roleNum,
    role_name: roleName(roleNum),
    block: log.blockNumber,
    txHash:log.transactionHash,
    ts: await getBlockTime(provider, log.blockNumber)
  })

  console.log(`[RoleAssigned] ${userAddr} -> ${roleName(roleNum)} (block ${log.blockNumber})`)
}

export async function handleProductCreated(log,provider) {
  const prodId = Number(log.args.prodId)
  const ipfsHash = log.args.ipfsHash
  // not using prodId check here, db constraint handles dupes

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
  `).run({prodId, ipfsHash, owner: log.args.producer.toLowerCase(), block: log.blockNumber, txHash: log.transactionHash})

  console.log(`[ProductCreated] prodId=${prodId} (block ${log.blockNumber})`)
  fetchAndCacheIpfs(prodId, ipfsHash).catch(err => console.error('[IPFS] failed for prodId='+prodId, err.message))
}

export async function handleProductStatusChanged(log, provider) {
  const productId = Number(log.args.prodId)
  const new_status = Number(log.args.newStatus)

  db.prepare('UPDATE products SET current_status = @new_status, ipfs_hash = @ipfsHash, last_updated_block = @block, last_updated_tx = @txHash WHERE prod_id = @productId')
    .run({new_status, ipfsHash: log.args.ipfsHash, block: log.blockNumber, txHash: log.transactionHash, productId})

  db.prepare(`
    INSERT INTO status_history (prod_id, new_status, new_status_name, updated_by, ipfs_hash, block_number, tx_hash, block_timestamp)
    VALUES (@productId, @new_status, @newStatusName, @updatedBy, @ipfsHash, @block, @txHash, @ts)
  `).run({
    productId, new_status,
    newStatusName: statusName(new_status),
    updatedBy: log.args.updatedBy.toLowerCase(),
    ipfsHash: log.args.ipfsHash,
    block: log.blockNumber,
    txHash:log.transactionHash,
    ts: await getBlockTime(provider, log.blockNumber)
  })

  console.log(`[StatusChanged] prodId=${productId} -> ${statusName(new_status)} (block ${log.blockNumber})`)
}

export async function handleProductOwnershipTransferred(log, provider) {
  const prodId = Number(log.args.prodId)
  const prev_owner = log.args.previousOwner.toLowerCase()
  const newOwner = log.args.newOwner.toLowerCase()
  // sanity check - shouldnt really happen
  if (prev_owner === newOwner) {
    console.warn(`[OwnershipTransferred] same owner? prodId=${prodId}`)
  }

  db.prepare('UPDATE products SET current_owner = @newOwner, last_updated_block = @block, last_updated_tx = @txHash WHERE prod_id = @prodId')
    .run({newOwner, block: log.blockNumber, txHash:log.transactionHash, prodId})

  db.prepare(`
    INSERT INTO ownership_history (prod_id, previous_owner, new_owner, block_number, tx_hash, block_timestamp)
      VALUES (@prodId, @prev_owner, @newOwner, @block, @txHash, @ts)
  `).run({
    prodId, prev_owner, newOwner,
    block: log.blockNumber,
    txHash: log.transactionHash,
    ts:await getBlockTime(provider, log.blockNumber)
  })

  console.log(`[OwnershipTransferred] prodId=${prodId} ${prev_owner} -> ${newOwner}`)
}

// cache timestamps so we don't re-fetch the same block over and over
const tsCache = new Map()

async function getBlockTime(provider,blockNum) {
  if (tsCache.has(blockNum)) return tsCache.get(blockNum)
  try {
    const blk = await provider.getBlock(blockNum)
    const TimeStamp = blk ? new Date(blk.timestamp*1000).toISOString() : null
    tsCache.set(blockNum, TimeStamp)
    if (tsCache.size > 500) tsCache.delete(tsCache.keys().next().value)
    return TimeStamp
  } catch(e) {
    return null
  }
}

