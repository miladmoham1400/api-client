import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, truncateSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { createDefaultRequestConfig } from '../../src/shared/request-config'
import { WorkspaceExportService } from '../../src/main/services/workspace-export'
import { WorkspaceImportService, validateImport } from '../../src/main/services/workspace-import'
import { IMPORT_MAX_BYTES, readImport } from '../../src/main/files/import-read'
import { createImportHandlers } from '../../src/main/ipc/import'
const cleanups: (() => void)[] = []
afterEach(() => { vi.restoreAllMocks(); cleanups.splice(0).forEach(fn => fn()) })
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'api-client-import-')), db = openDatabase(join(dir, 'data.sqlite')), r = new Repositories(db)
  cleanups.push(() => { db.close(); rmSync(dir, { recursive: true, force: true }) })
  const w = r.createWorkspace('Source'), c = r.createCollection(w.id, 'Collection'), e = r.createEnvironment(w.id, 'Local')
  r.selectWorkspace(w.id)
  r.upsertVariable(w.id, null, 'plain', { isSensitive: false, plainValue: 'سلام', secretId: null })
  r.upsertVariable(w.id, e.id, 'token', { isSensitive: true, plainValue: null, secretId: r.createSecret(w.id, 'session', null).id })
  const row = (key: string, value: string, enabled = true) => ({ id: randomUUID(), key, value, enabled })
  r.createRequest(w.id, 'Request', c.id, { ...createDefaultRequestConfig(), method: 'POST', queryRows: [row('same','{{plain}}'),row('same','second',false)], headerRows: [row('Cookie','synthetic-secret')],
    auth: { mode: 'basic', username: { kind: 'template', template: '{{plain}}' }, password: { kind: 'secret', secretId: r.createSecret(w.id,'session',null).id } },
    body: { kind: 'multipart', rows: [{ ...row('text','hello'), kind: 'text' }, { id: randomUUID(), key: 'upload', kind: 'file', enabled: true, fileName: 'fixture.bin', fileSize: 6 }] } })
  r.setState(w.id, e.id, r.listRequests(w.id)[0]!.id)
  const dto = new WorkspaceExportService(db, []).snapshot(w.id), path = join(dir, 'import.json')
  writeFileSync(path, JSON.stringify(dto))
  return { dir, db, r, w, dto, path, service: new WorkspaceImportService(r) }
}
it('round-trips settings, remaps every ID and reference, keeps existing data/selection and creates unresolved omissions', () => {
  const f = fixture(), before = new WorkspaceExportService(f.db, []).snapshot(f.w.id)
  const created = f.r.importWorkspace(f.dto.workspace), output = new WorkspaceExportService(f.db, []).snapshot(created.id)
  expect(created.name).toBe('Source (imported)')
  expect(f.r.getSelectedWorkspace()).toBe(f.w.id)
  expect(f.r.getState(created.id)).toMatchObject({ activeEnvironmentId: null, selectedRequestId: null })
  expect(new WorkspaceExportService(f.db, []).snapshot(f.w.id).workspace).toEqual(before.workspace)
  const collectIds = (value: unknown): string[] => value && typeof value === 'object' ? Object.entries(value).flatMap(([key, v]) => key === 'id' ? [String(v)] : collectIds(v)) : []
  const oldIds = collectIds(f.dto), newIds = collectIds(output)
  expect(new Set(newIds).size).toBe(newIds.length)
  newIds.forEach(id => expect(oldIds).not.toContain(id))
  const config = output.workspace.requests[0]!.config, original = f.dto.workspace.requests[0]!.config
  expect(config.queryRows.map(({ key, value, enabled }) => ({ key, value, enabled }))).toEqual(original.queryRows.map(({ key, value, enabled }) => ({ key, value, enabled })))
  expect(config.auth).toEqual(original.auth)
  expect(output.workspace.requests[0]!.collectionId).toBe(output.workspace.collections[0]!.id)
  expect(output.workspace.variables.find(v => v.isSensitive)?.environmentId).toBe(output.workspace.environments[0]!.id)
  expect(output.workspace.variables.find(v => !v.isSensitive)).toMatchObject({ value: 'سلام' })
  expect(f.db.prepare('SELECT storage_mode,encrypted_value FROM secrets WHERE workspace_id=?').all(created.id)).toEqual([{ storage_mode: 'session', encrypted_value: null },{ storage_mode: 'session', encrypted_value: null }])
  const stored = f.r.getRequest(created.id, output.workspace.requests[0]!.id)
  expect(stored.config.body).not.toHaveProperty('fileId')
  expect(JSON.stringify(stored.config)).not.toContain('requiresSelection')
  expect(JSON.stringify(stored.config)).not.toContain('synthetic-secret')
})
it('preserves collection sort order, all body modes and truncates imported Unicode names safely', () => {
  const f = fixture(), source = structuredClone(f.dto.workspace)
  source.name = '😀'.repeat(100); source.collections[0]!.sortOrder = 7
  source.requests = [ { kind: 'none' }, { kind: 'json', text: '{"hello":"سلام"}' }, { kind: 'raw', text: 'text', mediaType: 'text/plain' }, { kind: 'urlencoded', rows: [{ id: randomUUID(), key: 'x', value: '{{plain}}', enabled: false }] } ].map(body => ({ ...f.dto.workspace.requests[0]!, id: randomUUID(), config: { ...f.dto.workspace.requests[0]!.config, body, auth: { mode: 'none' } } })) as typeof source.requests
  const created = f.r.importWorkspace(source)
  expect(Array.from(created.name)).toHaveLength(100); expect(created.name.endsWith(' (imported)')).toBe(true)
  expect(f.r.listCollections(created.id)[0]!.sortOrder).toBe(7)
  expect(f.r.listRequests(created.id).map(r => f.r.getRequest(created.id,r.id).config.body.kind).sort()).toEqual(['json','none','raw','urlencoded'])
  expect(f.r.importWorkspace(source).name).toBe(created.name)
})
it('rolls back all entities/secrets on injected late write failure, keeping existing database bytes', () => {
  const f = fixture()
  f.db.exec("CREATE TRIGGER fail_import BEFORE INSERT ON requests BEGIN SELECT RAISE(ABORT, 'synthetic write failure'); END")
  const before = f.db.serialize()
  expect(() => f.r.importWorkspace(f.dto.workspace)).toThrow('Local data operation failed')
  expect(f.db.serialize()).toEqual(before)
  expect(f.r.listWorkspaces()).toHaveLength(1)
})
it.each(['unsupported', 'script', 'path', 'secret', 'orphan', 'duplicate', 'keys', 'rows', 'header', 'method', 'limit'])('rejects %s before writes without leaking input', kind => {
  const f = fixture(), dto = structuredClone(f.dto), source = dto.workspace, request = source.requests[0]!
  const bytes = f.db.serialize()
  const value: unknown = kind === 'unsupported' ? { ...dto, version: 3 } : kind === 'script' ? { ...dto, script: 'synthetic-secret' }
    : kind === 'path' ? { ...dto, workspace: { ...source, requests: [{ ...request, config: { ...request.config, body: { kind: 'multipart', rows: [{ id: randomUUID(), key: 'upload', kind: 'file', enabled: true, path: '/synthetic/private', requiresSelection: true }] } } }] } }
    : kind === 'secret' ? { ...dto, workspace: { ...source, variables: source.variables.map(v => v.isSensitive ? { ...v, value: 'synthetic-secret' } : v) } }
    : kind === 'orphan' ? { ...dto, workspace: { ...source, requests: [{ ...request, collectionId: randomUUID() }] } }
    : kind === 'duplicate' ? { ...dto, workspace: { ...source, collections: [source.collections[0], source.collections[0]] } }
    : kind === 'keys' ? { ...dto, workspace: { ...source, variables: [...source.variables, { ...source.variables[0], id: randomUUID() }] } }
    : kind === 'rows' ? { ...dto, workspace: { ...source, requests: [{ ...request, config: { ...request.config, queryRows: [request.config.queryRows[0], request.config.queryRows[0]] } }] } }
    : kind === 'header' ? { ...dto, workspace: { ...source, requests: [{ ...request, config: { ...request.config, headerRows: [{ ...request.config.headerRows[0], value: 'synthetic-secret' }] } }] } }
    : kind === 'method' ? { ...dto, workspace: { ...source, requests: [{ ...request, config: { ...request.config, method: 'GET' } }] } }
    : { ...dto, workspace: { ...source, collections: Array.from({ length: 101 }, () => ({ ...source.collections[0], id: randomUUID() })) } }
  expect(() => validateImport(Buffer.from(JSON.stringify(value)))).toThrow()
  if (value && typeof value === 'object') expect(() => f.r.importWorkspace(Reflect.get(value, 'workspace') && kind !== 'unsupported' && kind !== 'script' ? Reflect.get(value, 'workspace') : value)).toThrow()
  expect(f.db.serialize()).toEqual(bytes)
})
it('bounds native file reads, rejects malformed/invalid UTF-8 and rejects size limit plus one', async () => {
  const f = fixture()
  expect(validateImport(await readImport(f.path))).toEqual(f.dto)
  for (const bytes of [Buffer.from('{'),Buffer.from([0xff]),Buffer.from('null')]) expect(() => validateImport(bytes)).toThrow()
  truncateSync(f.path, IMPORT_MAX_BYTES + 1)
  await expect(readImport(f.path)).rejects.toMatchObject({ code: 'IMPORT_TOO_LARGE' })
  expect(() => validateImport(Buffer.alloc(IMPORT_MAX_BYTES + 1))).toThrow()
  await expect(readImport(f.dir)).rejects.toMatchObject({ code: 'INVALID_IMPORT' })
  if (process.platform === 'linux') {
    const pipe = join(f.dir, 'pipe'); execFileSync('mkfifo', [pipe])
    await expect(readImport(pipe)).rejects.toMatchObject({ code: 'INVALID_IMPORT' })
  }
})
it('preview is names/counts only, binds to validated content, cancel/reload consumes tokens without changes', async () => {
  const f = fixture(), before = f.db.serialize()
  expect(await f.service.choose(async () => null, () => true)).toEqual({ status: 'cancelled' })
  const result = await f.service.choose(async () => f.path, () => true)
  if (result.status !== 'preview') throw new Error('Missing preview')
  expect(result.preview).toMatchObject({ name: 'Source', requests: 1, missingVariables: 1, missingCredentials: 1, missingFiles: 1 })
  expect(JSON.stringify(result.preview)).not.toContain('plain')
  f.service.cancel(result.preview.token)
  expect(() => f.service.confirm(result.preview.token)).toThrow()
  expect(f.db.serialize()).toEqual(before)
  const next = await f.service.choose(async () => f.path, () => true)
  if (next.status !== 'preview') throw new Error('Missing preview')
  writeFileSync(f.path, '{"script":"synthetic"}')
  expect(f.service.confirm(next.preview.token).name).toBe('Source (imported)')
  expect(() => f.service.confirm(next.preview.token)).toThrow()
  writeFileSync(f.path, JSON.stringify(f.dto))
  const last = await f.service.choose(async () => f.path, () => true)
  if (last.status !== 'preview') throw new Error('Missing preview')
  f.service.clear(); expect(() => f.service.confirm(last.preview.token)).toThrow()
})
it('checks exact owner/input and invalidates pending native selection on reload', async () => {
  const f = fixture(), frame = { url: 'file:///app/index.html' }, contents = { mainFrame: frame }, window = { isDestroyed: () => false, webContents: contents }, event = { sender: contents, senderFrame: frame }
  const choose = vi.fn(async () => f.path), handlers = createImportHandlers(() => window, frame.url, () => f.service, choose)
  expect(await handlers.choose(event,'/synthetic/path')).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  expect(await handlers.choose({ sender: {}, senderFrame: frame })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(choose).not.toHaveBeenCalled()
  expect(await handlers.confirm(event, randomUUID())).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  await expect(f.service.choose(async () => { f.service.clear(); return f.path }, () => true)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(f.service.choose(async () => f.path, () => false)).rejects.toMatchObject({ code: 'NOT_FOUND' })
})

it('preserves whitespace-only credential templates when another credential was omitted', () => {
  const f = fixture(), source = structuredClone(f.dto.workspace)
  source.requests[0]!.config.auth = { mode: 'basic', usernameTemplate: ' \t ', passwordTemplate: '', requiresCredentials: true }
  const created = f.r.importWorkspace(source), request = f.r.getRequest(created.id, f.r.listRequests(created.id)[0]!.id)
  expect(request.config.auth).toMatchObject({ mode: 'basic', username: { kind: 'template', template: ' \t ' }, password: { kind: 'secret' } })
})
