import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { chmodSync, fstatSync, mkdtempSync, mkdirSync, readSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { UploadError, UploadService } from '../../src/main/files/uploads'
import { createFileHandlers } from '../../src/main/ipc/files'
import { LIMITS } from '../../src/shared/primitives'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { createDefaultRequestConfig } from '../../src/shared/request-config'
import { storedBodySchema, exportBodySchema } from '../../src/shared/request-config'

const directories: string[] = []
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }) })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'upload-capability-')); directories.push(directory)
  const path = join(directory, 'فایل.txt'); writeFileSync(path, 'abc')
  const workspace = randomUUID(), other = randomUUID(), existing = new Set<string>([workspace, other])
  const assertWorkspace = (id: string) => { if (!existing.has(id)) throw new UploadError('NOT_FOUND') }
  const service = new UploadService(assertWorkspace)
  const row = (fileId?: string, enabled = true) => ({ id: randomUUID(), key: 'file', kind: 'file' as const, enabled, ...(fileId ? { fileId } : {}) })
  return { directory, path, workspace, other, existing, service, row, assertWorkspace }
}
function code(operation: () => unknown, expected: string) {
  try { operation(); throw new Error('Expected rejection') }
  catch (error) { expect(error).toBeInstanceOf(UploadError); expect(error).toMatchObject({ code: expected }); expect(String(error)).not.toContain(tmpdir()) }
}
describe('main-only upload capabilities', () => {
  it('returns only opaque metadata and opens verified readable descriptors with idempotent cleanup', async () => {
    const f = fixture(), selected = await f.service.choose(f.workspace, async () => f.path)
    expect(selected).toEqual({ fileId: expect.any(String), name: 'فایل.txt', size: 3 })
    if (!selected) throw new Error('Selection failed')
    const leases = f.service.openForSend(f.workspace, { kind: 'multipart', rows: [f.row(selected.fileId)] })
    const lease = leases[0]; if (!lease) throw new Error('Lease missing')
    const buffer = Buffer.alloc(3); expect(readSync(lease.fd, buffer, 0, 3, 0)).toBe(3); expect(buffer.toString()).toBe('abc')
    lease.close(); lease.close(); expect(() => fstatSync(lease.fd)).toThrow()
  })
  it('rejects forged and cross-workspace handles without releasing the owner capability', async () => {
    const f = fixture(), selected = await f.service.choose(f.workspace, async () => f.path)
    if (!selected) throw new Error('Selection failed')
    code(() => f.service.release(f.other, selected.fileId), 'FILE_REQUIRED')
    code(() => f.service.release(f.workspace, randomUUID()), 'FILE_REQUIRED')
    const body = { kind: 'multipart', rows: [f.row(selected.fileId)] }
    code(() => f.service.openForSend(f.other, body), 'FILE_REQUIRED')
    for (const lease of f.service.openForSend(f.workspace, body)) lease.close()
    f.service.release(f.workspace, selected.fileId)
    code(() => f.service.openForSend(f.workspace, body), 'FILE_REQUIRED')
  })
  it('requires fresh selection after restart, reload/clear or workspace deletion', async () => {
    const f = fixture(), selected = await f.service.choose(f.workspace, async () => f.path)
    if (!selected) throw new Error('Selection failed')
    const body = { kind: 'multipart', rows: [f.row(selected.fileId)] }
    code(() => new UploadService(f.assertWorkspace).openForSend(f.workspace, body), 'FILE_REQUIRED')
    f.service.forgetWorkspace(f.workspace); code(() => f.service.openForSend(f.workspace, body), 'FILE_REQUIRED')
    const fresh = await f.service.choose(f.workspace, async () => f.path)
    if (!fresh) throw new Error('Selection failed')
    f.service.clear(); code(() => f.service.release(f.workspace, fresh.fileId), 'FILE_REQUIRED')
    f.existing.delete(f.workspace); await expect(f.service.choose(f.workspace, async () => f.path)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
  it.each(['missing', 'changed', 'oversized', 'directory', 'unreadable'])('rejects %s before a caller can connect', async mode => {
    const f = fixture(), selected = await f.service.choose(f.workspace, async () => f.path)
    if (!selected) throw new Error('Selection failed')
    if (mode === 'missing') rmSync(f.path)
    if (mode === 'changed') truncateSync(f.path, 4)
    if (mode === 'oversized') truncateSync(f.path, LIMITS.fileBytes + 1)
    if (mode === 'directory') { rmSync(f.path); mkdirSync(f.path) }
    if (mode === 'unreadable') chmodSync(f.path, 0)
    const operation = () => f.service.openForSend(f.workspace, { kind: 'multipart', rows: [f.row(selected.fileId)] })
    code(operation, mode === 'oversized' ? 'FILE_TOO_LARGE' : 'FILE_CHANGED')
    try { operation() } catch (error) { expect(error).toMatchObject({ field: 'body.rows[0].fileId' }) }
  })
  it('rejects directories and oversize at selection; cancellation returns null', async () => {
    const f = fixture()
    await expect(f.service.choose(f.workspace, async () => f.directory)).rejects.toMatchObject({ code: 'FILE_CHANGED' })
    truncateSync(f.path, LIMITS.fileBytes + 1)
    await expect(f.service.choose(f.workspace, async () => f.path)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
    expect(await f.service.choose(f.workspace, async () => null)).toBeNull()
  })
  it('enforces the 50 MiB sum including repeated selections; disabled rows need none', async () => {
    const f = fixture(); truncateSync(f.path, LIMITS.fileBytes)
    const selected = await f.service.choose(f.workspace, async () => f.path)
    if (!selected) throw new Error('Selection failed')
    const rows = [f.row(selected.fileId), f.row(selected.fileId), f.row(selected.fileId)]
    code(() => f.service.openForSend(f.workspace, { kind: 'multipart', rows }), 'FILE_TOO_LARGE')
    const leases = f.service.openForSend(f.workspace, { kind: 'multipart', rows: [f.row(undefined, false), f.row(selected.fileId)] })
    expect(leases).toHaveLength(1); for (const lease of leases) lease.close()
    code(() => f.service.openForSend(f.workspace, { kind: 'multipart', rows: [f.row()] }), 'FILE_REQUIRED')
  })
  it('invalidates outstanding dialogs on reload and deletion even if a workspace ID is reused', async () => {
    const f = fixture()
    for (const invalidate of [() => f.service.clear(), () => f.service.forgetWorkspace(f.workspace)]) {
      let resolve: (value: string | null) => void = () => { throw new Error('Not initialized') }
      const pending = f.service.choose(f.workspace, () => new Promise<string | null>(done => { resolve = done }))
      invalidate(); resolve(f.path)
      await expect(pending).rejects.toMatchObject({ code: 'FILE_REQUIRED' })
    }
  })
  it('stored/import schemas permit display metadata only, never handles or paths', () => {
    const f = fixture(), metadata = { ...f.row(), fileName: 'فایل.txt', fileSize: 3 }
    expect(storedBodySchema.parse({ kind: 'multipart', rows: [metadata] })).toEqual({ kind: 'multipart', rows: [metadata] })
    for (const extra of [{ fileId: randomUUID() }, { path: f.path }, { filePath: f.path }]) {
      expect(storedBodySchema.safeParse({ kind: 'multipart', rows: [{ ...metadata, ...extra }] }).success).toBe(false)
      expect(exportBodySchema.safeParse({ kind: 'multipart', rows: [{ ...metadata, requiresSelection: true, ...extra }] }).success).toBe(false)
    }
  })
  it('validates sender, input and owner again after awaiting native selection', async () => {
    const f = fixture(), frame = { url: 'file:///app/index.html' }, contents = { mainFrame: frame }
    const window = { webContents: contents, isDestroyed: () => false }, event = { sender: contents, senderFrame: frame }
    let calls = 0, finish: (value: string | null) => void = () => { throw new Error('Not initialized') }
    const handlers = createFileHandlers(() => window, frame.url, () => f.service, () => { calls++; return new Promise(done => { finish = done }) })
    expect(await handlers.chooseUpload({ ...event, sender: {} }, f.workspace)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(await handlers.chooseUpload(event, f.workspace, f.path)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
    expect(await handlers.chooseUpload(event, f.path)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
    expect(calls).toBe(0)
    const pending = handlers.chooseUpload(event, f.workspace)
    window.isDestroyed = () => true; f.service.clear(); finish(f.path)
    expect(await pending).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})

it('persists only file display metadata across SQLite reopen and requires selection', async () => {
  const f = fixture(), databasePath = join(f.directory, 'test.sqlite')
  let db = openDatabase(databasePath)
  try {
    let repository = new Repositories(db)
    const workspace = repository.createWorkspace('Files').id
    const service = new UploadService(id => { repository.getWorkspace(id) })
    const selected = await service.choose(workspace, async () => f.path)
    if (!selected) throw new Error('Selection failed')
    const row = { ...f.row(), fileName: selected.name, fileSize: selected.size }
    const config = { ...createDefaultRequestConfig(), body: { kind: 'multipart' as const, rows: [row] }, auth: { mode: 'none' as const } }
    const request = repository.createRequest(workspace, 'Display metadata', null, config)
    const stored = db.prepare('SELECT config_json FROM requests WHERE id=?').get(request.id)
    expect(JSON.stringify(stored)).not.toContain(f.directory)
    expect(JSON.stringify(stored)).not.toContain(selected.fileId)
    db.close(); db = openDatabase(databasePath); repository = new Repositories(db)
    const restored = repository.getRequest(workspace, request.id).config.body
    expect(restored).toEqual(config.body)
    const restarted = new UploadService(id => { repository.getWorkspace(id) })
    code(() => restarted.openForSend(workspace, restored), 'FILE_REQUIRED')
  } finally { if (db.open) db.close() }
})
