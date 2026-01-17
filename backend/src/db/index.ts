// PostgreSQL Database Connection
// Migrated from SQLite to PostgreSQL

export { db, sql, generateId, closeDb, checkConnection, initPostgres } from './postgres.js'

// Initialize the database connection on import
import { initPostgres } from './postgres.js'

// Auto-initialize when module is loaded
export async function initDb(): Promise<void> {
  await initPostgres()
  console.log('PostgreSQL database initialized successfully')
}

// Legacy SQLite code preserved for reference
// ---------------------------------------------------------------------------
// import { Database } from 'bun:sqlite'
// import { readFileSync } from 'fs'
// import { join } from 'path'
//
// const DB_PATH = process.env.DATABASE_PATH || './data/summer-loop.db'
//
// let db: Database | null = null
//
// export function getDb(): Database {
//   if (!db) {
//     db = new Database(DB_PATH, { create: true })
//     db.run('PRAGMA foreign_keys = ON')
//   }
//   return db
// }
// ---------------------------------------------------------------------------
