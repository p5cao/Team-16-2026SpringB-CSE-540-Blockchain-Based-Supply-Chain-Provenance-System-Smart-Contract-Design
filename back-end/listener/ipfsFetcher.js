
import fetch from 'node-fetch'
import db from '../db/db.js'

// ipfs gateway, change if needed lol
const GATEWAY = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs'


// fetches ipfs json and puts in db, kinda hacky
export async function fetchAndCacheIpfs(prodId, CID) {
  if (!CID) return

  const url = `${GATEWAY}/${CID}`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)

  let ipfs_data
  try {
    const httpResp = await fetch(url, { signal: ctrl.signal })
    if (!httpResp.ok) throw new Error('http ' + httpResp.status)
    ipfs_data = await httpResp.json()
  } finally {
    clearTimeout(t)
  }

  db.prepare(`
    update products set
      name = ?,
      producer_wallet = ?,
      producer_batch_id = ?,
      current_batch_id = ?,
      parent_batch_id = ?,
      expiration_date = ?,
      certificate = ?,
      origin = ?,
      registered_at = ?,
      ipfs_synced = 1
    where prod_id = ?
  `).run(
    ipfs_data.name || null,
    ipfs_data.producer_wallet || null,
    ipfs_data.producer_batch_id != null ? String(ipfs_data.producer_batch_id) : '',
    ipfs_data.current_batch_id != null ? String(ipfs_data.current_batch_id) : '',
    ipfs_data.parent_batch_id != null ? String(ipfs_data.parent_batch_id) : null,
    ipfs_data.expiration_date || null,
    ipfs_data.certificate || null,
    ipfs_data.attributes ? ipfs_data.attributes.origin : null,
    ipfs_data.attributes ? ipfs_data.attributes.registered_at : null,
    prodId
  )

  console.log('[ipfs] cached meta for prodId=' + prodId)
}


// try to fetch all the ones that failed before
export async function retryPendingIpfsFetches() {
  const todoList = db.prepare('select prod_id, ipfs_hash from products where ipfs_synced = 0 and ipfs_hash is not null').all()
  if (!todoList.length) return
  // TODO: maybe add a max retry count per product
  console.log(`[ipfs] retrying ${todoList.length} pending fetchs`)
  for (const row of todoList) {

    await fetchAndCacheIpfs(row.prod_id, row.ipfs_hash).catch(err =>
      console.error(`[ipfs] retry faild for prodId=${row.prod_id}:`, err.message)
    )
  }
}
