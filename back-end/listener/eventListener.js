import { ethers } from 'ethers'
import db from '../db/db.js'
import { CONTRACT_ABI } from '../utils/contractAbi.js'
import {
  handleRoleAssigned,
  handleProductCreated,
  handleProductStatusChanged,
  handleProductOwnershipTransferred
} from './eventHandlers.js'
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
const RPC_URL = process.env.RPC_URL
const WS_RPC_URL = process.env.WS_RPC_URL
const CHUNK_SIZE = parseInt(process.env.BLOCK_CHUNK||'2000')

// http provider used for backfill reads
export let provider = new ethers.JsonRpcProvider(RPC_URL)
let wsProvider = null
let contract = null
let active = false
// let reconnectCount = 0 

export async function startListener() {
  if (active) return
  active = true
  // first catch up on any blocks missed since last run
  await processNewBlocks()

  // kick off ws, dont await it
  connectWebSocket()
}

export function stopListener() {
  active = false
  if (contract) contract.removeAllListeners()

  if (wsProvider) wsProvider.destroy()
}

// ethers v6 passes ContractEventPayload as last arg, actual log is on payload.log
function wsLog(args) {
  const evt = args[args.length - 1]
  return { ...evt.log, args: evt.args }
}


async function connectWebSocket() {
  if (!WS_RPC_URL) {
    console.warn('[Listener] WS_RPC_URL not set, no live events')
    return
  }
  try {
    if (contract) contract.removeAllListeners()
    if (wsProvider) wsProvider.destroy()
    wsProvider = new ethers.WebSocketProvider(WS_RPC_URL)
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wsProvider)

    contract.on('RoleAssigned',(...args) => dispatch(handleRoleAssigned, wsLog(args), wsProvider))
    contract.on('ProductCreated', (...args) => dispatch(handleProductCreated, wsLog(args), wsProvider))

    contract.on('ProductStatusChanged',(...args) => dispatch(handleProductStatusChanged, wsLog(args), wsProvider))
    
    
    
    contract.on('ProductOwnershipTransferred', (...args) => dispatch(handleProductOwnershipTransferred, wsLog(args), wsProvider))

    wsProvider.websocket.on('close', async () => {
      if (!active) return

      console.warn('ws dropped, catching up then reconnecting...')

      await processNewBlocks().catch(e => console.error('[Listener] backfill error:', e.message))

      setTimeout(connectWebSocket, 5000)
    })
    console.log('[Listener] ws up, contract:', CONTRACT_ADDRESS)
  } catch(err) {
    console.error('[Listener] ws connect failed:', err.message)
    if (active) setTimeout(connectWebSocket, 5000)
  }
}

// run a handler and keep the sync cursor up to date
async function dispatch(handler, log, prov) {
  try {
    await handler(log, prov)

    if (log.blockNumber) {
      db.prepare('UPDATE sync_state SET last_block = max(last_block, ?) WHERE id = 1').run(log.blockNumber)
    }
  } catch(err) {
    console.error('dispatch failed:', err.message)
  }
}


// pooling to backfill: scan from last saved block to chain head
export async function processNewBlocks() {
  const state_row = db.prepare('SELECT last_block FROM sync_state WHERE id = 1').get()
  const from_block = (state_row ? state_row.last_block : 0) + 1
  const ChainHead = await provider.getBlockNumber()
  if (from_block > ChainHead) {
    console.log('already at head, block', ChainHead)
    return
  }

  console.log(`[Listener] scanning blocks ${from_block} -> ${ChainHead}`)
  const contractIface = new ethers.Interface(CONTRACT_ABI)

  for (let start=from_block; start <= ChainHead; start += CHUNK_SIZE) {

    const end = Math.min(start + CHUNK_SIZE - 1, ChainHead)
    await scanChunk(start, end, contractIface)

    db.prepare('UPDATE sync_state SET last_block = ? WHERE id = 1').run(end)
  }
}

async function scanChunk(from, to, contractIface) {
  const logs = await provider.getLogs({ address: CONTRACT_ADDRESS, fromBlock: from, toBlock: to })
  if (!logs.length) return

  console.log(`got ${logs.length} logs in ${from}-${to}`)
  for (const raw of logs) {
    try {
      let parsed
      try { parsed = contractIface.parseLog({ topics: raw.topics, data: raw.data }) } catch { continue }
      const log = { ...raw, args: parsed.args }

      if (parsed.name === 'RoleAssigned') 
        await handleRoleAssigned(log, provider)

      else if (parsed.name === 'ProductCreated')
         await handleProductCreated(log, provider)

      else if (parsed.name === 'ProductStatusChanged') await handleProductStatusChanged(log, provider)
      else if (parsed.name === 'ProductOwnershipTransferred') await handleProductOwnershipTransferred(log, provider)
    } catch(err) {
      console.error('failed on log', raw.transactionHash, err.message)
    }
  }
}
