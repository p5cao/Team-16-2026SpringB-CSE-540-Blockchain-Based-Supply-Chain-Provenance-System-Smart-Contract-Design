import { ethers } from 'ethers'
import db from '../db/db.js'
import { CONTRACT_ABI } from '../utils/contractAbi.js'
import { handleRoleAssigned, handleProductCreated, handleProductStatusChanged, handleProductOwnershipTransferred } from './eventHandlers.js'

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
const RPC_URL = process.env.RPC_URL
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '15000')
const CHUNK_SIZE = parseInt(process.env.BLOCK_CHUNK || '2000')

export let provider
let iface
let active = false
let timer = null

export function startListener() {
  if (active) return
  active = true
  provider = new ethers.JsonRpcProvider(RPC_URL)
  iface = new ethers.Interface(CONTRACT_ABI)
  console.log('[Listener] starting, contract:', CONTRACT_ADDRESS)
  runPoll()
}

export function stopListener() {
  active = false
  if (timer) clearTimeout(timer)
}

async function runPoll() {
  if (!active) return
  try {
    await processNewBlocks()
  } catch(e) {
    console.error('[Listener] poll error:', e.message)
  }
  timer = setTimeout(runPoll, POLL_INTERVAL)
}

export async function processNewBlocks() {
  const row = db.prepare('SELECT last_block FROM sync_state WHERE id = 1').get()
  const from = (row ? row.last_block : 0) + 1
  const head = await provider.getBlockNumber()

  if (from > head) {
    console.log(`[Listener] up to date at block ${head}`)
    return
  }

  console.log(`[Listener] scanning blocks ${from} → ${head}`)

  for (let start = from; start <= head; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, head)
    await scanChunk(start, end)
    db.prepare('UPDATE sync_state SET last_block = ? WHERE id = 1').run(end)
  }
}

async function scanChunk(from, to) {
  const logs = await provider.getLogs({ address: CONTRACT_ADDRESS, fromBlock: from, toBlock: to })
  if (!logs.length) return
  console.log(`[Listener] ${logs.length} log(s) in blocks ${from}-${to}`)
  for (const raw of logs) {
    try {
      await handleLog(raw)
    } catch(err) {
      console.error('[Listener] failed to process log:', raw.transactionHash, err.message)
    }
  }
}

async function handleLog(raw) {
  let parsed
  try {
    parsed = iface.parseLog({ topics: raw.topics, data: raw.data })
  } catch {
    return // unknown event
  }

  const log = { ...raw, args: parsed.args }
  if (parsed.name === 'RoleAssigned') await handleRoleAssigned(log, provider)
  else if (parsed.name === 'ProductCreated') await handleProductCreated(log, provider)
  else if (parsed.name === 'ProductStatusChanged') await handleProductStatusChanged(log, provider)
  else if (parsed.name === 'ProductOwnershipTransferred') await handleProductOwnershipTransferred(log, provider)
}
