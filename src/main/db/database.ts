import Database from 'better-sqlite3'
import { z } from 'zod'
import { apiLibrarySchema } from './migrations/002-api-library'
import { initialSchema } from './migrations/001-initial'

export interface Migration { readonly version: number; readonly sql: string }
export const migrations: readonly Migration[] = Object.freeze([{ version: 1, sql: initialSchema }, { version: 2, sql: apiLibrarySchema }])
const ledgerSchema = z.array(z.strictObject({ version: z.number().int().positive(), applied_at: z.iso.datetime() }))

export function migrate(database: Database.Database, plan: readonly Migration[] = migrations): void {
  if (database.inTransaction) throw new Error('Migration requires an independent transaction')
  database.pragma('foreign_keys = ON')
  if (database.pragma('foreign_keys', { simple: true }) !== 1) throw new Error('Foreign keys unavailable')
  plan.forEach((migration, index) => {
    if (migration.version !== index + 1) throw new Error('Migration plan must be contiguous')
  })
  database.transaction(() => {
    database.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')
    const applied = ledgerSchema.parse(database.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all())
    applied.forEach((entry, index) => {
      if (entry.version !== index + 1 || entry.version > plan.length) throw new Error('Unsupported migration history')
    })
    const insert = database.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)')
    for (const migration of plan.slice(applied.length)) {
      database.exec(migration.sql)
      insert.run(migration.version, new Date().toISOString())
    }
    if (z.array(z.unknown()).parse(database.pragma('foreign_key_check')).length !== 0) throw new Error('Invalid database relationships')
  }).immediate()
}

export function openDatabase(path: string, plan: readonly Migration[] = migrations): Database.Database {
  const database = new Database(path)
  try {
    migrate(database, plan)
    return database
  } catch (error) {
    database.close()
    throw error
  }
}
