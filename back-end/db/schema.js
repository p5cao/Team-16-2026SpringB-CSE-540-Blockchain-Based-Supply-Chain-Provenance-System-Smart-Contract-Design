import db from './db.js'
import fs from 'fs'
import path from 'path'


// make tables if not there yet
export function createTables() {
  const schema_path = path.resolve(path.dirname(import.meta.url.replace('file://', '')), 'schema.sql')
  const sql = fs.readFileSync(schema_path, 'utf8')
  db.exec(sql)

  // set start block if needed (init only)
  const StartBlock = parseInt(process.env.START_BLOCK || '0', 10)
  const syncRow = db.prepare('SELECT last_block FROM sync_state WHERE id = 1').get()
  if (syncRow && syncRow.last_block === 0 && StartBlock > 0) {
    db.prepare('UPDATE sync_state SET last_block = ? WHERE id = 1').run(StartBlock - 1)
  }
}

// drop all tables (carefully, only for testing)
export function dropTables() {
  const DropPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), 'drop.sql')
  const sql = fs.readFileSync(DropPath, 'utf8')
  db.exec(sql)
}

//  rebuild db, resets block
export function resetDatabase() {
  dropTables();
  createTables();
  const startBlock = parseInt(process.env.START_BLOCK || '0', 10);
  db.prepare('UPDATE sync_state SET last_block = ? WHERE id = 1').run(startBlock);
}
