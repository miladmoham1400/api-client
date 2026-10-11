import { afterEach, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { createDefaultRequestConfig } from '../../src/shared/request-config'
import { workspaceExportV1Schema, workspaceExportV2Schema, type WorkspaceExportV2 } from '../../src/shared/transfer'
import { WorkspaceExportService } from '../../src/main/services/workspace-export'
import { WorkspaceImportService, validateImport } from '../../src/main/services/workspace-import'
import { IMPORT_MAX_BYTES } from '../../src/main/files/import-read'

const cleanups: (() => void)[] = []
afterEach(() => { vi.restoreAllMocks(); cleanups.splice(0).forEach(fn => fn()) })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-transfer-v2-')), db = openDatabase(join(directory, 'data.sqlite')), r = new Repositories(db)
  cleanups.push(() => { db.close(); rmSync(directory, { recursive: true, force: true }) })
  const w = r.createWorkspace('Library'), c = r.createCollection(w.id, 'Users'), c2 = r.createCollection(w.id, 'Other')
  const parent = r.createFolder(w.id, c.id, null, 'Users'), nested = r.createFolder(w.id, c.id, parent.id, 'Auth')
  const empty = r.createFolder(w.id, c.id, parent.id, 'Empty')
  r.selectWorkspace(w.id)
  const row = (key: string, value: string, enabled = true) => ({ id: randomUUID(), key, value, enabled })
  const config = { ...createDefaultRequestConfig(), method: 'POST' as const, urlTemplate: 'http://localhost/{{path}}', queryRows: [row('same', '{{path}}'), row('same', 'second', false)],
    headerRows: [row('X-Test', '{{path}}')], body: { kind: 'urlencoded' as const, rows: [row('field', 'one'), row('field', '{{path}}')] },
    auth: { mode: 'bearer' as const, token: { kind: 'template' as const, template: '{{token}}' } } }
  r.createRequest(w.id, 'Login', c.id, config, nested.id)
  r.createRequest(w.id, 'Collection root', c.id, { ...createDefaultRequestConfig(), auth: { mode: 'none' } })
  r.createRequest(w.id, 'Workspace root', null, { ...createDefaultRequestConfig(), auth: { mode: 'none' } })
  const exporter = new WorkspaceExportService(db, [])
  return { directory, db, r, w, c, c2, parent, nested, empty, exporter, dto: exporter.snapshot(w.id) }
}
function ids(value: unknown): string[] {
  return value && typeof value === 'object' ? Object.entries(value).flatMap(([key, v]) => key === 'id' ? [String(v)] : ids(v)) : []
}
function normalized(source: WorkspaceExportV2['workspace']) {
  const collections = new Map(source.collections.map(c => [c.id, c.name])), folders = new Map(source.folders.map(f => [f.id, f]))
  const path = (id: string | null): string => id === null ? '' : path(folders.get(id)!.parentFolderId) + '/' + folders.get(id)!.name
  const config = (value: unknown): unknown => value && typeof value === 'object'
    ? Array.isArray(value) ? value.map(config) : Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id').map(([key, v]) => [key, config(v)])) : value
  return {
    collections: source.collections.map(c => ({ name: c.name, sortOrder: c.sortOrder })).sort((a, b) => a.name.localeCompare(b.name)),
    folders: source.folders.map(f => ({ collection: collections.get(f.collectionId), path: path(f.id), sortOrder: f.sortOrder })).sort((a, b) => a.path.localeCompare(b.path)),
    requests: source.requests.map(r => ({ name: r.name, collection: r.collectionId === null ? null : collections.get(r.collectionId), path: path(r.folderId), config: config(r.config) })).sort((a, b) => a.name.localeCompare(b.name))
  }
}
it('round-trips empty/nested folders, roots and ordered configs from child-first input with fresh entity/row IDs', () => {
  const f = fixture(), source = structuredClone(f.dto)
  source.workspace.folders.reverse(); source.workspace.folders.find(folder => folder.id === f.empty.id)!.sortOrder = 7
  const validated = validateImport(Buffer.from(JSON.stringify(source)))
  const created = f.r.importWorkspace(validated.workspace), output = f.exporter.snapshot(created.id)
  expect(output.version).toBe(2)
  expect(normalized(output.workspace)).toEqual(normalized(source.workspace))
  const old = ids(source), fresh = ids(output)
  expect(new Set(fresh).size).toBe(fresh.length); fresh.forEach(id => expect(old).not.toContain(id))
  expect(output.workspace.requests.every(r => r.config.configVersion === 1)).toBe(true)
  expect(f.r.getSelectedWorkspace()).toBe(f.w.id)
  expect(f.r.getState(created.id)).toMatchObject({ activeEnvironmentId: null, selectedRequestId: null })
  expect(f.r.getTreeState(created.id)).toMatchObject({ expandedFolderIds: [], expandedCollectionIds: [] })
  expect(f.exporter.snapshot(f.w.id).workspace).toEqual(f.dto.workspace)
})
it('imports strict legacy v1 at collection/workspace roots, with no folders; versions/config versions stay distinct', () => {
  const f = fixture(), { folders: _folders, ...workspace } = f.dto.workspace
  expect(_folders).toHaveLength(3)
  const legacy = workspaceExportV1Schema.parse({ ...f.dto, version: 1, workspace: { ...workspace,
    requests: workspace.requests.map(({ folderId: _folderId, ...request }) => { expect(_folderId === null || typeof _folderId === 'string').toBe(true); return request }) } })
  const valid = validateImport(Buffer.from(JSON.stringify(legacy))), created = f.r.importWorkspace(valid.workspace), result = f.exporter.snapshot(created.id)
  expect(result.version).toBe(2); expect(result.workspace.folders).toEqual([])
  expect(result.workspace.requests.every(request => request.folderId === null)).toBe(true)
  expect(result.workspace.requests.find(r => r.name === 'Workspace root')?.collectionId).toBeNull()
  expect(result.workspace.requests.find(r => r.name === 'Login')?.collectionId).toBe(result.workspace.collections.find(c => c.name === 'Users')?.id)
  for (const version of [0, 3, '2']) {
    try { validateImport(Buffer.from(JSON.stringify({ ...f.dto, version }))); throw new Error('Unsupported version accepted') }
    catch (error) { expect(error).toMatchObject({ code: 'UNSUPPORTED_FORMAT_VERSION' }) }
  }
  expect(() => validateImport(Buffer.from(JSON.stringify({ ...f.dto, version: 1 })))).toThrow('Local data operation failed')
  expect(workspaceExportV2Schema.safeParse({ ...f.dto, workspace: { ...f.dto.workspace, requests: [{ ...f.dto.workspace.requests[0], config: { ...f.dto.workspace.requests[0]!.config, configVersion: 2 } }] } }).success).toBe(false)
})
it.each(['cycle', 'self', 'missing-parent', 'foreign-parent', 'foreign-collection', 'missing-folder', 'foreign-request', 'root-with-folder', 'duplicate', 'collision', 'depth', 'folders', 'requests', 'collections'] as const)('rejects %s before preview or any writes', async kind => {
  const f = fixture(), dto = structuredClone(f.dto), w = dto.workspace, folder = w.folders.find(folder => folder.id === f.parent.id)!, request = w.requests.find(r => r.name === 'Login')!
  if (kind === 'cycle') folder.parentFolderId = f.nested.id
  if (kind === 'self') folder.parentFolderId = folder.id
  if (kind === 'missing-parent') folder.parentFolderId = randomUUID()
  if (kind === 'foreign-parent') w.folders.find(folder => folder.id === f.nested.id)!.collectionId = f.c2.id
  if (kind === 'foreign-collection') folder.collectionId = randomUUID()
  if (kind === 'missing-folder') request.folderId = randomUUID()
  if (kind === 'foreign-request') request.collectionId = f.c2.id
  if (kind === 'root-with-folder') request.collectionId = null
  if (kind === 'duplicate') w.folders.push({ ...folder })
  if (kind === 'collision') { request.folderId = null; folder.id = w.id }
  if (kind === 'depth') {
    let parent: string | null = null
    w.folders = Array.from({ length: 17 }, (_, index) => { const id = randomUUID(), value = { id, collectionId: f.c.id, parentFolderId: parent, name: 'Depth ' + index, sortOrder: 0 }; parent = id; return value })
    request.folderId = parent
  }
  if (kind === 'folders') w.folders.push(...Array.from({ length: 1001 - w.folders.length }, () => ({ ...folder, id: randomUUID() })))
  if (kind === 'requests') w.requests.push(...Array.from({ length: 1001 - w.requests.length }, () => ({ ...request, id: randomUUID() })))
  if (kind === 'collections') w.collections.push(...Array.from({ length: 101 - w.collections.length }, () => ({ ...w.collections[0]!, id: randomUUID() })))
  const before = f.db.serialize(), path = join(f.directory, 'invalid.json'); writeFileSync(path, JSON.stringify(dto))
  expect(() => validateImport(Buffer.from(JSON.stringify(dto)))).toThrow()
  expect(() => f.r.importWorkspace(w)).toThrow()
  await expect(new WorkspaceImportService(f.r).choose(async () => path, () => true)).rejects.toMatchObject({ code: 'INVALID_IMPORT' })
  expect(f.db.serialize()).toEqual(before)
})
it('shows only folder names/counts; validates snapshot before preview and keeps cancelled/expired tokens neutral', async () => {
  const f = fixture(), service = new WorkspaceImportService(f.r), path = join(f.directory, 'preview.json'), before = f.db.serialize()
  writeFileSync(path, JSON.stringify(f.dto))
  const result = await service.choose(async () => path, () => true)
  if (result.status !== 'preview') throw new Error('Missing preview')
  expect(result.preview).toEqual({ token: expect.any(String), name: 'Library', collections: ['Users', 'Other'], folders: f.dto.workspace.folders.map(f => f.name), environments: [], requests: 3, variables: 0, missingVariables: 0, missingCredentials: 0, missingFiles: 0 })
  expect(JSON.stringify(result.preview)).not.toContain('localhost'); expect(JSON.stringify(result.preview)).not.toContain(f.parent.id)
  service.clear(); expect(() => service.confirm(result.preview.token)).toThrow(); expect(f.db.serialize()).toEqual(before)
  const next = await service.choose(async () => path, () => true)
  if (next.status !== 'preview') throw new Error('Missing preview')
  service.cancel(next.preview.token); expect(() => service.confirm(next.preview.token)).toThrow(); expect(f.db.serialize()).toEqual(before)
  const last = await service.choose(async () => path, () => true)
  if (last.status !== 'preview') throw new Error('Missing preview')
  writeFileSync(path, '{}'); const created = service.confirm(last.preview.token)
  expect(f.r.listFolders(created.workspaceId)).toHaveLength(3); expect(() => service.confirm(last.preview.token)).toThrow()
})
it.each(['folders', 'requests'])('rolls back fresh hierarchy and every entity after injected %s write failure', table => {
  const f = fixture()
  f.db.exec(`CREATE TRIGGER fail_import BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'synthetic write failure'); END`)
  const before = f.db.serialize()
  expect(() => f.r.importWorkspace(f.dto.workspace)).toThrow('Local data operation failed')
  expect(f.db.serialize()).toEqual(before); expect(f.r.listWorkspaces()).toHaveLength(1)
})
it('rejects oversized export before save dialog, preserving saved bytes, and rejects oversized import', async () => {
  const f = fixture(), text = 'x'.repeat(5 * 1024 * 1024)
  for (let index = 0; index < 2; index++) f.r.createRequest(f.w.id, 'Large ' + index, null, { ...createDefaultRequestConfig(), auth: { mode: 'none' }, method: 'POST', body: { kind: 'raw', mediaType: 'text/plain', text } })
  const before = f.db.serialize(), choose = vi.fn(async () => join(f.directory, 'large.json'))
  await expect(f.exporter.export(f.w.id, choose, () => true)).rejects.toMatchObject({ code: 'VALIDATION' })
  expect(choose).not.toHaveBeenCalled(); expect(f.db.serialize()).toEqual(before)
  expect(() => validateImport(Buffer.alloc(IMPORT_MAX_BYTES + 1))).toThrow('Local data operation failed')
}, 120_000)
it('round-trips 100 collections/1000 folders/1000 requests at depth 16 below 10 MiB without losing destinations', () => {
  const f = fixture(), source = structuredClone(f.dto)
  source.workspace.collections = Array.from({ length: 100 }, (_, i) => ({ id: randomUUID(), name: 'Collection ' + i.toString().padStart(3, '0'), sortOrder: i }))
  source.workspace.folders = []
  for (let i = 0; i < 1000; i++) {
    const collection = source.workspace.collections[Math.floor(i / 10)]!
    source.workspace.folders.push({ id: randomUUID(), collectionId: collection.id, parentFolderId: i % 10 === 0 ? null : source.workspace.folders[i - 1]!.id, name: 'Folder ' + i, sortOrder: i % 10 })
  }
  // One chain reaches the exact depth bound; shift six folders from the final collection.
  for (let i = 10; i < 16; i++) source.workspace.folders[i] = { ...source.workspace.folders[i]!, collectionId: source.workspace.collections[0]!.id, parentFolderId: source.workspace.folders[i - 1]!.id }
  source.workspace.folders[16]!.parentFolderId = null
  source.workspace.requests = source.workspace.folders.map((folder, i) => ({ ...source.workspace.requests[0]!, id: randomUUID(), name: 'API ' + i.toString().padStart(4, '0'), collectionId: folder.collectionId, folderId: folder.id,
    config: { ...source.workspace.requests[0]!.config, queryRows: [], headerRows: [], auth: { mode: 'none' }, body: { kind: 'none' } } }))
  source.workspace.folders.reverse()
  const bytes = Buffer.from(JSON.stringify(source)), start = performance.now()
  expect(bytes.byteLength).toBeLessThan(IMPORT_MAX_BYTES)
  const valid = validateImport(bytes), created = f.r.importWorkspace(valid.workspace), importedAt = performance.now(), result = f.exporter.snapshot(created.id), exportedAt = performance.now()
  expect(normalized(result.workspace)).toEqual(normalized(source.workspace))
  const old = new Set(ids(source)); ids(result).forEach(id => expect(old.has(id)).toBe(false))
  expect(f.exporter.snapshot(f.w.id).workspace).toEqual(f.dto.workspace); expect(f.r.getSelectedWorkspace()).toBe(f.w.id)
  const exportedBytes = Buffer.byteLength(JSON.stringify(result, null, 2) + '\n')
  expect(exportedBytes).toBeLessThan(IMPORT_MAX_BYTES); expect(validateImport(Buffer.from(JSON.stringify(result))).version).toBe(2)
  writeFileSync(join(tmpdir(), 'api-client-task036-scale.json'), JSON.stringify({ inputBytes: bytes.byteLength, exportBytes: exportedBytes, importMs: Math.round(importedAt-start), snapshotMs: Math.round(exportedAt-importedAt), collections: 100, folders: 1000, requests: 1000, depth: 16 }))
  console.info(`TASK-036 large round trip: input=${bytes.byteLength} bytes export=${exportedBytes} bytes import=${Math.round(importedAt-start)} ms snapshot=${Math.round(exportedAt-importedAt)} ms`)
}, 120_000)
