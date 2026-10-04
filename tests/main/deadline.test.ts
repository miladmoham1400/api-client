import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Agent, request, type ClientRequest } from 'node:http'
import { createServer as createTcpServer, Socket } from 'node:net'
import { createGzip } from 'node:zlib'
import { getEventListeners } from 'node:events'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { SecretStore } from '../../src/main/security/secrets'
import { MaterializationService } from '../../src/main/services/materialization'
import { ExecutionService } from '../../src/main/services/execution'
import { executeSingleHop } from '../../src/main/http/transport'
import type { RequestDraft } from '../../src/shared/requests'
import type { ExecutionCompleted } from '../../src/shared/results'
import { startFixture } from '../fixtures/http'

const cleanup: (() => void | Promise<void>)[] = []
class PendingSocket extends Socket { override readonly connecting = true }
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close() })
function service(transport?: ConstructorParameters<typeof ExecutionService>[2]) {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-deadline-')), db = openDatabase(join(directory, 'test.sqlite'))
  const repositories = new Repositories(db), workspace = repositories.createWorkspace('Deadline fixture').id
  repositories.selectWorkspace(workspace)
  const store = new SecretStore(db, { isEncryptionAvailable: () => false, getSelectedStorageBackend: () => 'basic_text', encryptString: () => { throw new Error('Unused') }, decryptString: () => { throw new Error('Unused') } }, 'linux')
  const received: ExecutionCompleted[] = [], waiters: ((event: ExecutionCompleted) => void)[] = []
  const execution = new ExecutionService(new MaterializationService(db, store), event => { received.push(event); waiters.shift()?.(event) }, transport)
  cleanup.push(() => { execution.abort(); store.clear(); db.close(); rmSync(directory, { recursive: true, force: true }) })
  function send(url: string, options: Partial<RequestDraft> = {}) {
    const completed = new Promise<ExecutionCompleted>(resolve => waiters.push(resolve))
    const accepted = execution.send(workspace, null, { name: 'Fixture', method: 'GET', urlTemplate: url, timeoutMs: 100, ...options }, null)
    if (!accepted.ok) throw new Error('Fixture send rejected')
    execution.start(accepted.data.executionId)
    return { id: accepted.data.executionId, completed }
  }
  return { execution, send, received }
}
async function fixture(handler?: Parameters<typeof startFixture>[1]) { const f = await startFixture(false, handler); cleanup.push(f.close); return f }
const countConnections = (server: Awaited<ReturnType<typeof startFixture>>['server']) => new Promise<number>((resolve, reject) => server.getConnections((error, count) => error ? reject(error) : resolve(count)))
async function waitClosed(check: () => Promise<number>) {
  for (let tries = 0; tries < 100; tries++) { if (await check() === 0) return; await new Promise(resolve => setTimeout(resolve, 5)) }
  throw new Error('Fixture connection did not close')
}
it.each(['delayed', 'streaming', 'gzip'] as const)('deadline aborts %s response sockets/decoders and allows another send', async mode => {
  const f = await fixture((_request, response) => {
    let interval: ReturnType<typeof setInterval> | undefined
    if (mode === 'streaming') { response.writeHead(200); response.write('chunk'); interval = setInterval(() => response.write('chunk'), 20) }
    if (mode === 'gzip') {
      response.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Type': 'text/plain' })
      const gzip = createGzip(); gzip.pipe(response); gzip.write('stream'); gzip.flush()
      interval = setInterval(() => { gzip.write('chunk'); gzip.flush() }, 20)
      response.once('close', () => gzip.destroy())
    }
    response.once('close', () => { if (interval) clearInterval(interval) })
  })
  const api = service(), started = performance.now(), result = await api.send(f.url).completed
  expect(result.result).toMatchObject({ code: 'TIMEOUT' }); expect(performance.now() - started).toBeLessThan(1500)
  await waitClosed(() => countConnections(f.server)); expect(api.received).toHaveLength(1)
  const echo = await fixture()
  expect((await api.send(echo.url, { timeoutMs: 2000 }).completed).result).toMatchObject({ statusCode: 200 })
})
it('one deadline spans delayed redirect responses instead of resetting per hop', async () => {
  const paths: string[] = []
  const f = await fixture((incoming, response) => {
    paths.push(incoming.url ?? '')
    const timer = setTimeout(() => {
      if (incoming.url === '/first') { response.writeHead(302, { Location: '/second' }); response.end('first') }
      else response.end('second')
    }, 120)
    response.once('close', () => clearTimeout(timer))
  })
  const api = service()
  expect((await api.send(f.url + '/first', { timeoutMs: 200, followRedirects: true }).completed).result).toMatchObject({ code: 'TIMEOUT' })
  expect(paths).toEqual(['/first', '/second']); await waitClosed(() => countConnections(f.server)); expect(api.received).toHaveLength(1)
})
it('cancel closes an active compressed response and does not accumulate abort listeners', async () => {
  let capturedSignal: AbortSignal | undefined
  let responseStarted: (() => void) | undefined
  const streaming = new Promise<void>(resolve => { responseStarted = resolve })
  const f = await fixture((_incoming, response) => { response.writeHead(200, { 'Content-Encoding': 'gzip' }); const gzip = createGzip(); gzip.pipe(response); gzip.write('chunk'); gzip.flush(); response.once('close', () => gzip.destroy()) })
  const api = service((plan, signal, started) => { capturedSignal = signal; return executeSingleHop(plan, signal, started, (url, options, callback) => request(url, options, response => { callback(response); responseStarted?.() })) })
  const result = api.send(f.url, { timeoutMs: 2000 })
  await streaming
  api.execution.cancel(result.id); api.execution.cancel(result.id)
  expect((await result.completed).result).toMatchObject({ code: 'CANCELLED' })
  await waitClosed(() => countConnections(f.server))
  expect(capturedSignal?.aborted).toBe(true)
  if (!capturedSignal) throw new Error('Missing signal')
  expect(getEventListeners(capturedSignal, 'abort')).toHaveLength(0); expect(api.received).toHaveLength(1)
})
it('deadline aborts pending DNS and removes its request listener before late lookup completion', async () => {
  let lateLookup: (() => void) | undefined, capturedRequest: ClientRequest | undefined, capturedSignal: AbortSignal | undefined
  const api = service((plan, signal, started) => {
    capturedSignal = signal
    return executeSingleHop(plan, signal, started, (url, options, callback) => {
      const req = request(url, { ...options, lookup: (_hostname, _options, done) => { lateLookup = () => done(null, '127.0.0.1', 4) } }, callback)
      capturedRequest = req; return req
    })
  })
  expect((await api.send('http://pending-dns.test/').completed).result).toMatchObject({ code: 'TIMEOUT' })
  await new Promise(resolve => setImmediate(resolve)); expect(capturedRequest?.destroyed).toBe(true)
  if (!capturedSignal) throw new Error('Missing signal')
  expect(getEventListeners(capturedSignal, 'abort')).toHaveLength(0)
  lateLookup?.(); await new Promise(resolve => setImmediate(resolve)); expect(api.received).toHaveLength(1)
})
it.each(['connect', 'upload'] as const)('deadline aborts stalled %s and closes its socket', async mode => {
  const sockets = new Set<Socket>(), server = createTcpServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.pause() })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanup.push(() => new Promise<void>(resolve => { for (const socket of sockets) socket.destroy(); server.close(() => resolve()) }))
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing address')
  let capturedRequest: ClientRequest | undefined, pendingSocket: Socket | undefined, finished = false
  const api = service((plan, signal, started) => executeSingleHop(plan, signal, started, (url, options, callback) => {
    // An unconnected socket deterministically holds the connect phase without external routing.
    const agent = new Agent()
    agent.createConnection = () => { pendingSocket = new PendingSocket(); return pendingSocket }
    const req = request(url, mode === 'connect' ? { ...options, agent } : options, callback)
    capturedRequest = req; req.once('finish', () => { finished = true }); return req
  }))
  const options: Partial<RequestDraft> = mode === 'upload' ? { method: 'POST', body: { kind: 'raw', text: 'x'.repeat(5 * 1024 * 1024), mediaType: 'text/plain' } } : {}
  expect((await api.send(`http://127.0.0.1:${address.port}/`, options).completed).result).toMatchObject({ code: 'TIMEOUT' })
  await new Promise(resolve => setImmediate(resolve)); expect(capturedRequest?.destroyed).toBe(true)
  if (mode === 'upload') expect(finished).toBe(false)
  else { expect(pendingSocket?.destroyed).toBe(true); expect(sockets.size).toBe(0) }
  expect(api.received).toHaveLength(1)
})
