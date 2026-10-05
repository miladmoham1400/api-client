import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { createDefaultRequestConfig, type StoredRequestConfig } from '../../src/shared/request-config'
import { workspaceExportSchema } from '../../src/shared/transfer'
import { WorkspaceExportService } from '../../src/main/services/workspace-export'
import { serializeWorkspace, type ExportSnapshot } from '../../src/main/services/export-serializer'
import { writeExportFile } from '../../src/main/files/export-write'
import { createExportHandler } from '../../src/main/ipc/export'

const cleanups: (() => void)[] = []
afterEach(() => { vi.restoreAllMocks(); for (const cleanup of cleanups.splice(0)) cleanup() })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-export-')), path = join(directory, 'fixture.sqlite'), db = openDatabase(path)
  cleanups.push(() => { if (db.open) db.close(); rmSync(directory, { recursive: true, force: true }) })
  const r = new Repositories(db), w = r.createWorkspace('Clinic API').id, foreign = r.createWorkspace('Other').id
  const service = new WorkspaceExportService(db, [])
  return { directory, path, db, r, w, foreign, service }
}
const config = (): StoredRequestConfig => ({ ...createDefaultRequestConfig(), method: 'POST', auth: { mode: 'none' } })
const text = (key: string, value: string, enabled = true) => ({ id: randomUUID(), key, value, enabled })
it('allowlists every entity and body; omits synthetic secrets, state, paths and capabilities while preserving order/templates', () => {
  const f = fixture(), c = f.r.createCollection(f.w, 'Collection'), e = f.r.createEnvironment(f.w, 'Local')
  const sensitive = f.r.createSecret(f.w, 'secure', Buffer.from('synthetic-sensitive-ciphertext'))
  const literal = f.r.createSecret(f.w, 'session', null)
  f.r.upsertVariable(f.w, null, 'ordinary', { isSensitive: false, plainValue: 'ordinary-visible', secretId: null })
  f.r.upsertVariable(f.w, e.id, 'token', { isSensitive: true, plainValue: null, secretId: sensitive.id })
  const queryRows = [text('same', '{{ordinary}}'), text('same', 'two', false)]
  const ordinaryHeader = text('X-Plain', 'ordinary-header')
  const headerRows = [text(' Authorization ', 'synthetic-auth-header'), text('pRoXy-AuThOrIzAtIoN', 'synthetic-proxy-header', false), text('Cookie', 'synthetic-cookie-header'), ordinaryHeader]
  const file = { id: randomUUID(), key: 'file', kind: 'file' as const, enabled: false, fileName: 'fixture.txt', fileSize: 12 }
  const multipart = f.r.createRequest(f.w, 'Multipart', c.id, { ...config(), queryRows, headerRows, body: { kind: 'multipart', rows: [{ ...text('same', '{{ordinary}}'), kind: 'text' }, file] }, auth: { mode: 'basic', username: { kind: 'template', template: ' {{username}} ' }, password: { kind: 'secret', secretId: literal.id } }, timeoutMs: 12345, followRedirects: true })
  const bodies = [{ kind: 'none' }, { kind: 'json', text: ' { "value": "{{ordinary}}" } ' }, { kind: 'raw', text: 'سلام\n', mediaType: 'text/plain' }, { kind: 'urlencoded', rows: queryRows }] as const
  const requests = [multipart, ...bodies.map((body, index) => f.r.createRequest(f.w, `Body ${index}`, null, { ...config(), body: structuredClone(body) }))]
  f.r.createRequest(f.foreign, 'Foreign must stay out', null, config())
  f.r.setState(f.w, e.id, multipart.id); f.r.selectWorkspace(f.w)
  const dto = f.service.snapshot(f.w), output = JSON.stringify(dto)
  expect(workspaceExportSchema.parse(JSON.parse(output))).toEqual(dto)
  for (const marker of ['synthetic-sensitive-ciphertext', sensitive.id, literal.id, 'synthetic-auth-header', 'synthetic-proxy-header', 'synthetic-cookie-header', 'activeEnvironmentId', 'selectedRequestId', 'Foreign must stay out', 'createdAt', 'updatedAt']) expect(output).not.toContain(marker)
  expect(dto.workspace.collections).toEqual([{ id: c.id, name: c.name, sortOrder: c.sortOrder }])
  expect(dto.workspace.environments).toEqual([{ id: e.id, name: e.name }])
  expect(dto.workspace.variables).toEqual(expect.arrayContaining([{ id: expect.any(String), environmentId: null, key: 'ordinary', isSensitive: false, value: 'ordinary-visible', requiresValue: false }, { id: expect.any(String), environmentId: e.id, key: 'token', isSensitive: true, requiresValue: true }]))
  const exported = dto.workspace.requests.find(value => value.id === multipart.id)
  expect(exported?.config).toMatchObject({ queryRows, headerRows: headerRows.map((row, index) => index < 3 ? { ...row, value: '', enabled: false } : row), timeoutMs: 12345, followRedirects: true, auth: { mode: 'basic', usernameTemplate: ' {{username}} ', passwordTemplate: '', requiresCredentials: true }, body: { kind: 'multipart', rows: [{ ...text('unused', ''), id: expect.any(String), key: 'same', value: '{{ordinary}}', kind: 'text', enabled: true }, { ...file, requiresSelection: true }] } })
  for (const request of requests.slice(1)) expect(dto.workspace.requests.find(value => value.id === request.id)?.config.body).toEqual(request.config.body)
  const source: ExportSnapshot = { workspace: { ...f.r.getWorkspace(f.w), ...{ response: 'synthetic-response' } }, collections: [c], environments: [e], variables: f.r.listVariables(f.w, null), requests: [{ ...multipart, config: { ...multipart.config, body: { kind: 'multipart', rows: [{ ...file, ...{ path: '/synthetic/private/upload', fileId: randomUUID(), secretId: literal.id } }] } } }] }
  const sanitized = JSON.stringify(serializeWorkspace(source))
  for (const value of ['/synthetic/private/upload', 'fileId', 'secretId', 'response', 'synthetic-response']) expect(sanitized).not.toContain(value)
})
it.each(['synthetic-literal', 'Bearer {{token}}', '{{token}}suffix'])('does not retain mixed/literal Auth text (%s)', value => {
  const f = fixture(), request = f.r.createRequest(f.w, 'Auth', null, config())
  const snapshot: ExportSnapshot = { workspace: f.r.getWorkspace(f.w), collections: [], environments: [], variables: [], requests: [{ ...request, config: { ...request.config, auth: { mode: 'bearer', token: { kind: 'template', template: value } } } }] }
  expect(serializeWorkspace(snapshot).workspace.requests[0]?.config.auth).toEqual({ mode: 'bearer', tokenTemplate: '', requiresCredentials: true })
})
it('retains bearer placeholder-only auth without requiring omitted credentials', () => {
  const f = fixture(); f.r.createRequest(f.w, 'Template', null, { ...config(), auth: { mode: 'bearer', token: { kind: 'template', template: '\t{{ token }} {{other}}\n' } } })
  expect(f.service.snapshot(f.w).workspace.requests[0]?.config.auth).toEqual({ mode: 'bearer', tokenTemplate: '\t{{ token }} {{other}}\n', requiresCredentials: false })
})
it('uses one SQLite read snapshot even when another connection commits between entity reads', () => {
  const f = fixture()
  // Test WAL permits an external commit during a read; the app's journal policy is unchanged.
  f.db.pragma('journal_mode = WAL')
  const writer = openDatabase(f.path), r = new Repositories(writer)
  try {
    const original = Repositories.prototype.listCollections
    vi.spyOn(Repositories.prototype, 'listCollections').mockImplementation(function (this: Repositories, workspace) {
      r.renameWorkspace(workspace, 'After'); r.createCollection(workspace, 'Concurrent')
      return original.call(this, workspace)
    })
    const exported = f.service.snapshot(f.w)
    expect(exported.workspace.name).toBe('Clinic API'); expect(exported.workspace.collections).toEqual([])
    expect(f.r.getWorkspace(f.w).name).toBe('After')
    expect(writer.prepare('SELECT name FROM collections').all()).toEqual([{ name: 'Concurrent' }])
  } finally { writer.close() }
})
it('cancelled save and export leave database bytes/selection unchanged; snapshot precedes native dialog', async () => {
  const f = fixture(); f.r.selectWorkspace(f.w)
  const before = f.db.serialize(), files = readdirSync(f.directory)
  expect(await f.service.export(f.w, async () => null, () => true)).toEqual({ status: 'cancelled' })
  expect(f.db.serialize()).toEqual(before); expect(readdirSync(f.directory)).toEqual(files)
  const target = join(f.directory, 'saved.json')
  expect(await f.service.export(f.w, async () => { f.r.renameWorkspace(f.w, 'Changed during chooser'); return target }, () => true)).toEqual({ status: 'saved' })
  expect(workspaceExportSchema.parse(JSON.parse(readFileSync(target, 'utf8'))).workspace.name).toBe('Clinic API')
  expect(f.r.getSelectedWorkspace()).toBe(f.w)
})
it('atomic replacement writes UTF-8, removes temporary files and preserves destination on failed rename or lost owner', async () => {
  const f = fixture(), target = join(f.directory, 'saved.json')
  writeFileSync(target, 'original')
  await expect(writeExportFile(target, 'سلام\n', [], () => true, async () => { throw new Error('synthetic private path') })).rejects.toMatchObject({ code: 'EXPORT_WRITE_FAILED', message: 'Workspace export could not be written' })
  expect(readFileSync(target, 'utf8')).toBe('original')
  let calls = 0
  await expect(writeExportFile(target, 'new', [], () => ++calls === 1)).rejects.toMatchObject({ code: 'VALIDATION' })
  expect(readFileSync(target, 'utf8')).toBe('original')
  await writeExportFile(target, 'سلام\n', [], () => true)
  expect(readFileSync(target, 'utf8')).toBe('سلام\n')
  expect(readdirSync(f.directory).filter(value => value.endsWith('.tmp'))).toEqual([])
})
it('rejects app/data folders, symlink aliases/targets, existing SQLite content and non-JSON destinations', async () => {
  const f = fixture(), protectedRoot = join(f.directory, 'appdata'), alias = join(f.directory, 'alias')
  mkdirSync(protectedRoot); symlinkSync(protectedRoot, alias, 'dir')
  for (const target of [join(protectedRoot, 'new.json'), join(alias, 'new.json'), f.path]) await expect(writeExportFile(target, 'new', [protectedRoot], () => true)).rejects.toMatchObject({ code: 'VALIDATION' })
  const sqlite = join(f.directory, 'database.json'); writeFileSync(sqlite, 'SQLite format 3\0synthetic')
  const linked = join(f.directory, 'link.json'); symlinkSync(sqlite, linked)
  for (const target of [sqlite, linked]) await expect(writeExportFile(target, 'new', [], () => true)).rejects.toMatchObject({ code: 'VALIDATION' })
  expect(readFileSync(sqlite, 'utf8')).toBe('SQLite format 3\0synthetic')
  expect(readdirSync(protectedRoot)).toEqual([])
})
it('validates owned sender/input before snapshot/dialog and prevents writes after renderer replacement', async () => {
  const f = fixture(), frame = { url: 'file:///app/index.html' }, contents = { mainFrame: frame }, window = { isDestroyed: () => false, webContents: contents }, event = { sender: contents, senderFrame: frame }
  const choose = vi.fn(async () => null), handler = createExportHandler(() => window, frame.url, () => f.service, choose)
  for (const input of [[], ['bad'], [f.w, '/synthetic/path.json']]) expect(await handler(event, ...input)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  expect(await handler({ sender: {}, senderFrame: frame }, f.w)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(await handler({ sender: contents, senderFrame: { url: frame.url } }, f.w)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(await handler(event, randomUUID())).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(choose).not.toHaveBeenCalled()
  const target = join(f.directory, 'lost.json')
  const replaced = createExportHandler(() => window, frame.url, () => f.service, async () => { contents.mainFrame = { url: frame.url }; return target })
  expect(await replaced(event, f.w)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(readdirSync(f.directory)).not.toContain('lost.json')
})
it('does not write a snapshot if the workspace is deleted while choosing; serializes concurrent exports', async () => {
  const f = fixture(), target = join(f.directory, 'lost.json')
  let finish: ((path: null) => void) | undefined
  const first = f.service.export(f.w, () => new Promise(resolve => { finish = resolve }), () => true)
  await expect(f.service.export(f.w, async () => target, () => true)).rejects.toMatchObject({ code: 'VALIDATION' })
  finish?.(null); await first
  await expect(f.service.export(f.w, async () => { f.r.deleteWorkspace(f.w); return target }, () => true)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  expect(readdirSync(f.directory)).not.toContain('lost.json')
})
