/**
 * Data Migration Script: SQLite to PostgreSQL
 *
 * This script migrates data from the SQLite database to PostgreSQL.
 * Run with: bun run src/db/migrate-data.ts
 */

import { Database } from 'bun:sqlite'
import postgres from 'postgres'

// SQLite connection
const sqliteDbPath = './data/summer-loop.db'
let sqliteDb: Database

// PostgreSQL connection
const connectionString = process.env.DATABASE_URL || 'postgresql://warmly_app:WarmlyApp2026@127.0.0.1:5432/warmly'
const pg = postgres(connectionString, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
})

// Tables to migrate in order (respecting foreign keys)
const TABLES = [
  'users',
  'contacts',
  'relationships',
  'career_history',
  'education_history',
  'interactions',
  'tags',
  'contact_tags',
  'teams',
  'team_members',
  'shared_contacts',
  'introduction_requests',
  'notifications',
] as const

// Boolean fields that need conversion (0/1 → true/false)
const BOOLEAN_FIELDS: Record<string, string[]> = {
  users: ['email_verified'],
  relationships: ['is_user_relationship', 'is_ai_inferred', 'verified'],
  team_members: ['auto_share'],
}

// JSONB fields that need conversion (TEXT → JSONB)
const JSONB_FIELDS: Record<string, string[]> = {
  contacts: ['source_metadata'],
  introduction_requests: ['path_data'],
}

interface MigrationResult {
  table: string
  sqliteCount: number
  pgCount: number
  status: 'success' | 'error' | 'skipped'
  error?: string
}

function convertValue(tableName: string, columnName: string, value: any): any {
  // Handle null values
  if (value === null || value === undefined) {
    return null
  }

  // Convert boolean fields (SQLite stores as 0/1)
  if (BOOLEAN_FIELDS[tableName]?.includes(columnName)) {
    return value === 1 || value === true
  }

  // Convert JSONB fields
  if (JSONB_FIELDS[tableName]?.includes(columnName)) {
    if (typeof value === 'string') {
      try {
        JSON.parse(value) // Verify it's valid JSON
        return value // Return as string, PostgreSQL will handle the cast
      } catch {
        return null
      }
    }
    return value
  }

  return value
}

async function getTableColumns(tableName: string): Promise<string[]> {
  const result = sqliteDb.query(`PRAGMA table_info(${tableName})`).all() as { name: string }[]
  return result.map(r => r.name)
}

// Tables with FK validations that need filtering
const FK_VALIDATIONS: Record<string, { column: string; targetTable: string }[]> = {
  relationships: [
    { column: 'contact_a_id', targetTable: 'contacts' },
    { column: 'contact_b_id', targetTable: 'contacts' },
  ],
  introduction_requests: [
    { column: 'target_contact_id', targetTable: 'contacts' },
  ],
}

async function migrateTable(tableName: string): Promise<MigrationResult> {
  console.log(`\nMigrating table: ${tableName}`)

  try {
    // Get SQLite row count
    const sqliteCountResult = sqliteDb.query(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number }
    const sqliteCount = sqliteCountResult.count

    if (sqliteCount === 0) {
      console.log(`  - No data to migrate (0 rows)`)
      return {
        table: tableName,
        sqliteCount: 0,
        pgCount: 0,
        status: 'skipped'
      }
    }

    console.log(`  - SQLite rows: ${sqliteCount}`)

    // Get all data from SQLite
    let rows = sqliteDb.query(`SELECT * FROM ${tableName}`).all() as Record<string, any>[]
    const columns = await getTableColumns(tableName)

    // Validate FK references for problematic tables
    const fkValidations = FK_VALIDATIONS[tableName]
    if (fkValidations) {
      for (const fk of fkValidations) {
        const targetIds = new Set(
          (sqliteDb.query(`SELECT id FROM ${fk.targetTable}`).all() as { id: string }[])
            .map(r => r.id)
        )
        const beforeCount = rows.length
        rows = rows.filter(row => {
          const fkValue = row[fk.column]
          return fkValue === null || targetIds.has(fkValue)
        })
        const skipped = beforeCount - rows.length
        if (skipped > 0) {
          console.log(`  - Skipped ${skipped} rows with orphan ${fk.column} references`)
        }
      }
    }

    // Clear existing data in PostgreSQL (with CASCADE to handle FK constraints)
    await pg`TRUNCATE TABLE ${pg(tableName)} CASCADE`

    // Insert data in batches
    const batchSize = 100
    let inserted = 0

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)

      for (const row of batch) {
        // Convert values
        const convertedRow: Record<string, any> = {}
        for (const col of columns) {
          convertedRow[col] = convertValue(tableName, col, row[col])
        }

        // Build insert query dynamically
        const colNames = columns.join(', ')
        const values = columns.map(col => convertedRow[col])

        // Use unsafe for dynamic table/column names, but parameterize values
        await pg.unsafe(
          `INSERT INTO ${tableName} (${colNames}) VALUES (${columns.map((_, idx) => `$${idx + 1}`).join(', ')})`,
          values
        )
        inserted++
      }

      console.log(`  - Inserted ${Math.min(i + batchSize, rows.length)}/${rows.length} rows`)
    }

    // Verify PostgreSQL row count
    const pgCountResult = await pg`SELECT COUNT(*) as count FROM ${pg(tableName)}`
    const pgCount = Number(pgCountResult[0].count)

    console.log(`  - PostgreSQL rows: ${pgCount}`)

    // Compare against filtered row count, not original SQLite count
    const expectedCount = rows.length
    if (pgCount !== expectedCount) {
      console.error(`  - WARNING: Row count mismatch! Expected: ${expectedCount}, PostgreSQL: ${pgCount}`)
      return {
        table: tableName,
        sqliteCount,
        pgCount,
        status: 'error',
        error: `Row count mismatch: Expected=${expectedCount}, PG=${pgCount}`
      }
    }

    console.log(`  - SUCCESS${sqliteCount !== pgCount ? ` (${sqliteCount - pgCount} rows skipped due to orphan FKs)` : ''}`)
    return {
      table: tableName,
      sqliteCount,
      pgCount,
      status: 'success'
    }
  } catch (error) {
    console.error(`  - ERROR: ${error}`)
    return {
      table: tableName,
      sqliteCount: 0,
      pgCount: 0,
      status: 'error',
      error: String(error)
    }
  }
}

async function main() {
  console.log('=' .repeat(60))
  console.log('SQLite to PostgreSQL Data Migration')
  console.log('=' .repeat(60))

  console.log(`\nSQLite Database: ${sqliteDbPath}`)
  console.log(`PostgreSQL: ${connectionString.replace(/:[^:@]+@/, ':***@')}`)

  // Initialize SQLite
  try {
    sqliteDb = new Database(sqliteDbPath, { readonly: true })
    console.log('\nSQLite connection: OK')
  } catch (error) {
    console.error(`\nFailed to open SQLite database: ${error}`)
    process.exit(1)
  }

  // Test PostgreSQL connection
  try {
    await pg`SELECT 1`
    console.log('PostgreSQL connection: OK')
  } catch (error) {
    console.error(`\nFailed to connect to PostgreSQL: ${error}`)
    sqliteDb.close()
    process.exit(1)
  }

  // Migrate tables
  const results: MigrationResult[] = []

  for (const table of TABLES) {
    const result = await migrateTable(table)
    results.push(result)
  }

  // Print summary
  console.log('\n' + '=' .repeat(60))
  console.log('Migration Summary')
  console.log('=' .repeat(60))

  let hasErrors = false
  for (const result of results) {
    const status = result.status === 'success' ? 'OK' :
                   result.status === 'skipped' ? 'SKIPPED' : 'ERROR'
    console.log(`${result.table.padEnd(25)} ${status.padEnd(10)} SQLite: ${result.sqliteCount.toString().padStart(5)} → PG: ${result.pgCount.toString().padStart(5)}`)
    if (result.status === 'error') {
      hasErrors = true
      console.log(`  Error: ${result.error}`)
    }
  }

  // Calculate totals
  const totalSqlite = results.reduce((sum, r) => sum + r.sqliteCount, 0)
  const totalPg = results.reduce((sum, r) => sum + r.pgCount, 0)

  console.log('-'.repeat(60))
  console.log(`${'TOTAL'.padEnd(25)} ${' '.padEnd(10)} SQLite: ${totalSqlite.toString().padStart(5)} → PG: ${totalPg.toString().padStart(5)}`)

  // Cleanup
  sqliteDb.close()
  await pg.end()

  if (hasErrors) {
    console.log('\nMigration completed with errors!')
    process.exit(1)
  } else {
    console.log('\nMigration completed successfully!')
    process.exit(0)
  }
}

main().catch(console.error)
