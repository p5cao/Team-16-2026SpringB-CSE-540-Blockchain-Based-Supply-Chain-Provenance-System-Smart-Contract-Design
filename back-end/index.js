import 'dotenv/config'
import app from './api/server.js'
import { createTables, resetDatabase } from './db/schema.js'
import { startListener } from './listener/eventListener.js'
import { retryPendingIpfsFetches } from './listener/ipfsFetcher.js'

const PORT = process.env.PORT || 3001

async function main() {
  if (process.env.REBUILD_ON_START === 'true') {
    console.log('[Boot] wiping DB, replaying from block', process.env.START_BLOCK)
    resetDatabase()
  } else {
    createTables()
  }

  // retry any ipfs fetches that didnt go through last time
  await retryPendingIpfsFetches()

  startListener()

  app.listen(PORT, () => {
    console.log('backend running on port', PORT)
  })
}

main().catch(err => {
  console.error('startup failed:', err)
  process.exit(1)
})
