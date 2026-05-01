import 'dotenv/config'
import app from './api/server.js'
import { createTables, resetDatabase } from './db/schema.js'
import { startListener } from './listener/eventListener.js'
import { retryPendingIpfsFetches } from './listener/ipfsFetcher.js'

const port = process.env.PORT || 3001

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

  app.listen(port, () => {
    console.log('backend running on port', port)
  })
}

main().catch(err => {
  console.error('startup failed:', err)
  process.exit(1)
})
