import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { RequestService } from '../../src/main/services/requests'
import { createRequestHandlers } from '../../src/main/ipc/requests'
import { createDefaultRequestConfig } from '../../src/shared/request-config'

const resources: { db: Database.Database; directory: string }[] = []
afterEach(() => { for (const { db, directory } of resources.splice(0)) { if (db.open) db.close(); rmSync(directory, { recursive: true, force: true }) } })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-request-handlers-')), path = join(directory, 'test.sqlite'), db = openDatabase(path)
  resources.push({ db, directory })
  const r = new Repositories(db), a = r.createWorkspace('A').id, b = r.createWorkspace('B').id
  r.selectWorkspace(a)
  const service = new RequestService(db), frame = { url: 'file:///app/index.html' }, contents = { mainFrame: frame }, window = { isDestroyed: () => false, webContents: contents }
  const handlers = createRequestHandlers(() => window, frame.url, () => service)
  return { db, path, r, a, b, service, handlers, event: { sender: contents, senderFrame: frame }, frame, contents }
}
const input = () => ({ name: 'Saved', method: 'GET' as const, urlTemplate: '', collectionId: null })
it('persists explicit create/save and selection with documented defaults; client edits alone do not write', () => {
  const f = fixture(), created = f.service.create(f.a, input()), saved = created.editor
  if (!saved) throw new Error('Missing editor')
  expect(f.r.getRequest(f.a, saved.id).config).toEqual({ ...createDefaultRequestConfig(), auth: { mode: 'none' } })
  const draft = { name: '  Edited  ', method: 'PATCH' as const, urlTemplate: '{{base_url}}/echo' }
  expect(f.service.list(f.a).editor).toEqual(saved)
  f.service.save(f.a, saved.id, draft)
  f.db.close()
  const reopened = openDatabase(f.path)
  try {
    expect(new RequestService(reopened).list(f.a).editor).toMatchObject({ id: saved.id, name: 'Edited', method: 'PATCH', urlTemplate: '{{base_url}}/echo' })
    expect(new Repositories(reopened).getRequest(f.a, saved.id).config).toMatchObject({ timeoutMs: 30000, followRedirects: false, body: { kind: 'none' }, auth: { mode: 'none' } })
  } finally { reopened.close() }
})
it('basic-field save preserves advanced configuration and credential references without returning them', () => {
  const f = fixture(), secret = f.r.createSecret(f.a, 'secure', Buffer.from('synthetic ciphertext'))
  const config = { ...createDefaultRequestConfig(), timeoutMs: 4567, followRedirects: true, body: { kind: 'json' as const, text: '{"fixture":true}' }, auth: { mode: 'bearer' as const, token: { kind: 'secret' as const, secretId: secret.id } } }
  const request = f.r.createRequest(f.a, 'Configured', null, config)
  const result = f.service.save(f.a, request.id, { name: 'Renamed', method: 'POST', urlTemplate: 'http://127.0.0.1/example' })
  expect(f.r.getRequest(f.a, request.id).config).toEqual({ ...config, method: 'POST', urlTemplate: 'http://127.0.0.1/example' })
  expect(JSON.stringify(result)).not.toContain(secret.id); expect(JSON.stringify(result)).not.toContain('ciphertext'); expect(result.editor?.auth).toMatchObject({ mode: 'bearer', token: { kind: 'stored' } })
})
it('duplicates with new request and independently owned secret IDs and main-only lifecycle mappings; deletion clears selection', () => {
  const f = fixture(), secret = f.r.createSecret(f.a, 'session', null)
  const request = f.r.createRequest(f.a, '😀'.repeat(100), null, { ...createDefaultRequestConfig(), auth: { mode: 'bearer', token: { kind: 'secret', secretId: secret.id } } })
  const mappings: { sourceId: string; id: string }[] = [], removed: string[] = []
  const service = new RequestService(f.db, { prepareDuplicateSessionValues: (_workspace, copies) => ({ commit: () => { expect(f.db.inTransaction).toBe(false); mappings.push(...copies) }, rollback: () => {} }), prepareRemoveSessionValues: (_workspace, ids) => ({ commit: () => { expect(f.db.inTransaction).toBe(false); removed.push(...ids) }, rollback: () => {} }) })
  const duplicate = service.duplicate(f.a, request.id).editor
  if (!duplicate) throw new Error('Missing copy')
  expect(duplicate.id).not.toBe(request.id); expect(Array.from(duplicate.name)).toHaveLength(100); expect(duplicate.name.endsWith(' (copy)')).toBe(true)
  expect(mappings).toHaveLength(1); expect(mappings[0]?.sourceId).toBe(secret.id); expect(mappings[0]?.id).not.toBe(secret.id)
  expect(JSON.stringify(service.list(f.a))).not.toContain('response')
  service.delete(f.a, duplicate.id)
  expect(service.list(f.a).editor).toBeNull(); expect(removed).toEqual([mappings[0]?.id]); expect(f.r.getRequest(f.a, request.id)).toEqual(request)
})
it('rejects foreign/missing IDs, foreign collection targets, unsafe payloads and foreign senders without writes', () => {
  const f = fixture(), foreign = f.r.createCollection(f.b, 'Foreign'), request = f.r.createRequest(f.b, 'Foreign request', foreign.id, { ...createDefaultRequestConfig(), auth: { mode: 'none' } })
  const bad = [f.handlers.get(f.event, f.a, request.id), f.handlers.save(f.event, f.a, request.id, { name: 'Bad', method: 'GET', urlTemplate: '' }), f.handlers.duplicate(f.event, f.a, request.id), f.handlers.delete(f.event, f.a, request.id), f.handlers.create(f.event, f.a, { ...input(), collectionId: foreign.id }), f.handlers.get(f.event, f.a, randomUUID()), f.handlers.list(f.event, f.b)]
  for (const result of bad) expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  for (const value of [{ ...input(), name: ' ' }, { ...input(), method: 'TRACE' }, { ...input(), auth: 'synthetic literal' }, { ...input(), urlTemplate: 'x'.repeat(10001) }]) expect(f.handlers.create(f.event, f.a, value)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  expect(f.handlers.create({ sender: {}, senderFrame: f.frame }, f.a, input())).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(f.r.listRequests(f.a)).toEqual([]); expect(f.r.getRequest(f.b, request.id)).toEqual(request)
})
it('failed save/create/delete preserve previous rows and selection and omit raw database errors', () => {
  const f = fixture(), before = f.service.create(f.a, input()), id = before.editor?.id
  if (!id) throw new Error('Missing request')
  f.db.exec("CREATE TRIGGER fail_request_save BEFORE UPDATE ON requests BEGIN SELECT RAISE(ABORT,'synthetic private failure'); END;")
  const failed = f.handlers.save(f.event, f.a, id, { name: 'Edited', method: 'POST', urlTemplate: 'new' })
  expect(failed).toMatchObject({ ok: false, error: { code: 'DATABASE_WRITE_FAILED' } }); expect(JSON.stringify(failed)).not.toContain('private')
  expect(f.service.list(f.a)).toEqual(before)
  f.db.exec('DROP TRIGGER fail_request_save')
  f.db.exec("CREATE TRIGGER fail_selection BEFORE UPDATE ON workspace_state BEGIN SELECT RAISE(ABORT,'synthetic selection failure'); END;")
  expect(f.handlers.create(f.event, f.a, input())).toMatchObject({ ok: false }); expect(f.service.list(f.a)).toEqual(before)
  expect(f.handlers.delete(f.event, f.a, id)).toMatchObject({ ok: false }); expect(f.service.list(f.a)).toEqual(before)
})

it('staged secret changes roll back when selection/deletion fails and never update live session state', () => {
  const f = fixture(), created = f.service.create(f.a, input()), id = created.editor?.id
  if (!id) throw new Error('Missing request')
  let commits = 0, rollbacks = 0
  const plan = () => ({ commit: () => { commits++ }, rollback: () => { rollbacks++ } })
  const service = new RequestService(f.db, { prepareDuplicateSessionValues: plan, prepareRemoveSessionValues: plan })
  f.db.exec("CREATE TRIGGER fail_selection BEFORE UPDATE ON workspace_state BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;")
  expect(() => service.duplicate(f.a, id)).toThrow()
  expect(() => service.delete(f.a, id)).toThrow()
  expect(commits).toBe(0); expect(rollbacks).toBe(2); expect(f.service.list(f.a)).toEqual(created)
})
it('ordered duplicate rows and settings save/reopen; omitted fields preserve existing settings', () => {
  const f = fixture(), a = f.service.newRow(f.a), b = f.service.newRow(f.a), header = f.service.newRow(f.a)
  expect(a.id).not.toBe(b.id); expect(f.r.listRequests(f.a)).toEqual([])
  const fields = { ...input(), queryRows: [{ ...a, key: 'same', value: 'one' }, { ...b, key: 'same', value: '', enabled: false }], headerRows: [{ ...header, key: 'X-Fixture', value: 'saved', enabled: false }], timeoutMs: 300000, followRedirects: true }
  const created = f.service.create(f.a, fields), id = created.editor?.id
  if (!id) throw new Error('Missing request')
  expect(created.editor).toMatchObject(fields)
  f.service.save(f.a, id, { name: 'Basic-only rename', method: 'GET', urlTemplate: '' })
  expect(f.r.getRequest(f.a, id).config).toMatchObject({ queryRows: fields.queryRows, headerRows: fields.headerRows, timeoutMs: 300000, followRedirects: true })
  f.db.close()
  const reopened = openDatabase(f.path)
  try { expect(new RequestService(reopened).list(f.a).editor).toMatchObject({ queryRows: fields.queryRows, headerRows: fields.headerRows, timeoutMs: 300000, followRedirects: true }) } finally { reopened.close() }
})
it('invalid fields are rejected with sanitized payload paths before database writes', () => {
  const f = fixture(), created = f.service.create(f.a, input()), id = created.editor?.id
  if (!id) throw new Error('Missing request')
  const rejected = f.handlers.save(f.event, f.a, id, { name: 'Saved', method: 'GET', urlTemplate: '', headerRows: [{ ...f.service.newRow(f.a), value: 'x'.repeat(10001) }] })
  expect(rejected).toMatchObject({ ok: false, error: { code: 'VALIDATION', field: 'headerRows[0].value' } })
  expect(f.handlers.save(f.event, f.a, id, { name: 'Saved', method: 'GET', urlTemplate: '', timeoutMs: 99 })).toMatchObject({ ok: false, error: { code: 'VALIDATION', field: 'timeoutMs' } })
  expect(f.handlers.newRow(f.event, f.b)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(f.service.list(f.a)).toEqual(created)
})

it('persists only the active text body unchanged and preserves it on partial saves and restart', () => {
  const f = fixture(), text = ' {\n "message": "سلام 🌍", "value": "{{value}}"\n}  '
  const created = f.service.create(f.a, { ...input(), method: 'POST', body: { kind: 'json', text } }), id = created.editor?.id
  if (!id) throw new Error('Missing request')
  expect(created.editor?.body).toEqual({ kind: 'json', text })
  f.service.save(f.a, id, { name: 'Renamed', method: 'POST', urlTemplate: '' })
  expect(f.service.list(f.a).editor?.body).toEqual({ kind: 'json', text })
  expect(f.handlers.save(f.event, f.a, id, { name: 'Bad', method: 'HEAD', urlTemplate: '', body: { kind: 'json', text: '' } })).toMatchObject({ ok: false, error: { field: 'body' } })
  expect(f.service.list(f.a).editor?.body).toEqual({ kind: 'json', text })
  f.service.save(f.a, id, { name: 'Raw', method: 'POST', urlTemplate: '', body: { kind: 'raw', text: 'سلام 🌍\n', mediaType: 'text/plain; charset=utf-8' } })
  f.db.close(); const reopened = openDatabase(f.path)
  try { expect(new RequestService(reopened).list(f.a).editor?.body).toEqual({ kind: 'raw', text: 'سلام 🌍\n', mediaType: 'text/plain; charset=utf-8' }) } finally { reopened.close() }
})
it('exposes stored URL-encoded forms and preserves them on partial saves', () => {
  const f = fixture(), body = { kind: 'urlencoded' as const, rows: [{ ...f.service.newRow(f.a), key: 'field', value: 'saved' }] }
  const request = f.r.createRequest(f.a, 'Existing', null, { ...createDefaultRequestConfig(), method: 'POST', body, auth: { mode: 'none' } })
  expect(f.service.get(f.a, request.id).editor?.body).toEqual(body)
  f.service.save(f.a, request.id, { name: 'Renamed', method: 'POST', urlTemplate: '' })
  expect(f.r.getRequest(f.a, request.id).config.body).toEqual(body)
})
it('validated form create/save preserves row values, rejects invalid rows and reopens after restart', () => {
  const f = fixture(), body = { kind: 'urlencoded' as const, rows: [{ ...f.service.newRow(f.a), key: 'same', value: '' }, { ...f.service.newRow(f.a), key: 'same', value: 'سلام %', enabled: false }] }
  const created = f.handlers.create(f.event, f.a, { ...input(), method: 'POST', body })
  expect(created).toMatchObject({ ok: true, data: { editor: { body } } })
  const selected = f.service.list(f.a).editor
  if (!selected) throw new Error('Missing form editor')
  expect(f.handlers.save(f.event, f.a, selected.id, { name: 'Invalid', method: 'POST', urlTemplate: '', body: { ...body, rows: [body.rows[0], body.rows[0]] } })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  expect(f.service.list(f.a).editor?.body).toEqual(body)
  f.db.close(); const reopened = openDatabase(f.path)
  try { expect(new RequestService(reopened).list(f.a).editor?.body).toEqual(body) } finally { reopened.close() }
})
