import { afterEach, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { migrate, migrations, openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { createDefaultRequestConfig, type StoredRequestConfig } from '../../src/shared/request-config'

const resources: { db: Database.Database; directory: string }[] = []
afterEach(() => { for (const { db, directory } of resources.splice(0)) { if (db.open) db.close(); rmSync(directory, { recursive: true, force: true }) } })
function fixture(legacy = false) {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-library-db-')), path = join(directory, 'synthetic.sqlite')
  const db = openDatabase(path, legacy ? migrations.slice(0, 1) : migrations)
  resources.push({ db, directory })
  const r = new Repositories(db), a = r.createWorkspace('A').id, b = r.createWorkspace('B').id
  const c = r.createCollection(a, 'Users').id, other = r.createCollection(a, 'Other').id, foreign = r.createCollection(b, 'Foreign').id
  return { db, directory, path, r, a, b, c, other, foreign }
}
const stamp = '2026-10-11T00:00:00.000Z'
// Seed the original on-disk contract directly: current repositories require migration 2.
function legacyRequest(db: Database.Database, w: string, name: string, collectionId: string|null, config: StoredRequestConfig) {
  const id = randomUUID()
  db.prepare('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)').run(id,w,collectionId,name,1,JSON.stringify(config),stamp,stamp)
  return { id,workspaceId:w,name,collectionId,folderId:null,createdAt:stamp,updatedAt:stamp,config }
}
function folder(db: Database.Database, w: string, c: string, parent: string | null = null, id = randomUUID()) {
  db.prepare('INSERT INTO folders VALUES (?,?,?,?,?,?,?,?)').run(id, w, c, parent, 'Folder', 0, stamp, stamp)
  return id
}
function snapshot(db: Database.Database) {
  return Object.fromEntries(['workspaces','collections','requests','environments','variables','secrets','workspace_state','app_settings'].map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]))
}
it('migrates a closed legacy copy without truncating 1005 requests, configs, credentials or selections; reopens idempotently', () => {
  const f = fixture(true), environment = f.r.createEnvironment(f.a, 'Local').id
  const secret = f.r.createSecret(f.a, 'secure', Buffer.from('synthetic ciphertext'))
  const configured = legacyRequest(f.db, f.a, 'Configured', f.c, { ...createDefaultRequestConfig(), method: 'POST',
    body: { kind: 'json', text: '{"synthetic":true}' }, auth: { mode: 'bearer', token: { kind: 'secret', secretId: secret.id } } })
  const session = f.r.createSecret(f.a, 'session', null)
  f.db.prepare('INSERT INTO variables VALUES (?,?,?,?,?,?,?,?,?)').run(randomUUID(),f.a,environment,'synthetic_token',1,null,session.id,stamp,stamp)
  f.r.setState(f.a, environment, configured.id); f.r.selectWorkspace(f.a); f.r.setTheme('dark')
  const insert = f.db.prepare('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)')
  f.db.transaction(() => { for (let i = 0; i < 1004; i++) insert.run(randomUUID(), f.a, i % 2 ? f.c : null, `API ${i}`, 1, JSON.stringify(createDefaultRequestConfig()), stamp, stamp) })()
  const before = snapshot(f.db), ledger = f.db.prepare('SELECT * FROM schema_migrations').all()
  f.db.close()
  const backup = join(f.directory, 'closed-v1.sqlite'); copyFileSync(f.path, backup)
  const db = openDatabase(f.path)
  try {
    const after = snapshot(db)
    // Only the new nullable destination column differs; legacy bytes in config_json are exact.
    after.requests = db.prepare('SELECT id,workspace_id,collection_id,name,config_version,config_json,created_at,updated_at FROM requests ORDER BY id').all()
    expect(after).toEqual(before)
    expect(db.prepare('SELECT count(*) AS n FROM requests WHERE folder_id IS NULL').get()).toEqual({ n: 1005 })
    expect(db.prepare('SELECT * FROM schema_migrations WHERE version=1').all()).toEqual(ledger)
    expect(db.pragma('foreign_key_check')).toEqual([])
    const r = new Repositories(db)
    expect(r.getState(f.a)).toEqual({ workspaceId: f.a, activeEnvironmentId: environment, selectedRequestId: configured.id })
    expect(r.listLibraryRequests(f.a)).toHaveLength(1005)
    const fullLedger = db.prepare('SELECT * FROM schema_migrations').all()
    migrate(db); expect(db.prepare('SELECT * FROM schema_migrations').all()).toEqual(fullLedger)
  } finally { db.close() }
  const reopened = openDatabase(f.path), old = openDatabase(backup, migrations.slice(0, 1))
  try { expect(new Repositories(reopened).getRequest(f.a, configured.id)).toEqual(configured); expect(snapshot(old)).toEqual(before) } finally { reopened.close(); old.close() }
})
it('rolls back failure after the table rebuild and leaves the old database available for recovery/retry', () => {
  const f = fixture(true), request = legacyRequest(f.db, f.a, 'Selected', f.c, { ...createDefaultRequestConfig(), auth: { mode: 'none' } })
  f.r.setState(f.a, null, request.id)
  const before = snapshot(f.db)
  const failure = [migrations[0]!, { version: 2, sql: migrations[1]!.sql + '\nINSERT INTO missing_table VALUES (1);' }]
  expect(() => migrate(f.db, failure)).toThrow()
  expect(snapshot(f.db)).toEqual(before)
  expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name IN ('folders','requests_library','library_state_backup','workspace_tree_state')").all()).toEqual([])
  expect(f.db.prepare('SELECT version FROM schema_migrations').all()).toEqual([{ version: 1 }])
  f.db.close(); expect(() => openDatabase(f.path, failure)).toThrow()
  const old = openDatabase(f.path, migrations.slice(0, 1))
  try { expect(snapshot(old)).toEqual(before) } finally { old.close() }
  const retry = openDatabase(f.path)
  try { expect(new Repositories(retry).getState(f.a).selectedRequestId).toBe(request.id) } finally { retry.close() }
})
it('enforces composite owners and required collection, preserves selected-request FKs and indexes', () => {
  const f = fixture(), root = folder(f.db, f.a, f.c), child = folder(f.db, f.a, f.c, root)
  expect(() => folder(f.db, f.b, f.c)).toThrow(/FOREIGN KEY/)
  expect(() => folder(f.db, f.a, f.other, root)).toThrow(/FOREIGN KEY/)
  expect(() => folder(f.db, f.b, f.foreign, root)).toThrow(/FOREIGN KEY/)
  const self = randomUUID(); expect(() => folder(f.db, f.a, f.c, self, self)).toThrow(/CHECK/)
  const request = f.r.createRequest(f.a, 'Nested', f.c, { ...createDefaultRequestConfig(), auth: { mode: 'none' } })
  const move = f.db.prepare('UPDATE requests SET collection_id=?,folder_id=? WHERE id=?')
  expect(() => move.run(null, child, request.id)).toThrow(/CHECK/)
  expect(() => move.run(f.other, child, request.id)).toThrow(/FOREIGN KEY/)
  expect(() => move.run(f.foreign, child, request.id)).toThrow(/FOREIGN KEY/)
  move.run(f.c, child, request.id)
  expect(f.r.validateDestination(f.a, { collectionId: f.c, folderId: child })).toEqual({ kind: 'folder', collectionId: f.c, folderId: child })
  expect(() => f.r.validateDestination(f.b, { collectionId: f.c, folderId: child })).toThrow('Item not found')
  expect(() => f.r.getFolder(f.b, child)).toThrow('Item not found')
  expect(() => f.r.validateDestination(f.a, { collectionId: f.other, folderId: child })).toThrow('Item not found')
  f.r.setState(f.a, null, request.id)
  expect(() => f.db.prepare('DELETE FROM requests WHERE id=?').run(request.id)).toThrow(/FOREIGN KEY/)
  const indexes = f.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all()
  expect(indexes).toEqual(expect.arrayContaining(['folders_workspace_collection_parent','folders_parent_owner','requests_workspace_folder','requests_folder_owner','state_request_workspace'].map(name => ({ name }))))
  f.r.deleteWorkspace(f.a)
  expect(f.db.prepare('SELECT * FROM folders').all()).toEqual([])
  expect(f.db.pragma('foreign_key_check')).toEqual([])
})
it('rejects corrupt cyclic/deep/orphan hierarchies with sanitized errors without deleting persisted rows', () => {
  const f = fixture(), first = folder(f.db, f.a, f.c), second = folder(f.db, f.a, f.c, first)
  f.db.prepare('UPDATE folders SET parent_folder_id=? WHERE id=?').run(second, first)
  expect(() => f.r.listFolders(f.a)).toThrow('Local data operation failed')
  expect(f.db.prepare('SELECT count(*) AS n FROM folders').get()).toEqual({ n: 2 })
  f.db.prepare('UPDATE folders SET parent_folder_id=NULL WHERE id=?').run(first)
  let parent = second
  for (let depth = 3; depth <= 16; depth++) parent = folder(f.db, f.a, f.c, parent)
  expect(f.r.listFolders(f.a)).toHaveLength(16)
  folder(f.db, f.a, f.c, parent)
  expect(() => f.r.listLibraryRequests(f.a)).toThrow('Local data operation failed')
  expect(f.db.prepare('SELECT count(*) AS n FROM folders').get()).toEqual({ n: 17 })
  f.db.pragma('foreign_keys = OFF')
  f.db.prepare('UPDATE folders SET parent_folder_id=? WHERE id=?').run(randomUUID(), first)
  f.db.pragma('foreign_keys = ON')
  expect(() => f.r.listFolders(f.a)).toThrow('Local data operation failed')
})
it('reads metadata without configs/secrets and prunes stale/foreign tree expansion IDs on reopen', () => {
  const f = fixture(), root = folder(f.db, f.a, f.c), foreignFolder = folder(f.db, f.b, f.foreign)
  const secret = f.r.createSecret(f.a, 'session', null)
  const request = f.r.createRequest(f.a, 'Private configured request', f.c, { ...createDefaultRequestConfig(), method: 'POST', auth: { mode: 'bearer', token: { kind: 'secret', secretId: secret.id } } })
  f.db.prepare('UPDATE requests SET folder_id=? WHERE id=?').run(root, request.id)
  const metadata = f.r.listLibraryRequests(f.a)[0]!
  expect(metadata).toMatchObject({ method: 'POST', destination: { kind: 'folder', collectionId: f.c, folderId: root } })
  expect(Object.keys(metadata).sort()).toEqual(['createdAt','destination','id','method','name','updatedAt','workspaceId'])
  expect(JSON.stringify(metadata)).not.toContain(secret.id)
  expect(f.r.getTreeState(f.b)).toEqual({ workspaceId: f.b, version: 1, expandedCollectionIds: [], expandedFolderIds: [] })
  f.db.prepare('INSERT INTO workspace_tree_state VALUES (?,1,?)').run(f.a, JSON.stringify({ expandedCollectionIds: [f.c, f.foreign, randomUUID()], expandedFolderIds: [root, foreignFolder, randomUUID()] }))
  const expected = { workspaceId: f.a, version: 1, expandedCollectionIds: [f.c], expandedFolderIds: [root] }
  expect(f.r.getTreeState(f.a)).toEqual(expected)
  f.db.close(); const reopened = openDatabase(f.path)
  try { expect(new Repositories(reopened).getTreeState(f.a)).toEqual(expected) } finally { reopened.close() }
})
