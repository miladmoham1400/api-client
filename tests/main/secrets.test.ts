import { afterEach, expect, it } from 'vitest'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { MaterializationService } from '../../src/main/services/materialization'
import { SecretStore, type StorageBackend } from '../../src/main/security/secrets'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { RequestService } from '../../src/main/services/requests'
import { WorkspaceService } from '../../src/main/services/workspaces'
import { createDefaultRequestConfig } from '../../src/shared/request-config'
const resources: { db: Database.Database; dir: string }[] = []
afterEach(() => { for (const { db, dir } of resources.splice(0)) { if (db.open) db.close(); rmSync(dir, { recursive: true, force: true }) } })
function backend(available = true, name = 'gnome_libsecret'): StorageBackend {
  const key = randomBytes(32)
  return { isEncryptionAvailable: () => available, getSelectedStorageBackend: () => name,
    encryptString: text => { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); return Buffer.concat([iv, cipher.update(text, 'utf8'), cipher.final(), cipher.getAuthTag()]) },
    decryptString: bytes => { const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(-16)); return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8') }
  }
}
function fixture(provider = backend()) {
  const dir = mkdtempSync(join(tmpdir(), 'api-client-secret-')), path = join(dir, 'test.sqlite'), db = openDatabase(path)
  resources.push({ db, dir }); const r = new Repositories(db), a = r.createWorkspace('A').id, b = r.createWorkspace('B').id; r.selectWorkspace(a)
  return { db, dir, path, r, a, b, provider, store: new SecretStore(db, provider, 'linux') }
}
const synthetic = 'synthetic-sensitive-سلام-fixture'
it('secure storage persists only ciphertext, restores on reopen, and rejects foreign ownership', () => {
  const f = fixture(), secret = f.store.create(f.a, synthetic)
  expect(secret.storageMode).toBe('secure'); expect(f.store.reveal(f.a, secret.secretId)).toBe(synthetic)
  expect(f.store.presence(f.a, secret.secretId)).toEqual({ hasValue: true, maskedDisplay: '••••••••', storageMode: 'secure' })
  expect(() => f.store.reveal(f.b, secret.secretId)).toThrow('Item not found')
  f.db.pragma('wal_checkpoint(TRUNCATE)')
  for (const file of readdirSync(f.dir)) expect(readFileSync(join(f.dir, file)).includes(Buffer.from(synthetic))).toBe(false)
  f.db.close(); const reopened = openDatabase(f.path)
  try { expect(new SecretStore(reopened, f.provider, 'linux').reveal(f.a, secret.secretId)).toBe(synthetic) } finally { reopened.close() }
})
it.each([[false, 'gnome_libsecret'], [true, 'basic_text'], [true, 'unknown']] as const)('capability %s/%s is session-only and missing after restart', (available, name) => {
  const provider = backend(available, name); provider.encryptString = () => { throw new Error('Encryption must not be called') }
  const f = fixture(provider), secret = f.store.create(f.a, synthetic)
  expect(secret.storageMode).toBe('session'); expect(f.r.getSecret(f.a, secret.secretId).encryptedValue).toBeNull()
  expect(f.store.reveal(f.a, secret.secretId)).toBe(synthetic)
  f.db.pragma('wal_checkpoint(TRUNCATE)')
  for (const file of readdirSync(f.dir)) expect(readFileSync(join(f.dir, file)).includes(Buffer.from(synthetic))).toBe(false)
  expect(new SecretStore(f.db, provider, 'linux').presence(f.a, secret.secretId).hasValue).toBe(false)
  expect(() => new SecretStore(f.db, provider, 'linux').reveal(f.a, secret.secretId)).toThrow('Local data operation failed')
})
it('fails encryption/decryption explicitly without deleting or replacing records or exposing details', () => {
  const f = fixture(), secret = f.store.create(f.a, synthetic), before = f.r.getSecret(f.a, secret.secretId)
  f.provider.decryptString = () => { throw new Error(synthetic) }
  try { f.store.reveal(f.a, secret.secretId); throw new Error('Expected failure') } catch (error) { expect(error).toMatchObject({ code: 'SECRET_UNAVAILABLE' }); expect(String(error)).not.toContain(synthetic) }
  expect(f.store.presence(f.a, secret.secretId).hasValue).toBe(true); expect(f.r.getSecret(f.a, secret.secretId)).toEqual(before)
  f.provider.encryptString = () => { throw new Error(synthetic) }
  expect(() => f.store.update(f.a, secret.secretId, 'replacement')).toThrow('Local data operation failed')
  expect(f.r.getSecret(f.a, secret.secretId)).toEqual(before)
})
it('sensitive variable conversion/removal and auth records use owned handles in owner transactions', () => {
  const f = fixture(backend(false)), variable = f.store.transaction(() => {
    const handle = f.store.create(f.a, synthetic)
    return f.r.upsertVariable(f.a, null, 'fixture', { isSensitive: true, plainValue: null, secretId: handle.secretId })
  })
  expect(variable.plainValue).toBeNull(); if (!variable.secretId) throw new Error('Missing secret')
  expect(f.store.reveal(f.a, variable.secretId)).toBe(synthetic)
  f.store.transaction(() => f.r.upsertVariable(f.a, null, 'fixture', { isSensitive: false, plainValue: 'ordinary', secretId: null }))
  expect(() => f.store.reveal(f.a, variable.secretId!)).toThrow('Item not found')
  const handle = f.store.create(f.a, synthetic)
  const request = f.store.transaction(() => f.r.createRequest(f.a, 'Owned', null, { ...createDefaultRequestConfig(), auth: { mode: 'bearer', token: { kind: 'secret', secretId: handle.secretId } } }))
  expect(JSON.stringify(request)).not.toContain(synthetic)
  expect(() => f.r.createRequest(f.b, 'Foreign', null, request.config)).toThrow('Item not found')
})
it.each([true, false])('duplicates independent auth values and deletion retains the original (secure=%s)', available => {
  const f = fixture(backend(available)), handle = f.store.create(f.a, synthetic)
  const request = f.r.createRequest(f.a, 'Owned', null, { ...createDefaultRequestConfig(), auth: { mode: 'basic', username: { kind: 'secret', secretId: handle.secretId }, password: { kind: 'template', template: '{{fixture}}' } } })
  const service = new RequestService(f.db, f.store), copy = service.duplicate(f.a, request.id).editor
  if (!copy) throw new Error('Missing copy')
  const auth = f.r.getRequest(f.a, copy.id).config.auth
  if (auth.mode !== 'basic' || auth.username.kind !== 'secret') throw new Error('Missing handle')
  expect(auth.username.secretId).not.toBe(handle.secretId); expect(f.store.reveal(f.a, auth.username.secretId)).toBe(synthetic)
  f.store.update(f.a, auth.username.secretId, 'synthetic-independent')
  expect(f.store.reveal(f.a, handle.secretId)).toBe(synthetic)
  const copySecretId = auth.username.secretId
  service.delete(f.a, copy.id); expect(() => f.store.reveal(f.a, copySecretId)).toThrow('Item not found')
  expect(f.store.reveal(f.a, handle.secretId)).toBe(synthetic)
})
it('rolls back owner writes/session updates and staged duplication/deletion on database failure', () => {
  const f = fixture(backend(false)), handle = f.store.create(f.a, synthetic)
  expect(() => f.store.transaction(() => { f.store.update(f.a, handle.secretId, 'changed'); throw new Error('synthetic failure') })).toThrow('Local data operation failed')
  expect(f.store.reveal(f.a, handle.secretId)).toBe(synthetic)
  const request = f.r.createRequest(f.a, 'Owned', null, { ...createDefaultRequestConfig(), auth: { mode: 'bearer', token: { kind: 'secret', secretId: handle.secretId } } }), service = new RequestService(f.db, f.store)
  service.get(f.a, request.id)
  f.db.exec("CREATE TRIGGER fail_selection BEFORE UPDATE ON workspace_state BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;")
  expect(() => service.duplicate(f.a, request.id)).toThrow(); expect(() => service.delete(f.a, request.id)).toThrow()
  expect(f.r.listRequests(f.a)).toHaveLength(1); expect(f.store.reveal(f.a, handle.secretId)).toBe(synthetic)
})
it('unresolved copies remain missing, capability changes re-encode copies, and workspace cleanup clears committed values', () => {
  const f = fixture(backend(false)), handle = f.store.unresolved(f.a)
  const request = f.r.createRequest(f.a, 'Missing', null, { ...createDefaultRequestConfig(), auth: { mode: 'bearer', token: { kind: 'secret', secretId: handle.secretId } } }), service = new RequestService(f.db, f.store)
  const copy = service.duplicate(f.a, request.id).editor
  if (!copy) throw new Error('Missing copy')
  const auth = f.r.getRequest(f.a, copy.id).config.auth
  if (auth.mode !== 'bearer' || auth.token.kind !== 'secret') throw new Error('Missing handle')
  expect(f.store.presence(f.a, auth.token.secretId).hasValue).toBe(false)
  f.store.update(f.a, handle.secretId, synthetic); f.provider.isEncryptionAvailable = () => true
  const secureCopy = service.duplicate(f.a, request.id).editor
  if (!secureCopy) throw new Error('Missing secure copy')
  const secureAuth = f.r.getRequest(f.a, secureCopy.id).config.auth
  if (secureAuth.mode !== 'bearer' || secureAuth.token.kind !== 'secret') throw new Error('Missing secure handle')
  expect(f.store.presence(f.a, secureAuth.token.secretId).storageMode).toBe('secure')
  new WorkspaceService(f.db, f.store).delete(f.a)
  expect(() => f.store.reveal(f.a, handle.secretId)).toThrow('Item not found')
  f.store.clear()
})
it('secure duplication failure rolls back new handles; backend failure never falls back to plaintext', () => {
  const f = fixture(), handle = f.store.create(f.a, synthetic)
  const request = f.r.createRequest(f.a, 'Owned', null, { ...createDefaultRequestConfig(), auth: { mode: 'bearer', token: { kind: 'secret', secretId: handle.secretId } } })
  const service = new RequestService(f.db, f.store)
  f.provider.decryptString = () => { throw new Error('synthetic backend detail') }
  expect(() => service.duplicate(f.a, request.id)).toThrow('Local data operation failed')
  expect(f.r.listRequests(f.a)).toHaveLength(1)
  expect(f.db.prepare('SELECT count(*) AS count FROM secrets').get()).toEqual({ count: 1 })
  f.provider.isEncryptionAvailable = () => { throw new Error('synthetic capability detail') }
  expect(f.store.capability()).toBe('session')
  expect(() => f.store.reveal(f.a, handle.secretId)).toThrow('Local data operation failed')
})
it('masked presence never decrypts and Windows availability does not call Linux backend selection', () => {
  const f = fixture(), handle = f.store.create(f.a, synthetic)
  f.provider.decryptString = () => { throw new Error('Unexpected decrypt') }
  expect(f.store.presence(f.a, handle.secretId).hasValue).toBe(true)
  f.provider.getSelectedStorageBackend = () => { throw new Error('Linux-only backend call') }
  expect(new SecretStore(f.db, f.provider, 'win32').capability()).toBe('secure')
})

it('auth editor persists literals as owned handles and keeps/replaces/removes them transactionally', () => {
  const f = fixture(backend(false)), service = new RequestService(f.db, f.store, f.store)
  const result = service.create(f.a, { name: 'Auth', method: 'POST', urlTemplate: 'http://localhost/', collectionId: null, auth: { mode: 'basic', username: { kind: 'value', value: 'synthetic-user' }, password: { kind: 'value', value: synthetic } } })
  const id = result.editor!.id
  expect(result.editor?.auth).toMatchObject({ mode: 'basic', username: { kind: 'stored', hasValue: true }, password: { kind: 'stored', storageMode: 'session' } })
  expect(JSON.stringify(result)).not.toContain(synthetic); expect(JSON.stringify(f.r.getRequest(f.a, id))).not.toContain(synthetic)
  const auth = f.r.getRequest(f.a, id).config.auth
  if (auth.mode !== 'basic' || auth.password.kind !== 'secret') throw new Error('Missing password handle')
  service.save(f.a, id, { name: 'Keep', method: 'POST', urlTemplate: 'http://localhost/', auth: { mode: 'basic', username: { kind: 'keep' }, password: { kind: 'keep' } } })
  expect(f.r.getRequest(f.a, id).config.auth).toEqual(auth)
  f.db.exec("CREATE TRIGGER fail_auth BEFORE UPDATE ON requests BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;")
  expect(() => service.save(f.a, id, { name: 'Replace', method: 'POST', urlTemplate: '', auth: { mode: 'bearer', token: { kind: 'value', value: 'synthetic-new' } } })).toThrow()
  expect(f.store.reveal(f.a, auth.password.secretId)).toBe(synthetic)
  expect(f.db.prepare('SELECT count(*) AS count FROM secrets').get()).toEqual({ count: 2 })
  f.db.exec('DROP TRIGGER fail_auth')
  service.save(f.a, id, { name: 'None', method: 'POST', urlTemplate: '', auth: { mode: 'none' } })
  expect(f.db.prepare('SELECT count(*) AS count FROM secrets').get()).toEqual({ count: 0 })
})
it('captures selected owned variables and auth in main without changing saved templates or exposing resolved secrets in editor DTOs', () => {
  const f = fixture(backend(false)), service = new RequestService(f.db, f.store, f.store)
  const environment = f.r.createEnvironment(f.a, 'Active').id
  f.r.upsertVariable(f.a, null, 'host', { isSensitive: false, plainValue: 'http://workspace.invalid', secretId: null })
  f.r.upsertVariable(f.a, environment, 'host', { isSensitive: false, plainValue: 'http://localhost', secretId: null })
  f.store.transaction(() => { const secret = f.store.create(f.a, 'synthetic-variable-token'); f.r.upsertVariable(f.a, environment, 'fixture', { isSensitive: true, plainValue: null, secretId: secret.secretId }) })
  const created = service.create(f.a, { name: 'Template', method: 'POST', urlTemplate: '{{host}}/echo', collectionId: null, auth: { mode: 'bearer', token: { kind: 'value', value: '{{fixture}}' } } }), id = created.editor!.id
  expect(created.editor?.auth).toEqual({ mode: 'bearer', token: { kind: 'value', value: '{{fixture}}' } })
  f.r.setState(f.a, environment, id)
  const before = f.r.getRequest(f.a, id), capture = new MaterializationService(f.db, f.store)
  const result = capture.capture(f.a, id, { name: 'Template', method: 'POST', urlTemplate: '{{host}}/echo', auth: { mode: 'bearer', token: { kind: 'keep' } } }, environment)
  expect(result).toMatchObject({ ok: true, data: { url: 'http://localhost/echo', headers: [{ name: 'Authorization', value: 'Bearer synthetic-variable-token' }, { name: 'Accept-Encoding', value: 'gzip, deflate, br' }] } })
  expect(f.r.getRequest(f.a, id)).toEqual(before); expect(JSON.stringify(service.list(f.a))).not.toContain('synthetic-variable-token')
  f.r.upsertVariable(f.a, environment, 'host', { isSensitive: false, plainValue: 'http://changed.invalid', secretId: null })
  expect(result.ok && result.data.url).toBe('http://localhost/echo')
  f.r.setState(f.a, null, id)
  expect(capture.capture(f.a, id, { name: 'Template', method: 'POST', urlTemplate: '{{host}}/echo' }, null)).toMatchObject({ ok: false, error: { code: 'VARIABLE_MISSING' } })
  const foreign = f.r.createEnvironment(f.b, 'Foreign').id
  expect(capture.capture(f.a, id, { name: 'Template', method: 'POST', urlTemplate: 'http://localhost/' }, foreign)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
})
it('missing session auth stays masked after restart and cannot materialize until explicitly replaced', () => {
  const f = fixture(backend(false)), service = new RequestService(f.db, f.store, f.store)
  const created = service.create(f.a, { name: 'Auth', method: 'POST', urlTemplate: 'http://localhost/', collectionId: null, auth: { mode: 'bearer', token: { kind: 'value', value: 'synthetic-literal' } } }), id = created.editor!.id
  const restarted = new SecretStore(f.db, f.provider, 'linux'), fresh = new RequestService(f.db, restarted, restarted)
  expect(fresh.list(f.a).editor?.auth).toMatchObject({ mode: 'bearer', token: { kind: 'stored', hasValue: false } })
  expect(new MaterializationService(f.db, restarted).capture(f.a, id, { name: 'Auth', method: 'POST', urlTemplate: 'http://localhost/', auth: { mode: 'bearer', token: { kind: 'keep' } } }, null)).toMatchObject({ ok: false, error: { code: 'SECRET_UNAVAILABLE' } })
  expect(() => fresh.create(f.a, { name: 'Invalid', method: 'GET', urlTemplate: '', collectionId: null, auth: { mode: 'bearer', token: { kind: 'keep' } } })).toThrow()
})
