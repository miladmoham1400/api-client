import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { SecretStore } from '../../src/main/security/secrets'
import { MaterializationService } from '../../src/main/services/materialization'
import { WorkspaceService } from '../../src/main/services/workspaces'
import { ExecutionService } from '../../src/main/services/execution'
import { createExecutionHandlers } from '../../src/main/ipc/execution'
import type { ExecutionCompleted, HttpResponse, Result } from '../../src/shared/results'
import { createDefaultRequestConfig } from '../../src/shared/request-config'

const cleanups: (() => void)[] = []
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup() })
const draft = { name: 'Fixture', method: 'GET' as const, urlTemplate: 'http://127.0.0.1/echo' }
const response: HttpResponse = { statusCode: 200, statusMessage: 'OK', finalUrl: draft.urlTemplate, redirectCount: 0, durationMs: 1, bodySizeBytes: 0, headers: [], body: { kind: 'text', text: '', charset: 'utf-8' } }
function fixture(transport: ConstructorParameters<typeof ExecutionService>[2] = async () => ({ ok: true, data: response })) {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-execution-')), db = openDatabase(join(directory, 'fixture.sqlite'))
  const r = new Repositories(db), a = r.createWorkspace('A').id, b = r.createWorkspace('B').id
  r.selectWorkspace(a)
  const store = new SecretStore(db, { isEncryptionAvailable: () => false, getSelectedStorageBackend: () => 'basic_text', encryptString: () => { throw new Error('Unused') }, decryptString: () => { throw new Error('Unused') } }, 'linux')
  const completed: ExecutionCompleted[] = [], service = new ExecutionService(new MaterializationService(db, store), value => completed.push(value), transport)
  cleanups.push(() => { service.abort(); store.clear(); db.close(); rmSync(directory, { recursive: true, force: true }) })
  const frame = { url: 'file:///app/index.html' }, contents = { mainFrame: frame }, window = { isDestroyed: () => false, webContents: contents }
  return { db, r, a, b, service, completed, frame, contents, window, handlers: createExecutionHandlers(() => window, frame.url, () => service), event: { sender: contents, senderFrame: frame } }
}
function accepted(result: Result<{ executionId: string }>): string { if (!result.ok) throw new Error('Acceptance failed'); return result.data.executionId }
it('requires owned main frame, active workspace, owned request/environment and validated inputs before reserving a slot', () => {
  const f = fixture(), foreign = f.r.createRequest(f.b, 'Foreign', null, { ...createDefaultRequestConfig(), auth: { mode: 'none' } }).id, environment = f.r.createEnvironment(f.b, 'Foreign').id
  for (const [w, request, env] of [[f.b, null, null], [f.a, foreign, null], [f.a, null, environment], [f.a, randomUUID(), null]] as const) expect(f.handlers.send(f.event, w, request, draft, env)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  for (const event of [{ sender: {}, senderFrame: f.frame }, { sender: f.contents, senderFrame: { url: f.frame.url } }, { sender: f.contents, senderFrame: null }]) expect(f.handlers.send(event, f.a, null, draft, null)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  expect(f.handlers.send(f.event, f.a, null, { ...draft, arbitrary: 'synthetic' }, null)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  expect(f.handlers.send(f.event, f.a, null, { ...draft, followRedirects: true }, null)).toMatchObject({ ok: false, error: { code: 'VALIDATION', field: 'followRedirects' } })
  expect(f.handlers.send(f.event, f.a, null, draft, null).ok).toBe(true)
  const unavailable = createExecutionHandlers(() => f.window, f.frame.url, () => null)
  expect(unavailable.send(f.event, f.a, null, draft, null)).toMatchObject({ ok: false, error: { code: 'DATABASE_UNAVAILABLE' } })
})
it('waits for owned acknowledgement, snapshots variables before I/O and guards duplicate/wrong starts and concurrent sends', async () => {
  const transport = vi.fn(async () => ({ ok: true as const, data: response })), f = fixture(transport)
  f.r.upsertVariable(f.a, null, 'host', { isSensitive: false, plainValue: 'http://127.0.0.1', secretId: null })
  const id = accepted(f.handlers.send(f.event, f.a, null, { ...draft, urlTemplate: '{{host}}/echo' }, null))
  f.r.upsertVariable(f.a, null, 'host', { isSensitive: false, plainValue: 'http://changed.invalid', secretId: null })
  expect(transport).not.toHaveBeenCalled()
  expect(f.handlers.send(f.event, f.a, null, draft, null)).toMatchObject({ ok: false, error: { code: 'REQUEST_BUSY' } })
  f.handlers.start({ sender: {}, senderFrame: f.frame }, id); f.handlers.start(f.event, randomUUID())
  await Promise.resolve(); expect(transport).not.toHaveBeenCalled()
  f.handlers.start(f.event, id); f.handlers.start(f.event, id)
  await vi.waitFor(() => expect(f.completed).toHaveLength(1))
  expect(transport).toHaveBeenCalledTimes(1)
  expect(transport.mock.calls[0]).toMatchObject([{ url: draft.urlTemplate }, expect.any(AbortSignal), expect.any(Number)])
  expect(f.completed[0]).toEqual({ executionId: id, result: response })
  expect(f.service.send(f.a, null, draft, null).ok).toBe(true)
})
it.each(['response', 'error', 'throw', 'invalid'] as const)('releases the slot on %s terminal outcomes, including injected transport faults', async outcome => {
  const f = fixture(async () => {
    if (outcome === 'throw') throw new Error('synthetic credential /private/path')
    return outcome === 'error' ? { ok: false, error: { code: 'NETWORK_FAILURE', message: 'Network request failed', retryable: true } } : { ok: true, data: outcome === 'invalid' ? { ...response, statusCode: 0 } : response }
  })
  const id = accepted(f.service.send(f.a, null, draft, null)); f.service.start(id)
  await vi.waitFor(() => expect(f.completed).toHaveLength(1))
  expect(JSON.stringify(f.completed)).not.toContain('synthetic'); expect(JSON.stringify(f.completed)).not.toContain('/private')
  expect(f.completed[0]?.executionId).toBe(id)
  expect(f.service.send(f.a, null, draft, null).ok).toBe(true)
})
it('aborts active or accepted executions exactly once on lifecycle cleanup; late settlement cannot clear a newer slot', async () => {
  let settle: ((result: Result<HttpResponse>) => void) | undefined, signal: AbortSignal | undefined
  const f = fixture((_snapshot, activeSignal) => { signal = activeSignal; return new Promise(resolve => { settle = resolve }) })
  const id = accepted(f.service.send(f.a, null, draft, null)); f.service.start(id)
  await Promise.resolve()
  f.service.abortWorkspace(f.b); expect(signal?.aborted).toBe(false)
  f.service.abort(); f.service.abort()
  expect(signal?.aborted).toBe(true); expect(f.completed).toEqual([{ executionId: id, result: { code: 'CANCELLED', message: 'Request cancelled', retryable: false } }])
  const next = accepted(f.service.send(f.a, null, draft, null))
  settle?.({ ok: true, data: response })
  await Promise.resolve(); await Promise.resolve()
  expect(f.completed).toHaveLength(1)
  expect(f.service.send(f.a, null, draft, null)).toMatchObject({ ok: false, error: { code: 'REQUEST_BUSY' } })
  f.service.abortWorkspace(f.a)
  expect(f.completed[1]?.executionId).toBe(next)
})
it('aborts only after a successful owning workspace deletion; failed deletion keeps execution alive', () => {
  const f = fixture(), service = new WorkspaceService(f.db, undefined, id => f.service.abortWorkspace(id))
  const id = accepted(f.service.send(f.a, null, draft, null))
  service.delete(f.b); expect(f.completed).toEqual([])
  f.db.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON workspaces BEGIN SELECT RAISE(ABORT,'synthetic'); END;")
  expect(() => service.delete(f.a)).toThrow(); expect(f.completed).toEqual([])
  f.db.exec('DROP TRIGGER fail_delete'); service.delete(f.a)
  expect(f.completed).toMatchObject([{ executionId: id, result: { code: 'CANCELLED' } }])
})
