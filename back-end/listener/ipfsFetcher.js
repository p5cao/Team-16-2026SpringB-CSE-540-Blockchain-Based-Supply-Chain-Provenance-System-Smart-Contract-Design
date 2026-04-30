
import fetch from 'node-fetch'
import db from '../db/db.js'

// ipfs gateway, change if needed lol
const GATEWAY = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs'


// fetches ipfs json and puts in db, kinda hacky
export async function fetchAndCacheIpfs(prodId, cid) {
  if (!cid) return

  const url = `${GATEWAY}/${cid}`
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 15000)

  let data
  try {
    const resp = await fetch(url, { signal: controller.signal })
    if (!resp.ok) throw new Error('http ' + resp.status)
    data = await resp.json()
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
    data.name || null,
    data.producer_wallet || null,
    data.producer_batch_id != null ? String(data.producer_batch_id) : '',
    data.current_batch_id != null ? String(data.current_batch_id) : '',
    data.parent_batch_id != null ? String(data.parent_batch_id) : null,
    data.expiration_date || null,
    data.certificate || null,
    data.attributes ? data.attributes.origin : null,
    data.attributes ? data.attributes.registered_at : null,
    prodId
  )

  console.log(`[ipfs] cached meta for prodId=${prodId}`)
}


// try to fetch all the ones that failed before
export async function retryPendingIpfsFetches() {
  const pending = db.prepare('select prod_id, ipfs_hash from products where ipfs_synced = 0 and ipfs_hash is not null').all()
  if (!pending.length) return
  console.log(`[ipfs] retrying ${pending.length} pending fetchs`)
  for (const row of pending) {
    await fetchAndCacheIpfs(row.prod_id, row.ipfs_hash).catch(err =>
      console.error(`[ipfs] retry faild for prodId=${row.prod_id}:`, err.message)
    )
  }
}
