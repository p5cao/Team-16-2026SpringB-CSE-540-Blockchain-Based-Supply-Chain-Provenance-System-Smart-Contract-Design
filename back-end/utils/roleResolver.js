
import { ethers } from 'ethers'
import db from '../db/db.js'
import { roleName } from './constants.js'

const ROLES_ABI = ['function rolesMapping(address) view returns (uint8)']

let contractInstance = null

function getContract() {
  if (!contractInstance) {
    const prov = new ethers.JsonRpcProvider(process.env.RPC_URL)
    contractInstance = new ethers.Contract(process.env.CONTRACT_ADDRESS, ROLES_ABI, prov)
  }
  return contractInstance
}

// look up roles on-chain for any owners not in the users table yet
export async function resolveOwnerRoles(rows) {
  const missing = [...new Set(
    rows.filter(r => r.current_owner && !r.owner_role_name).map(r => r.current_owner.toLowerCase())
  )]

  if (!missing.length) return rows

  const contract = getContract()
  const roleMap = {}

  const results = await Promise.allSettled(
    missing.map(async addr => {
      const num = Number(await contract.rolesMapping(addr))
      return { addr, num, name: roleName(num) }
    })
  )

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    const { addr, num, name } = r.value
    roleMap[addr] = name
    // save to db so we dont hit the chain next time
    db.prepare('INSERT INTO users (address, role, role_name) VALUES (?, ?, ?) ON CONFLICT(address) DO UPDATE SET role = excluded.role, role_name = excluded.role_name')
      .run(addr, num, name)
  }

  return rows.map(r => {
    if (r.current_owner && !r.owner_role_name) {
      return { ...r, owner_role_name: roleMap[r.current_owner.toLowerCase()] || 'Unregistered' }
    }
    return r
  })
}
