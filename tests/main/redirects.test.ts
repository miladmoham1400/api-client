import { afterEach, beforeEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { request as httpsRequest } from 'node:https'
import { request as httpRequest } from 'node:http'
import { materialize, type MaterializedRequest } from '../../src/main/http/materialize'
import { executeWithRedirects } from '../../src/main/http/redirects'
import { executeSingleHop } from '../../src/main/http/transport'
import { createDefaultRequestConfig, type RuntimeRequestConfig } from '../../src/shared/request-config'
import { mergeVariables } from '../../src/shared/variables'
import type { HttpResponse, Result } from '../../src/shared/results'
import { startRedirectFixture, type ReceivedRequest } from '../fixtures/redirects'
import { tlsFixture } from '../fixtures/http'

let a: Awaited<ReturnType<typeof startRedirectFixture>>, b: Awaited<ReturnType<typeof startRedirectFixture>>
const extra: Awaited<ReturnType<typeof startRedirectFixture>>[] = []
beforeEach(async () => { a = await startRedirectFixture(); b = await startRedirectFixture() })
afterEach(async () => { await Promise.all([a.close(), b.close(), ...extra.splice(0).map(fixture => fixture.close())]) })
function capture(url: string, config: Partial<RuntimeRequestConfig> = {}): MaterializedRequest {
  const variables = mergeVariables(randomUUID(), null, [])
  if (!variables.ok) throw new Error('Invalid fixture variables')
  const result = materialize({ ...createDefaultRequestConfig(), urlTemplate: url, followRedirects: true, ...config }, variables.data)
  if (!result.ok) throw new Error('Invalid fixture snapshot')
  return result.data
}
const row = (key: string, value: string) => ({ id: randomUUID(), enabled: true, key, value })
const credentials = [row('aUtHoRiZaTiOn', 'Bearer synthetic'), row('pRoXy-AuThOrIzAtIoN', 'Basic synthetic'), row('cOoKiE', 'fixture=synthetic')]
const names = (request: ReceivedRequest | undefined) => request?.headers.map(header => header.name.toLowerCase()) ?? []
const send = (plan: MaterializedRequest) => executeWithRedirects(plan, new AbortController().signal)
function echo(result: Result<HttpResponse>): ReceivedRequest {
  if (!result.ok || result.data.body.kind !== 'text') throw new Error('Missing echo')
  return JSON.parse(result.data.body.text) as ReceivedRequest
}
it('OFF returns original 3xx; ON resolves relative Location once and reports final URL/count/duration', async () => {
  a.routes.set('/directory/start', { status: 302, location: '../echo?key=one&key=two&empty=' })
  const original = capture(a.url + '/directory/start', { followRedirects: false, queryRows: [row('initial', 'only')] })
  expect(await send(original)).toMatchObject({ ok: true, data: { statusCode: 302, redirectCount: 0, body: { text: 'original redirect' } } })
  expect(a.received).toHaveLength(1)
  const started = performance.now() - 50
  const result = await executeWithRedirects(capture(original.url), new AbortController().signal, started)
  expect(result).toMatchObject({ ok: true, data: { statusCode: 200, finalUrl: a.url + '/echo?key=one&key=two&empty=', redirectCount: 1 } })
  expect(echo(result).url).toBe('/echo?key=one&key=two&empty=')
  expect(result.ok && result.data.durationMs).toBeGreaterThanOrEqual(50)
})
it.each([301, 302, 303])('%s rewrites POST to GET, drops body/entity headers and retains same-origin credentials', async status => {
  a.routes.set('/start', { status, location: '/echo' })
  const plan = capture(a.url + '/start', { method: 'POST', body: { kind: 'raw', text: 'سلام', mediaType: 'text/plain' }, headerRows: [...credentials, row('Content-Encoding', 'identity'), row('Content-Language', 'fa'), row('X-Fixture', 'kept')] })
  const originalHeaders = plan.headers, result = await send(plan), received = echo(result)
  expect(received).toMatchObject({ method: 'GET', bodyLength: 0 })
  expect(names(received)).not.toEqual(expect.arrayContaining(['content-type', 'content-length', 'content-encoding', 'content-language']))
  expect(names(received).filter(name => name.startsWith('content-'))).toEqual([])
  expect(names(received)).toEqual(expect.arrayContaining(['authorization', 'proxy-authorization', 'cookie', 'x-fixture']))
  expect(a.received[0]?.bodyBase64).toBe(Buffer.from('سلام').toString('base64'))
  expect(plan.method).toBe('POST'); expect(plan.bodyBytes?.toString()).toBe('سلام'); expect(plan.headers).toEqual(originalHeaders)
})
it.each([301, 302, 307, 308])('%s preserves PATCH and exact JSON bytes', async status => {
  const text = ' {"message":"سلام"} \n'
  a.routes.set('/start', { status, location: '/echo' })
  const plan = capture(a.url + '/start', { method: 'PATCH', body: { kind: 'json', text } })
  const received = echo(await send(plan))
  expect(received).toMatchObject({ method: 'PATCH', bodyBase64: Buffer.from(text).toString('base64'), bodyLength: Buffer.byteLength(text) })
  expect(names(received)).toEqual(expect.arrayContaining(['content-type', 'content-length']))
})
it.each([307, 308])('%s replays POST bytes and duplicates on a cross-origin hop while stripping only credentials', async status => {
  const text = '原文 سلام', plan = capture(a.url + '/start', { method: 'POST', body: { kind: 'raw', text, mediaType: 'text/plain' }, headerRows: [...credentials, row('X-Fixture', 'one'), row('X-Fixture', 'two')] })
  a.routes.set('/start', { status, location: b.url + '/echo' })
  const received = echo(await send(plan))
  expect(received).toMatchObject({ method: 'POST', bodyBase64: Buffer.from(text).toString('base64'), bodyLength: Buffer.byteLength(text) })
  expect(names(received).filter(name => ['authorization', 'proxy-authorization', 'cookie'].includes(name))).toEqual([])
  expect(received.headers.filter(header => header.name.toLowerCase() === 'x-fixture').map(header => header.value)).toEqual(['one', 'two'])
  expect(received.headers.find(header => header.name.toLowerCase() === 'host')?.value).toBe(new URL(b.url).host)
  expect(names(a.received[0])).toEqual(expect.arrayContaining(['authorization', 'proxy-authorization', 'cookie']))
})
it('303 rewrites DELETE but preserves HEAD; 301/302 preserve GET/HEAD and 307/308 preserve HEAD', async () => {
  a.routes.set('/start', { status: 303, location: '/echo' })
  expect(echo(await send(capture(a.url + '/start', { method: 'DELETE', body: { kind: 'raw', text: 'synthetic', mediaType: 'text/plain' } })))).toMatchObject({ method: 'GET', bodyLength: 0 })
  for (const status of [301, 302, 303, 307, 308]) {
    a.routes.set('/start', { status, location: '/echo' })
    expect(await send(capture(a.url + '/start', { method: 'HEAD' }))).toMatchObject({ ok: true, data: { statusCode: 200, redirectCount: 1, bodySizeBytes: 0 } })
    expect(a.received.at(-1)?.method).toBe('HEAD')
  }
})
it('credentials stay stripped on an origin return and Set-Cookie never becomes a request Cookie', async () => {
  a.routes.set('/start', { status: 307, location: b.url + '/return', headers: { 'Set-Cookie': 'response-only=synthetic' } })
  b.routes.set('/return', { status: 308, location: a.url + '/echo' })
  const result = await send(capture(a.url + '/start', { headerRows: credentials }))
  expect(result).toMatchObject({ ok: true, data: { redirectCount: 2 } })
  for (const record of [b.received[0], a.received[1]]) expect(names(record).filter(name => ['authorization', 'proxy-authorization', 'cookie'].includes(name))).toEqual([])
  a.routes.set('/same-origin', { status: 302, location: '/echo', headers: { 'Set-Cookie': 'response-only=synthetic' } })
  expect(names(echo(await send(capture(a.url + '/same-origin'))))).not.toContain('cookie')
})
it('exactly five followed hops succeed; six and cycles terminate without opening another hop', async () => {
  for (let index = 1; index <= 6; index++) a.routes.set('/chain/' + index, { status: 302, location: index === 1 ? '/echo' : '/chain/' + (index - 1) })
  expect(await send(capture(a.url + '/chain/5'))).toMatchObject({ ok: true, data: { redirectCount: 5, finalUrl: a.url + '/echo' } })
  a.received.length = 0
  expect(await send(capture(a.url + '/chain/6'))).toMatchObject({ ok: false, error: { code: 'REDIRECT_LIMIT' } })
  expect(a.received).toHaveLength(6); expect(a.received.at(-1)?.url).toBe('/chain/1')
  a.routes.set('/loop', { status: 301, location: '/loop' }); a.received.length = 0
  expect(await send(capture(a.url + '/loop'))).toMatchObject({ ok: false, error: { code: 'REDIRECT_LIMIT' } }); expect(a.received).toHaveLength(6)
})
it.each([['http://', 'INVALID_URL'], ['', 'INVALID_URL'], ['/echo#fragment', 'INVALID_URL'], ['/echo#', 'INVALID_URL'], ['http://synthetic:credential@127.0.0.1/echo', 'INVALID_URL'], ['file:///private/synthetic', 'UNSUPPORTED_SCHEME'], ['ftp://fixture/echo', 'UNSUPPORTED_SCHEME']])('rejects invalid Location %s before next I/O without echoing target', async (location, code) => {
  a.routes.set('/start', { status: 302, location })
  const result = await send(capture(a.url + '/start'))
  expect(result).toMatchObject({ ok: false, error: { code } }); expect(a.received).toHaveLength(1); expect(b.received).toHaveLength(0)
  expect(JSON.stringify(result)).not.toContain('synthetic'); expect(JSON.stringify(result)).not.toContain('/private')
})
it('missing Location and non-followed status codes remain original responses, including OFF invalid targets', async () => {
  for (const route of [{ status: 302 }, { status: 300, location: '/echo' }, { status: 304, location: '/echo' }, { status: 305, location: '/echo' }]) {
    a.routes.set('/start', route)
    expect(await send(capture(a.url + '/start'))).toMatchObject({ ok: true, data: { statusCode: route.status, redirectCount: 0 } })
  }
  a.routes.set('/start', { status: 302, location: 'file:///private/synthetic' })
  expect(await send(capture(a.url + '/start', { followRedirects: false }))).toMatchObject({ ok: true, data: { statusCode: 302, redirectCount: 0 } })
})
it('trusted HTTPS rejects downgrade before any HTTP request and strips credentials on HTTP to HTTPS upgrade', async () => {
  const secure = await startRedirectFixture(true); extra.push(secure)
  // Private request-factory injection trusts only the public fixture certificate, with TLS validation ON.
  const trustedHop = (plan: MaterializedRequest, signal: AbortSignal, started: number) => executeSingleHop(plan, signal, started, (url, options, callback) => {
    expect(options.rejectUnauthorized).toBe(true)
    return url.protocol === 'https:' ? httpsRequest(url, { ...options, ca: tlsFixture.cert }, callback) : httpRequest(url, options, callback)
  })
  secure.routes.set('/start', { status: 302, location: a.url + '/echo' })
  expect(await executeWithRedirects(capture(secure.url + '/start'), new AbortController().signal, performance.now(), trustedHop)).toMatchObject({ ok: false, error: { code: 'REDIRECT_DOWNGRADE' } })
  expect(secure.received).toHaveLength(1); expect(a.received).toHaveLength(0)
  a.routes.set('/start', { status: 307, location: secure.url + '/echo' })
  const result = await executeWithRedirects(capture(a.url + '/start', { headerRows: credentials }), new AbortController().signal, performance.now(), trustedHop)
  expect(result).toMatchObject({ ok: true, data: { finalUrl: secure.url + '/echo', redirectCount: 1 } })
  expect(names(echo(result)).filter(name => ['authorization', 'proxy-authorization', 'cookie'].includes(name))).toEqual([])
})
it('normalizes same-origin host/default port, keeps immutable replay bytes and shares one signal/start time across hops', async () => {
  const text = 'سلام', snapshot = capture('http://EXAMPLE.test:80/start', { method: 'POST', body: { kind: 'raw', text, mediaType: 'text/plain' }, headerRows: credentials })
  const controller = new AbortController(), started = performance.now(), seen: MaterializedRequest[] = []
  const result = await executeWithRedirects(snapshot, controller.signal, started, async (plan, signal, time) => {
    expect(signal).toBe(controller.signal); expect(time).toBe(started); expect(Object.isFrozen(plan)).toBe(true); expect(Object.isFrozen(plan.headers)).toBe(true)
    expect(plan.bodyBytes?.toString()).toBe(text)
    plan.bodyBytes?.fill(0); seen.push(plan)
    return { ok: true, data: { statusCode: seen.length === 1 ? 307 : 200, statusMessage: 'Fixture', finalUrl: plan.url, redirectCount: 0, durationMs: 1, bodySizeBytes: 0, headers: seen.length === 1 ? [{ name: 'Location', value: 'http://example.test:80/echo' }] : [], body: { kind: 'text', text: '', charset: 'utf-8' } } }
  })
  expect(result).toMatchObject({ ok: true, data: { redirectCount: 1 } })
  expect(seen[1]?.headers).toEqual(snapshot.headers); expect(snapshot.bodyBytes?.toString()).toBe(text)
})
it('a lifecycle abort between hops cannot start another socket', async () => {
  const controller = new AbortController(); let calls = 0
  const result = await executeWithRedirects(capture(a.url + '/start'), controller.signal, performance.now(), async plan => {
    calls++; controller.abort()
    return { ok: true, data: { statusCode: 302, statusMessage: 'Fixture', finalUrl: plan.url, redirectCount: 0, durationMs: 1, bodySizeBytes: 0, headers: [{ name: 'Location', value: b.url + '/echo' }], body: { kind: 'text', text: '', charset: 'utf-8' } } }
  })
  expect(result).toMatchObject({ ok: false, error: { code: 'CANCELLED' } }); expect(calls).toBe(1)
})
