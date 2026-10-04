import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { SecretStore } from '../../src/main/security/secrets'
import { VariableService } from '../../src/main/services/variables'
import { createVariableHandlers } from '../../src/main/ipc/variables'
const resources: { db: Database.Database; dir: string }[] = []
afterEach(() => { for (const { db, dir } of resources.splice(0)) { if (db.open) db.close(); rmSync(dir, { recursive: true, force: true }) } })
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'api-client-variables-')), path = join(dir, 'test.sqlite'), db = openDatabase(path); resources.push({ db, dir })
  const r = new Repositories(db), a = r.createWorkspace('A').id, b = r.createWorkspace('B').id; r.selectWorkspace(a)
  const provider = { isEncryptionAvailable: () => false, getSelectedStorageBackend: () => 'basic_text', encryptString: () => Buffer.alloc(0), decryptString: () => '' }
  const store = new SecretStore(db, provider, 'linux'), service = new VariableService(db, store)
  const frame = { url: 'file:///app/index.html' }, contents = { mainFrame: frame }, event = { sender: contents, senderFrame: frame }
  const handlers = createVariableHandlers(() => ({ isDestroyed: () => false, webContents: contents }), frame.url, () => service)
  return { dir, path, db, r, a, b, store, service, handlers, event, provider }
}
it('environment CRUD preserves per-workspace selection and selected request state across reopen', () => {
  const f = fixture(), id = f.service.createEnvironment(f.a, ' Local ').environments[0]!.id
  f.service.select(f.a, id); f.service.renameEnvironment(f.a, id, 'Renamed')
  f.r.selectWorkspace(f.b); f.service.createEnvironment(f.b, 'Other'); f.r.selectWorkspace(f.a)
  expect(f.service.environments(f.a)).toMatchObject({ activeEnvironmentId: id, environments: [{ name: 'Renamed' }] })
  f.db.close(); const reopened = openDatabase(f.path)
  try { expect(new Repositories(reopened).getState(f.a).activeEnvironmentId).toBe(id) } finally { reopened.close() }
})
it('effective preview uses only selected owned scopes, empty override and case-sensitive keys; duplicate creation fails', () => {
  const f = fixture(), e = f.service.createEnvironment(f.a, 'Active').environments[0]!.id
  f.service.upsert(f.a, null, 'host', 'workspace', false)
  f.service.upsert(f.a, null, 'Host', 'different', false)
  f.service.upsert(f.a, e, 'host', '', false); f.service.select(f.a, e)
  expect(f.service.list(f.a, null).effective.map(v => [v.key, v.isSensitive ? null : v.value, v.environmentId])).toEqual([['Host', 'different', null], ['host', '', e]])
  expect(f.handlers.variables.upsert(f.event, f.a, null, 'host', 'duplicate', false)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  const id = f.service.list(f.a, null).items.find(v => v.key === 'host')!.id
  f.service.upsert(f.a, null, 'host', 'updated', false, id)
  f.service.select(f.a, null); expect(f.service.list(f.a, null).effective.find(v => v.key === 'host')).toMatchObject({ value: 'updated', environmentId: null })
})
it('lists mask sensitive values/handles; explicit reveal and conversion work with session restart missing state', () => {
  const f = fixture(), result = f.service.upsert(f.a, null, 'fixture', 'synthetic-sensitive-variable', true), id = result.items[0]!.id
  expect(JSON.stringify(result)).not.toContain('synthetic-sensitive-variable'); expect(JSON.stringify(result)).not.toContain('secretId')
  expect(f.handlers.variables.reveal(f.event, f.a, id)).toEqual({ ok: true, data: { value: 'synthetic-sensitive-variable' } })
  const restarted = new VariableService(f.db, new SecretStore(f.db, f.provider, 'linux'))
  expect(restarted.list(f.a, null).items[0]).toMatchObject({ isSensitive: true, hasValue: false, storageMode: 'session' })
  expect(() => restarted.reveal(f.a, id)).toThrow('Local data operation failed')
  f.service.upsert(f.a, null, 'fixture', 'ordinary', false, id)
  expect(f.db.prepare('SELECT count(*) AS count FROM secrets').get()).toEqual({ count: 0 })
  f.service.delete(f.a, id); expect(f.service.list(f.a, null).items).toEqual([])
})
it('active environment deletion atomically selects None and removes sensitive records; failures roll back', () => {
  const f = fixture(), id = f.service.createEnvironment(f.a, 'Active').environments[0]!.id
  const v = f.service.upsert(f.a, id, 'fixture', 'synthetic-value', true).items[0]!
  f.service.select(f.a, id)
  f.db.exec("CREATE TRIGGER fail_env BEFORE DELETE ON environments BEGIN SELECT RAISE(ABORT,'synthetic private failure'); END;")
  expect(f.handlers.environments.delete(f.event, f.a, id)).toMatchObject({ ok: false, error: { code: 'DATABASE_WRITE_FAILED' } })
  expect(f.service.environments(f.a).activeEnvironmentId).toBe(id); expect(f.service.reveal(f.a, v.id)).toEqual({ value: 'synthetic-value' })
  f.db.exec('DROP TRIGGER fail_env'); f.service.deleteEnvironment(f.a, id)
  expect(f.service.environments(f.a).activeEnvironmentId).toBeNull(); expect(f.db.prepare('SELECT count(*) AS count FROM secrets').get()).toEqual({ count: 0 })
})
it('rejects foreign scope/IDs, inactive workspace, malformed input and foreign sender without writes', () => {
  const f = fixture(), foreign = f.r.createEnvironment(f.b, 'Foreign').id
  for (const result of [f.handlers.variables.list(f.event, f.a, foreign), f.handlers.environments.select(f.event, f.a, foreign), f.handlers.environments.list(f.event, f.b), f.handlers.variables.reveal({ sender: {}, senderFrame: f.event.senderFrame }, f.a, foreign)]) expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(f.handlers.variables.upsert(f.event, f.a, null, 'bad key', '', false)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  expect(f.handlers.variables.upsert(f.event, f.a, null, 'valid', 'x'.repeat(10001), false)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  expect(f.service.list(f.a, null).items).toEqual([])
})

it('secure sensitive variables remain masked and explicitly reveal after database reopen with injected secure storage', () => {
  const f = fixture(), key = randomBytes(32)
  const provider = {
    isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptString: (text: string) => { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); return Buffer.concat([iv, cipher.update(text, 'utf8'), cipher.final(), cipher.getAuthTag()]) },
    decryptString: (bytes: Buffer) => { const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(-16)); return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString('utf8') }
  }
  const service = new VariableService(f.db, new SecretStore(f.db, provider, 'linux'))
  const result = service.upsert(f.a, null, 'fixture', 'synthetic-secure-variable', true), id = result.items[0]!.id
  f.db.close(); const reopened = openDatabase(f.path)
  try {
    const restored = new VariableService(reopened, new SecretStore(reopened, provider, 'linux'))
    expect(restored.list(f.a, null).items[0]).toMatchObject({ hasValue: true, storageMode: 'secure', maskedDisplay: '••••••••' })
    expect(JSON.stringify(restored.list(f.a, null))).not.toContain('synthetic-secure-variable')
    expect(restored.reveal(f.a, id)).toEqual({ value: 'synthetic-secure-variable' })
  } finally { reopened.close() }
})
