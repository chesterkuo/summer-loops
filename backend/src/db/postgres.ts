// PostgreSQL Connection Module using postgres.js and Drizzle ORM
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema.js'

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://warmly_app:WarmlyApp2026@127.0.0.1:5432/warmly'

// Create postgres.js client with connection pooling
const client = postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 20 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
})

// Create Drizzle ORM instance
export const db = drizzle(client, { schema })

// Export raw SQL client for complex queries
export const sql = client

// Generate UUID for new records
export function generateId(): string {
  return crypto.randomUUID()
}

// Close database connection
export async function closeDb(): Promise<void> {
  await client.end()
}

// Check database connection
export async function checkConnection(): Promise<boolean> {
  try {
    await client`SELECT 1`
    return true
  } catch (error) {
    console.error('PostgreSQL connection check failed:', error)
    return false
  }
}

// Initialize connection and log status
export async function initPostgres(): Promise<void> {
  const connected = await checkConnection()
  if (connected) {
    console.log('PostgreSQL connected successfully')
  } else {
    throw new Error('Failed to connect to PostgreSQL')
  }
}
