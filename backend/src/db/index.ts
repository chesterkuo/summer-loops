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

  // Run migrations for existing databases
  runMigrations(database)

  console.log('Database initialized successfully')
}

// Migrations for existing databases
function runMigrations(database: Database): void {
  // Check if users table has password_hash column
  const columns = database.query("PRAGMA table_info(users)").all() as Array<{ name: string }>
  const columnNames = columns.map(c => c.name)

  // Add password_hash if missing
  if (!columnNames.includes('password_hash')) {
    database.run('ALTER TABLE users ADD COLUMN password_hash TEXT')
    console.log('Migration: Added password_hash column to users')
  }

  // Add auth_provider if missing
  if (!columnNames.includes('auth_provider')) {
    database.run("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'email'")
    console.log('Migration: Added auth_provider column to users')
  }

  // Add email_verified if missing
  if (!columnNames.includes('email_verified')) {
    database.run('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0')
    console.log('Migration: Added email_verified column to users')
  }

  // Add bio if missing
  if (!columnNames.includes('bio')) {
    database.run('ALTER TABLE users ADD COLUMN bio TEXT')
    console.log('Migration: Added bio column to users')
  }

  // Check if team_members table has auto_share columns
  const teamMemberColumns = database.query("PRAGMA table_info(team_members)").all() as Array<{ name: string }>
  const teamMemberColumnNames = teamMemberColumns.map(c => c.name)

  // Add auto_share if missing
  if (teamMemberColumnNames.length > 0 && !teamMemberColumnNames.includes('auto_share')) {
    database.run('ALTER TABLE team_members ADD COLUMN auto_share INTEGER DEFAULT 0')
    console.log('Migration: Added auto_share column to team_members')
  }

  // Add auto_share_visibility if missing
  if (teamMemberColumnNames.length > 0 && !teamMemberColumnNames.includes('auto_share_visibility')) {
    database.run("ALTER TABLE team_members ADD COLUMN auto_share_visibility TEXT DEFAULT 'basic'")
    console.log('Migration: Added auto_share_visibility column to team_members')
  }
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
