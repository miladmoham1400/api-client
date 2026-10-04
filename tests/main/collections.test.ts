import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { CollectionService } from '../../src/main/services/collections'
import { createCollectionHandlers } from '../../src/main/ipc/collections'
import { createDefaultRequestConfig } from '../../src/shared/request-config'
import { groupingSchema } from '../../src/shared/collections'

const resources: { db: Database.Database; directory: string }[] = []
afterEach(() => { for (const { db, directory } of resources.splice(0)) { if (db.open) db.close(); rmSync(directory, { recursive: true, force: true }) } })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-collection-handlers-')), path = join(directory, 'test.sqlite'), db = openDatabase(path)
  resources.push({ db, directory })
  const r = new Repositories(db), a = r.createWorkspace('A').id, b = r.createWorkspace('B').id
  r.selectWorkspace(a)
  const service = new CollectionService(db), frame = { url: 'file:///app/index.html' }, contents = { mainFrame: frame }, window = { isDestroyed: () => false, webContents: contents }
  const handlers = createCollectionHandlers(() => window, frame.url, () => service)
  return { db, path, r, a, b, service, handlers, frame, contents, window, event: { sender: contents, senderFrame: frame } }
}
const config = () => ({ ...createDefaultRequestConfig(), auth: { mode: 'none' as const } })
it('validates collection names and exact payloads and rejects unowned frames before writing', () => {
  const f = fixture()
  for (const args of [[f.a, ' '], [f.a, 'x'.repeat(101)], [f.a, { name: 'Invalid' }], [f.a, 'Good', 'extra'], ['bad', 'Good']]) expect(f.handlers.create(f.event, ...args)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  for (const event of [{ sender: {}, senderFrame: f.frame }, { sender: f.contents, senderFrame: null }, { sender: f.contents, senderFrame: { url: f.frame.url } }]) expect(f.handlers.create(event, f.a, 'Forbidden')).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(f.service.list(f.a).collections).toEqual([])
  expect(f.handlers.create(f.event, f.a, '  گروه  ')).toMatchObject({ ok: true, data: { collections: [expect.objectContaining({ name: 'گروه', workspaceId: f.a })] } })
  f.window.isDestroyed = () => true
  expect(f.handlers.list(f.event, f.a)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
})
it('allows ID-distinct duplicates, moves between collections/root and persists rename/grouping after reopen', () => {
  const f = fixture(), c = f.service.create(f.a, 'Same').collections[0]
  if (!c) throw new Error('Missing collection')
  const d = f.service.create(f.a, 'Same').collections.find(item => item.id !== c.id)
  if (!d) throw new Error('Missing duplicate')
  const q = f.r.createRequest(f.a, 'Saved', null, config())
  expect(f.service.move(f.a, q.id, c.id).requests[0]?.collectionId).toBe(c.id)
  f.service.move(f.a, q.id, d.id); f.service.rename(f.a, d.id, 'Renamed')
  const expected = f.service.list(f.a)
  expect(Object.keys(expected.requests[0] ?? {})).not.toContain('config')
  f.db.close()
  const reopened = openDatabase(f.path)
  try {
    const service = new CollectionService(reopened)
    expect(service.list(f.a)).toEqual(expected)
    expect(service.move(f.a, q.id, null).requests[0]?.collectionId).toBeNull()
    expect(new Repositories(reopened).getRequest(f.a, q.id).config).toEqual(config())
  } finally { reopened.close() }
})
it('enforces active workspace and descendant/target ownership on every operation', () => {
  const f = fixture(), c = f.r.createCollection(f.a, 'A collection'), d = f.r.createCollection(f.b, 'Foreign collection'), q = f.r.createRequest(f.a, 'A request', c.id, config()), other = f.r.createRequest(f.b, 'Foreign request', d.id, config())
  const before = f.service.list(f.a)
  const results = [f.handlers.list(f.event, f.b), f.handlers.create(f.event, f.b, 'Forbidden'), f.handlers.rename(f.event, f.a, d.id, 'Forbidden'), f.handlers.delete(f.event, f.a, d.id), f.handlers.move(f.event, f.a, q.id, d.id), f.handlers.move(f.event, f.a, other.id, null), f.handlers.move(f.event, f.b, other.id, null), f.handlers.delete(f.event, f.a, randomUUID())]
  for (const result of results) expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(f.service.list(f.a)).toEqual(before)
  f.r.selectWorkspace(f.b)
  const snapshot = f.service.list(f.b)
  expect(snapshot.collections.map(item => item.id)).toEqual([d.id]); expect(snapshot.requests.map(item => item.id)).toEqual([other.id])
  expect(f.handlers.list(f.event, f.a)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
})
it('collection deletion moves owned saved requests to root and preserves configuration/selection and other workspace', () => {
  const f = fixture(), c = f.r.createCollection(f.a, 'Delete'), d = f.r.createCollection(f.b, 'Keep'), q = f.r.createRequest(f.a, 'Saved', c.id, config()), other = f.r.createRequest(f.b, 'Other', d.id, config())
  f.r.setState(f.a, null, q.id)
  expect(f.handlers.delete(f.event, f.a, c.id)).toMatchObject({ ok: true, data: { collections: [], requests: [expect.objectContaining({ id: q.id, collectionId: null })] } })
  expect(f.r.getRequest(f.a, q.id).config).toEqual(config()); expect(f.r.getState(f.a).selectedRequestId).toBe(q.id)
  expect(f.r.getRequest(f.b, other.id)).toEqual(other); expect(f.r.getCollection(f.b, d.id)).toEqual(d)
})
it('rolls back move/delete and outgoing-validation failures without exposing raw errors', () => {
  const f = fixture(), c = f.r.createCollection(f.a, 'Group'), q = f.r.createRequest(f.a, 'Saved', c.id, config()), before = f.service.list(f.a)
  f.db.exec("CREATE TRIGGER fail_collection_delete BEFORE DELETE ON collections BEGIN SELECT RAISE(ABORT,'synthetic private failure'); END;")
  const failed = f.handlers.delete(f.event, f.a, c.id)
  expect(failed).toMatchObject({ ok: false, error: { code: 'DATABASE_WRITE_FAILED' } }); expect(JSON.stringify(failed)).not.toContain('private')
  expect(f.service.list(f.a)).toEqual(before)
  f.db.exec('DROP TRIGGER fail_collection_delete')
  f.db.exec("CREATE TRIGGER fail_request_move BEFORE UPDATE ON requests BEGIN SELECT RAISE(ABORT,'synthetic move failure'); END;")
  expect(f.handlers.move(f.event, f.a, q.id, null)).toMatchObject({ ok: false, error: { code: 'DATABASE_WRITE_FAILED' } })
  expect(f.service.list(f.a)).toEqual(before)
  f.db.exec('DROP TRIGGER fail_request_move')
  f.db.prepare('UPDATE requests SET updated_at=? WHERE id=?').run('invalid timestamp', q.id)
  expect(f.handlers.create(f.event, f.a, 'Must roll back')).toMatchObject({ ok: false })
  expect(f.r.listCollections(f.a)).toEqual([c])
})
it('rejects foreign/inconsistent output DTOs and reports unavailable database safely', () => {
  const f = fixture(), c = f.r.createCollection(f.a, 'Group'), snapshot = f.service.list(f.a)
  expect(groupingSchema.safeParse({ ...snapshot, collections: [{ ...c, workspaceId: f.b }] }).success).toBe(false)
  expect(groupingSchema.safeParse({ ...snapshot, collections: [c, c] }).success).toBe(false)
  f.r.createRequest(f.a, 'Saved', c.id, config())
  const request = f.r.listRequests(f.a)[0]
  if (!request) throw new Error('Missing summary')
  expect(groupingSchema.safeParse({ ...snapshot, requests: [{ ...request, collectionId: randomUUID() }] }).success).toBe(false)
  f.db.close()
  expect(f.handlers.list(f.event, f.a)).toMatchObject({ ok: false, error: { code: 'DATABASE_UNAVAILABLE' } })
})
