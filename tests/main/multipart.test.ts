import { afterEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { fstatSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { SecretStore } from '../../src/main/security/secrets'
import { MaterializationService } from '../../src/main/services/materialization'
import { RequestService } from '../../src/main/services/requests'
import { UploadError, UploadService, type UploadLease } from '../../src/main/files/uploads'
import { BodyError } from '../../src/main/http/body'
import { materialize, type MaterializedRequest } from '../../src/main/http/materialize'
import { executeSingleHop } from '../../src/main/http/transport'
import { executeWithRedirects } from '../../src/main/http/redirects'
import { createDefaultRequestConfig, type RuntimeRequestConfig } from '../../src/shared/request-config'
import { LIMITS } from '../../src/shared/primitives'
import { startMultipartFixture } from '../fixtures/multipart'
import { ExecutionService } from '../../src/main/services/execution'

const directories: string[] = []
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }) })
const text = (key: string, value: string, enabled = true) => ({ id: randomUUID(), kind: 'text' as const, key, value, enabled })
const file = (key: string, fileId?: string, enabled = true) => ({ id: randomUUID(), kind: 'file' as const, key, enabled, ...(fileId ? { fileId } : {}) })
async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'multipart-')); directories.push(directory)
  const path = join(directory, 'سلام 🌍.bin'), bytes = Buffer.from([0, 255, 13, 10, 1, 200])
  writeFileSync(path, bytes)
  const workspace = randomUUID(), uploads = new UploadService(w => { if (w !== workspace) throw new UploadError('NOT_FOUND') })
  const selected = await uploads.choose(workspace, async () => path)
  if (!selected) throw new Error('Selection missing')
  const leases: UploadLease[] = []
  const capture = (config: RuntimeRequestConfig, variables = new Map<string, string | null>()) => {
    let reopen: ReturnType<UploadService['captureForSend']> | undefined
    return materialize(config, variables, source => {
    try {
      reopen ??= uploads.captureForSend(workspace, source)
      const opened = reopen(); leases.push(...opened)
      return opened.map(lease => ({ ...lease, async *stream() {
        try { yield* lease.stream() } catch (error) { throw error instanceof UploadError ? new BodyError(error.dto()) : error }
      } }))
    } catch (error) { throw error instanceof UploadError ? new BodyError(error.dto()) : error }
    })
  }
  const config = (rows = [text('same', 'first'), file('{{key}}', selected.fileId), text('same', '{{word}}'), text('{{missing}}', '{{missing}}', false), file('disabled', undefined, false)]): RuntimeRequestConfig => ({ ...createDefaultRequestConfig(), method: 'POST', urlTemplate: 'http://127.0.0.1/echo', body: { kind: 'multipart', rows } })
  const closed = () => { for (const lease of leases) expect(() => fstatSync(lease.fd)).toThrow() }
  return { directory, path, bytes, workspace, uploads, selected, capture, config, leases, closed }
}
function snapshot(result: ReturnType<typeof materialize>): MaterializedRequest { if (!result.ok) throw new Error(`Capture failed: ${result.error.code}`); return result.data }

it('streams ordered interleaved duplicates, Unicode names/values and exact binary bytes with generated boundary/length', async () => {
  const f = await setup(), fixture = await startMultipartFixture()
  try {
    const source = f.config(), captured = snapshot(f.capture({ ...source, urlTemplate: fixture.url + '/echo' }, new Map([['key', 'نام 🌍'], ['word', 'سلام + % 🌍']])))
    expect(captured.bodyBytes).toBeNull(); expect(captured.streamingBody).toBeDefined(); f.closed()
    if (source.body.kind === 'multipart' && source.body.rows[0]?.kind === 'text') source.body.rows[0].value = 'later edit'
    const result = await executeSingleHop(captured, new AbortController().signal)
    expect(result.ok).toBe(true)
    expect(fixture.captures).toHaveLength(1)
    const received = fixture.captures[0]!
    expect(received.parts).toEqual([{ name: 'same', value: 'first' }, { name: 'نام 🌍', filename: 'سلام 🌍.bin', bytes: f.bytes.toString('base64') }, { name: 'same', value: 'سلام + % 🌍' }])
    expect(received.contentType).toMatch(/^multipart\/form-data; boundary=form-data-encoder-/)
    expect(Number(received.contentLength)).toBe(received.length)
    f.closed()
  } finally { await fixture.close() }
})
it.each([307, 308])('reopens files for %i with identical boundary, ordered parts and bytes despite draft release', async status => {
  const f = await setup(), fixture = await startMultipartFixture()
  try {
    const captured = snapshot(f.capture({ ...f.config([file('upload', f.selected.fileId)]), urlTemplate: `${fixture.url}/redirect-${status}`, followRedirects: true }))
    f.uploads.release(f.workspace, f.selected.fileId)
    const result = await executeWithRedirects(captured, new AbortController().signal)
    expect(result).toMatchObject({ ok: true, data: { redirectCount: 1 } })
    expect(fixture.captures).toHaveLength(2)
    expect(fixture.captures[1]?.parts).toEqual(fixture.captures[0]?.parts)
    expect(fixture.captures[1]?.contentType).toBe(fixture.captures[0]?.contentType)
    expect(f.leases).toHaveLength(3) // preparation + each hop, no retained pre-ack descriptor
    f.closed()
  } finally { await fixture.close() }
})
it.each([301, 302, 303])('drops multipart source and entity headers when %i rewrites POST to GET', async status => {
  const f = await setup(), fixture = await startMultipartFixture()
  try {
    const captured = snapshot(f.capture({ ...f.config([file('upload', f.selected.fileId)]), urlTemplate: `${fixture.url}/redirect-${status}`, followRedirects: true }))
    const methods: string[] = [], getHeaders: string[][] = []
    fixture.server.on('request', request => { methods.push(request.method ?? ''); if (request.method === 'GET') getHeaders.push(request.rawHeaders) })
    expect(await executeWithRedirects(captured, new AbortController().signal)).toMatchObject({ ok: true, data: { redirectCount: 1 } })
    expect(methods).toEqual(['POST', 'GET'])
    expect(getHeaders[0]?.join('\n').toLowerCase()).not.toContain('content-')
    expect(f.leases).toHaveLength(2); f.closed()
  } finally { await fixture.close() }
})
it('rejects explicit Content-Type/managed framing and resolves only enabled keys/text at original indexes', async () => {
  const f = await setup()
  for (const value of ['multipart/form-data', 'multipart/form-data; boundary=forged', 'application/json']) expect(f.capture({ ...f.config([]), headerRows: [{ id: randomUUID(), key: 'Content-Type', value, enabled: true }] })).toMatchObject({ ok: false, error: { code: 'CONTENT_TYPE_CONFLICT' } })
  expect(f.capture(f.config([file('{{missing}}', f.selected.fileId)]))).toMatchObject({ ok: false, error: { code: 'VARIABLE_MISSING', field: 'body.rows[0].key' } })
  expect(f.capture(f.config([text('', '', false), text('x', '{{missing}}')]))).toMatchObject({ ok: false, error: { code: 'VARIABLE_MISSING', field: 'body.rows[1].value' } })
  expect(f.capture(f.config([text('{{large}}', '')]), new Map([['large', 'x'.repeat(10001)]]))).toMatchObject({ ok: false, error: { field: 'body.rows[0].key' } })
  expect(f.capture({ ...f.config([]), headerRows: [{ id: randomUUID(), key: 'Content-Length', value: '1', enabled: true }] })).toMatchObject({ ok: false, error: { code: 'INVALID_HEADER' } })
})
it('preflights missing/changed files before any socket, including changes between acceptance and start', async () => {
  const f = await setup(), fixture = await startMultipartFixture()
  let connections = 0; fixture.server.on('connection', () => { connections++ })
  try {
    const captured = snapshot(f.capture({ ...f.config([file('upload', f.selected.fileId)]), urlTemplate: fixture.url + '/echo' }))
    truncateSync(f.path, 10)
    expect(await executeSingleHop(captured, new AbortController().signal)).toMatchObject({ ok: false, error: { code: 'FILE_CHANGED', field: 'body.rows[0].fileId' } })
    expect(connections).toBe(0); f.closed()
    rmSync(f.path)
    expect(f.capture(f.config([file('upload', f.selected.fileId)]))).toMatchObject({ ok: false, error: { code: 'FILE_CHANGED' } })
    const other = await setup()
    expect(other.capture(other.config([file('required')]))).toMatchObject({ ok: false, error: { code: 'FILE_REQUIRED' } })
  } finally { await fixture.close() }
})
it('enforces 20/50/55 MiB limits before connecting and closes preflight descriptors', async () => {
  const f = await setup(); truncateSync(f.path, LIMITS.fileBytes)
  // The original capability had size 6; choose fresh after changing the fixture size.
  const selection = await f.uploads.choose(f.workspace, async () => f.path); if (!selection) throw new Error('Selection missing')
  expect(f.capture(f.config([file('a', selection.fileId), file('b', selection.fileId), file('c', selection.fileId)]))).toMatchObject({ ok: false, error: { code: 'FILE_TOO_LARGE' } })
  const g = await setup(); truncateSync(g.path, LIMITS.fileBytes + 1)
  expect(g.capture(g.config([file('a', g.selected.fileId)]))).toMatchObject({ ok: false, error: { code: 'FILE_TOO_LARGE' } })
  const h = await setup(); truncateSync(h.path, LIMITS.fileBytes)
  const full = await h.uploads.choose(h.workspace, async () => h.path); if (!full) throw new Error('Selection missing')
  const halfPath = join(h.directory, 'half'); writeFileSync(halfPath, ''); truncateSync(halfPath, 10 * 1024 * 1024)
  const half = await h.uploads.choose(h.workspace, async () => halfPath); if (!half) throw new Error('Selection missing')
  const rows = [file('a', full.fileId), file('b', full.fileId), file('c', half.fileId), ...Array.from({ length: 150 }, () => text('text', '🌍'.repeat(10000)))]
  expect(h.capture(h.config(rows))).toMatchObject({ ok: false, error: { code: 'FILE_TOO_LARGE', field: 'body' } })
  h.closed()
})
it('library escapes quoted/newline names without adding injected headers or extra parts; supports empty file/text', async () => {
  const f = await setup(), fixture = await startMultipartFixture()
  writeFileSync(f.path, '')
  const selection = await f.uploads.choose(f.workspace, async () => f.path); if (!selection) throw new Error('Selection missing')
  try {
    const captured = snapshot(f.capture({ ...f.config([text('a"\r\nInjected: bad', ''), file('empty', selection.fileId)]), urlTemplate: fixture.url + '/echo' }))
    expect(await executeSingleHop(captured, new AbortController().signal)).toMatchObject({ ok: true })
    expect(fixture.captures[0]?.parts).toEqual([{ name: 'a%22%0D%0AInjected: bad', value: '' }, { name: 'empty', filename: 'سلام 🌍.bin', bytes: '' }])
    f.closed()
  } finally { await fixture.close() }
})
it.each(['cancel', 'timeout'])('terminates a backpressured file upload by %s once and releases descriptors, streams and execution slot', async mode => {
  const f = await setup(); truncateSync(f.path, LIMITS.fileBytes)
  const selected = await f.uploads.choose(f.workspace, async () => f.path); if (!selected) throw new Error('Selection missing')
  const server = createServer(request => { request.pause() }); server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Fixture missing')
  const captured = snapshot(f.capture({ ...f.config([file('upload', selected.fileId)]), urlTemplate: `http://127.0.0.1:${address.port}/slow` }))
  const completions: string[] = [], controller = new AbortController()
  const began = once(server, 'request'), pending = executeSingleHop(captured, controller.signal)
  try {
    await began; controller.abort()
    expect(await pending).toMatchObject({ ok: false, error: { code: 'CANCELLED' } })
    await expect.poll(() => f.leases.every(lease => { try { fstatSync(lease.fd); return false } catch { return true } })).toBe(true)
    // Use the actual execution lifecycle too, with the real multipart transport.
    const execution = new ExecutionService({ capture: () => ({ ok: true, data: { ...captured, timeoutMs: mode === 'timeout' ? 100 : captured.timeoutMs } }) }, completion => completions.push('code' in completion.result ? completion.result.code : 'HTTP'))
    const acceptance = execution.send(f.workspace, null, { name: 'Slow', method: 'POST', urlTemplate: captured.url }, null)
    if (!acceptance.ok) throw new Error('Execution missing')
    const beganAgain = once(server, 'request'); execution.start(acceptance.data.executionId); await beganAgain
    if (mode === 'cancel') { execution.cancel(acceptance.data.executionId); execution.cancel(acceptance.data.executionId) }
    await expect.poll(() => completions).toEqual([mode === 'timeout' ? 'TIMEOUT' : 'CANCELLED'])
    await expect.poll(() => f.leases.every(lease => { try { fstatSync(lease.fd); return false } catch { return true } })).toBe(true)
    expect(execution.send(f.workspace, null, { name: 'Again', method: 'POST', urlTemplate: captured.url }, null).ok).toBe(true); execution.abort()
  } finally { controller.abort(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})
it('persists metadata only, keeps saved source independent and requires reselection after SQLite/app reopen', async () => {
  const f = await setup(), dbPath = join(f.directory, 'test.sqlite')
  let db = openDatabase(dbPath)
  try {
    let repository = new Repositories(db)
    const workspace = repository.createWorkspace('Multipart').id
    repository.selectWorkspace(workspace)
    const uploads = new UploadService(w => { repository.getWorkspace(w) }), selection = await uploads.choose(workspace, async () => f.path)
    if (!selection) throw new Error('Selection missing')
    const request = new RequestService(db).create(workspace, { name: 'Multipart', method: 'POST', urlTemplate: 'http://127.0.0.1/', collectionId: null, body: { kind: 'multipart', rows: [{ ...file('upload', selection.fileId), fileName: selection.name, fileSize: selection.size }, text('same', 'first')] } })
    const id = request.editor!.id
    expect(request.editor?.body).toMatchObject({ kind: 'multipart', rows: [expect.not.objectContaining({ fileId: expect.anything() }), expect.anything()] })
    const json = JSON.stringify(repository.getRequest(workspace, id).config)
    expect(json).not.toContain(selection.fileId); expect(json).not.toContain(f.directory)
    db.close(); db = openDatabase(dbPath); repository = new Repositories(db)
    const loaded = new RequestService(db).get(workspace, id).editor!
    const store = new SecretStore(db, { isEncryptionAvailable: () => false, getSelectedStorageBackend: () => 'basic_text', encryptString: () => { throw new Error('Unavailable') }, decryptString: () => { throw new Error('Unavailable') } }, 'linux')
    const materializer = new MaterializationService(db, store, new UploadService(w => { repository.getWorkspace(w) }))
    expect(materializer.capture(workspace, id, { name: loaded.name, method: loaded.method, urlTemplate: loaded.urlTemplate, body: loaded.body ?? undefined }, null)).toMatchObject({ ok: false, error: { code: 'FILE_REQUIRED' } })
  } finally { if (db.open) db.close() }
})
