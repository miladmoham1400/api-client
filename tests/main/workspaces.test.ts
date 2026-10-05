import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { WorkspaceService } from '../../src/main/services/workspaces'
import { createWorkspaceHandlers } from '../../src/main/ipc/workspaces'
import { createDefaultRequestConfig } from '../../src/shared/request-config'

const resources: { db: Database.Database; directory: string }[] = []
afterEach(() => { for (const { db, directory } of resources.splice(0)) { if (db.open) db.close(); rmSync(directory, { recursive: true, force: true }) } })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-workspace-handler-'))
  const path = join(directory, 'test.sqlite'), db = openDatabase(path)
  resources.push({ db, directory })
  const service = new WorkspaceService(db)
  const frame = { url: 'file:///app/index.html' }, contents = { mainFrame: frame }
  const window = { isDestroyed: () => false, webContents: contents }
  const handlers = createWorkspaceHandlers(() => window, frame.url, () => service)
  return { db, service, directory, path, frame, contents, window, handlers, event: { sender: contents, senderFrame: frame } }
}
it('validates tuples before writes and only accepts owned main-frame operations', () => {
  const f = fixture()
  for (const args of [[' '], ['x'.repeat(101)], [{ name: 'Bad' }], ['Good', 'extra'], []]) expect(f.handlers.create(f.event, ...args)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  for (const event of [{ sender: {}, senderFrame: f.frame }, { sender: f.contents, senderFrame: null }, { sender: f.contents, senderFrame: { url: f.frame.url } }]) {
    expect(f.handlers.create(event, 'Forbidden')).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  }
  expect(f.service.list().workspaces).toEqual([])
  const created = f.handlers.create(f.event, '  یک پروژه  ')
  expect(created.ok).toBe(true)
  if (!created.ok) throw new Error('Create failed')
  const id = created.data.selectedWorkspaceId
  expect(id).not.toBeNull()
  expect(created.data.workspaces[0]?.name).toBe('یک پروژه')
  expect(f.handlers.rename(f.event, id, '   ')).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  expect(f.handlers.select(f.event, randomUUID())).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(f.handlers.delete(f.event, 'not-an-id')).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  f.window.isDestroyed = () => true
  expect(f.handlers.delete(f.event, id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(f.service.list()).toEqual(created.data)
})
it('persists metadata and selection, allows duplicate names and restores only existing selection', () => {
  const f = fixture(), first = f.service.create('Same'), a = first.selectedWorkspaceId
  if (!a) throw new Error('Missing selection')
  const b = f.service.create('Same').selectedWorkspaceId
  if (!b) throw new Error('Missing selection')
  expect(a).not.toBe(b)
  f.service.rename(a, 'Renamed'); f.service.select(a)
  f.db.close()
  const reopened = openDatabase(f.path)
  try {
    const service = new WorkspaceService(reopened)
    expect(service.list()).toMatchObject({ selectedWorkspaceId: a, workspaces: expect.arrayContaining([expect.objectContaining({ id: a, name: 'Renamed' }), expect.objectContaining({ id: b, name: 'Same' })]) })
    service.delete(b); expect(service.list().selectedWorkspaceId).toBe(a)
    service.delete(a); expect(service.list()).toEqual({ workspaces: [], selectedWorkspaceId: null })
    reopened.prepare("UPDATE app_settings SET value_json=? WHERE key='lastWorkspaceId'").run(JSON.stringify(randomUUID()))
    expect(service.list().selectedWorkspaceId).toBeNull()
  } finally { reopened.close() }
})
it('keeps mutations and selection atomic on injected writes or outgoing DTO failures', () => {
  const f = fixture(), first = f.service.create('Original')
  f.db.exec("CREATE TRIGGER fail_selection BEFORE UPDATE ON app_settings BEGIN SELECT RAISE(ABORT,'synthetic private failure'); END;")
  const result = f.handlers.create(f.event, 'Must roll back')
  expect(result).toMatchObject({ ok: false, error: { code: 'DATABASE_WRITE_FAILED' } })
  expect(JSON.stringify(result)).not.toContain('private')
  expect(f.service.list()).toEqual(first)
  f.db.exec('DROP TRIGGER fail_selection')
  const id = first.selectedWorkspaceId
  if (!id) throw new Error('Missing selection')
  f.db.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON workspaces BEGIN SELECT RAISE(ABORT,'synthetic deletion failure'); END;")
  expect(f.handlers.delete(f.event, id)).toMatchObject({ ok: false, error: { code: 'DATABASE_WRITE_FAILED' } })
  expect(f.service.list()).toEqual(first)
  f.db.exec('DROP TRIGGER fail_delete')
  f.db.prepare('UPDATE workspaces SET updated_at=? WHERE id=?').run('invalid timestamp', id)
  expect(f.handlers.create(f.event, 'Must also roll back')).toMatchObject({ ok: false })
  expect(f.db.prepare('SELECT name FROM workspaces').all()).toEqual([{ name: 'Original' }])
})
it('deletes only owned descendants and returns no descendant metadata in workspace snapshots', () => {
  const f = fixture(), r = new Repositories(f.db)
  const a = f.service.create('A').selectedWorkspaceId, b = f.service.create('B').selectedWorkspaceId
  if (!a || !b) throw new Error('Missing selection')
  for (const id of [a, b]) {
    const collection = r.createCollection(id, `Collection ${id}`)
    r.createRequest(id, `Request ${id}`, collection.id, { ...createDefaultRequestConfig(), auth: { mode: 'none' } })
    const environment = r.createEnvironment(id, `Environment ${id}`)
    const secret = r.createSecret(id, 'session', null)
    r.upsertVariable(id, environment.id, 'synthetic', { isSensitive: true, plainValue: null, secretId: secret.id })
  }
  const selected = f.service.select(a)
  expect(Object.keys(selected)).toEqual(['workspaces', 'selectedWorkspaceId'])
  expect(selected.workspaces.every(workspace => Object.keys(workspace).sort().join(',') === 'createdAt,id,name,updatedAt')).toBe(true)
  const before = { collections: r.listCollections(b), requests: r.listRequests(b), environments: r.listEnvironments(b) }
  expect(f.service.delete(a)).toMatchObject({ selectedWorkspaceId: null })
  expect({ collections: r.listCollections(b), requests: r.listRequests(b), environments: r.listEnvironments(b) }).toEqual(before)
  for (const table of ['collections', 'requests', 'environments', 'variables', 'secrets', 'workspace_state']) expect(f.db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE workspace_id=?`).get(a)).toEqual({ count: 0 })
})
it('returns sanitized errors when the database is unavailable', () => {
  const f = fixture(); f.db.close()
  expect(f.handlers.list(f.event)).toMatchObject({ ok: false, error: { code: 'DATABASE_UNAVAILABLE', retryable: true } })
  const unavailable = createWorkspaceHandlers(() => f.window, f.frame.url, () => null)
  expect(unavailable.create(f.event, 'Workspace')).toMatchObject({ ok: false, error: { code: 'DATABASE_UNAVAILABLE' } })
})
it('invalidates execution before deletion, only for an existing owned workspace', () => {
  const f = fixture(), id = f.service.create('A').selectedWorkspaceId
  if (!id) throw new Error('Missing selection')
  const order: string[] = []
  const service = new WorkspaceService(f.db, undefined, () => { order.push('deleted') }, workspace => {
    expect(workspace).toBe(id)
    expect(f.db.prepare('SELECT id FROM workspaces WHERE id=?').get(id)).toEqual({ id })
    order.push('abort')
  })
  expect(() => service.delete(randomUUID())).toThrow()
  expect(order).toEqual([])
  service.delete(id)
  expect(order).toEqual(['abort', 'deleted'])
  expect(f.db.prepare('SELECT id FROM workspaces WHERE id=?').get(id)).toBeUndefined()
})
