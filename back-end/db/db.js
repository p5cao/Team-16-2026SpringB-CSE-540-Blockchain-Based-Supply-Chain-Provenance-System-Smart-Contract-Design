import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || './data/supply_chain.db';
const resolvedPath = path.resolve(__dirname, '..', dbPath);

// Ensure the data directory exists
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);

// Enable WAL mode for better read/write concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
