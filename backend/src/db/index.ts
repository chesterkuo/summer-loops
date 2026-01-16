import { Database } from 'bun:sqlite'
import { readFileSync } from 'fs'
import { join } from 'path'

const DB_PATH = process.env.DATABASE_PATH || './data/summer-loop.db'

let db: Database | null = null

export function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH, { create: true })
    db.run('PRAGMA foreign_keys = ON')
  }
  return db
}

export function initDb(): void {
  const database = getDb()
  const schema = readFileSync(join(import.meta.dir, 'schema.sql'), 'utf-8')
  database.run(schema)
  console.log('Database initialized successfully')
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

// Helper to generate UUIDs
export function generateId(): string {
  return crypto.randomUUID()
}
