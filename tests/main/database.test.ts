import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { migrate, migrations, openDatabase } from '../../src/main/db/database'

const directories: string[] = []
const connections: Database.Database[] = []
afterEach(() => {
  connections.forEach(db => { if (db.open) db.close() })
  connections.length = 0
  directories.splice(0).forEach(path => rmSync(path, { recursive: true, force: true }))
})
function path() {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-db-'))
  directories.push(directory)
  return join(directory, 'test.sqlite')
}
function open(location = path()) {
  const db = openDatabase(location)
  connections.push(db)
  return db
}
const stamp = '2026-10-04T00:00:00.000Z'
function workspace(db: Database.Database) {
  const id = randomUUID()
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?)').run(id, 'Synthetic workspace', stamp, stamp)
  return id
}
it('creates the complete schema, enables foreign keys and reopens without replay or lost data', () => {
  const location = path()
  const db = open(location)
  expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
  expect(tables).toEqual(['app_settings','collections','environments','requests','schema_migrations','secrets','variables','workspace_state','workspaces'].map(name => ({ name })))
  const id = workspace(db)
  const ledger = db.prepare('SELECT * FROM schema_migrations').all()
  migrate(db)
  expect(db.prepare('SELECT * FROM schema_migrations').all()).toEqual(ledger)
  db.close()
  const reopened = open(location)
  expect(reopened.prepare('SELECT id FROM workspaces').all()).toEqual([{ id }])
  expect(reopened.prepare('SELECT * FROM schema_migrations').all()).toEqual(ledger)
})
it('rolls back an injected migration including DDL, data and ledger without deleting prior data', () => {
  const location = path()
  const db = open(location)
  const id = workspace(db)
  const ledger = db.prepare('SELECT * FROM schema_migrations').all()
  const failing = [...migrations, { version: 2, sql: 'CREATE TABLE attempted(value TEXT); DELETE FROM workspaces; INSERT INTO missing_table VALUES (1);' }]
  expect(() => migrate(db, failing)).toThrow()
  expect(db.prepare('SELECT id FROM workspaces').all()).toEqual([{ id }])
  expect(db.prepare("SELECT name FROM sqlite_master WHERE name='attempted'").all()).toEqual([])
  expect(db.prepare('SELECT * FROM schema_migrations').all()).toEqual(ledger)
  db.close()
  expect(() => openDatabase(location, failing)).toThrow()
  expect(open(location).prepare('SELECT id FROM workspaces').all()).toEqual([{ id }])
})
it('rolls back an initial failure and rejects unsupported or discontinuous histories', () => {
  const db = new Database(path())
  connections.push(db)
  expect(() => migrate(db, [{ version: 1, sql: 'CREATE TABLE attempted(id INTEGER); INVALID SQL;' }])).toThrow()
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toEqual([])
  expect(() => migrate(db, [{ version: 2, sql: 'SELECT 1;' }])).toThrow()
  migrate(db)
  db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(2, stamp)
  expect(() => migrate(db)).toThrow('Unsupported migration history')
})
it('keeps a corrupt existing database byte-for-byte intact', () => {
  const location = path()
  const content = Buffer.from('synthetic invalid database')
  writeFileSync(location, content)
  expect(() => openDatabase(location)).toThrow()
  expect(readFileSync(location)).toEqual(content)
})
it('rejects cross-workspace collection, environment, secret and selection relations', () => {
  const db = open()
  const a = workspace(db), b = workspace(db)
  const collection = randomUUID(), environment = randomUUID(), secret = randomUUID(), request = randomUUID()
  db.prepare('INSERT INTO collections VALUES (?, ?, ?, ?, ?, ?)').run(collection, a, 'Collection', 0, stamp, stamp)
  db.prepare('INSERT INTO environments VALUES (?, ?, ?, ?, ?)').run(environment, a, 'Env', stamp, stamp)
  db.prepare('INSERT INTO secrets VALUES (?, ?, ?, ?, ?, ?)').run(secret, a, null, 'session', stamp, stamp)
  const insertRequest = db.prepare('INSERT INTO requests VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  expect(() => insertRequest.run(randomUUID(), b, collection, 'Request', 1, '{}', stamp, stamp)).toThrow(/FOREIGN KEY/)
  insertRequest.run(request, a, collection, 'Request', 1, '{}', stamp, stamp)
  const insertVariable = db.prepare('INSERT INTO variables VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  expect(() => insertVariable.run(randomUUID(), b, environment, 'key', 0, '', null, stamp, stamp)).toThrow(/FOREIGN KEY/)
  expect(() => insertVariable.run(randomUUID(), b, null, 'key', 1, null, secret, stamp, stamp)).toThrow(/FOREIGN KEY/)
  const state = db.prepare('INSERT INTO workspace_state VALUES (?, ?, ?)')
  expect(() => state.run(b, environment, null)).toThrow(/FOREIGN KEY/)
  expect(() => state.run(b, null, request)).toThrow(/FOREIGN KEY/)
  state.run(a, environment, request)
  expect(() => db.prepare('DELETE FROM requests WHERE id=?').run(request)).toThrow(/FOREIGN KEY/)
})
it('enforces variable scope uniqueness, sensitive storage invariants and cascading workspace deletion', () => {
  const db = open(), a = workspace(db), b = workspace(db), env = randomUUID(), secret = randomUUID()
  db.prepare('INSERT INTO environments VALUES (?, ?, ?, ?, ?)').run(env, a, 'Env', stamp, stamp)
  const insert = db.prepare('INSERT INTO variables VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  insert.run(randomUUID(), a, null, 'key', 0, '', null, stamp, stamp)
  expect(() => insert.run(randomUUID(), a, null, 'key', 0, '', null, stamp, stamp)).toThrow(/UNIQUE/)
  insert.run(randomUUID(), a, null, 'KEY', 0, '', null, stamp, stamp)
  insert.run(randomUUID(), b, null, 'key', 0, '', null, stamp, stamp)
  insert.run(randomUUID(), a, env, 'key', 0, '', null, stamp, stamp)
  expect(() => insert.run(randomUUID(), a, env, 'key', 0, '', null, stamp, stamp)).toThrow(/UNIQUE/)
  const secrets = db.prepare('INSERT INTO secrets VALUES (?, ?, ?, ?, ?, ?)')
  expect(() => secrets.run(randomUUID(), a, Buffer.from('synthetic'), 'session', stamp, stamp)).toThrow(/CHECK/)
  expect(() => secrets.run(randomUUID(), a, null, 'secure', stamp, stamp)).toThrow(/CHECK/)
  secrets.run(secret, a, null, 'session', stamp, stamp)
  expect(() => insert.run(randomUUID(), a, null, 'invalid', 1, 'synthetic', secret, stamp, stamp)).toThrow(/CHECK/)
  expect(() => insert.run(randomUUID(), a, null, 'invalid', 2, '', null, stamp, stamp)).toThrow(/CHECK/)
  insert.run(randomUUID(), a, null, 'sensitive', 1, null, secret, stamp, stamp)
  db.prepare('DELETE FROM workspaces WHERE id=?').run(a)
  expect(db.prepare('SELECT workspace_id FROM variables').all()).toEqual([{ workspace_id: b }])
  expect(db.prepare('SELECT * FROM secrets').all()).toEqual([])
  expect(db.pragma('foreign_key_check')).toEqual([])
})
