import db from './db.js'
import fs from 'fs'
import path from 'path'


// make tables if not there yet
export function createTables() {
  const schemaPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')
  db.exec(sql)

  // set start block if needed (init only)
  const startBlock = parseInt(process.env.START_BLOCK || '0', 10)
  const row = db.prepare('SELECT last_block FROM sync_state WHERE id = 1').get()
  if (row && row.last_block === 0 && startBlock > 0) {
    db.prepare('UPDATE sync_state SET last_block = ? WHERE id = 1').run(startBlock - 1)
  }
}

// drop all tables (carefully, only for testing)
export function dropTables() {
  const dropPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), 'drop.sql')
  const sql = fs.readFileSync(dropPath, 'utf8')
  db.exec(sql)
}

//  rebuild db, resets block
export function resetDatabase() {
  dropTables();
  createTables();
  const startBlock = parseInt(process.env.START_BLOCK || '0', 10);
  db.prepare('UPDATE sync_state SET last_block = ? WHERE id = 1').run(startBlock);
}
