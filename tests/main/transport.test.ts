import { afterEach, beforeEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { materialize, type MaterializedRequest } from '../../src/main/http/materialize'
import { executeSingleHop, transportError } from '../../src/main/http/transport'
import { createDefaultRequestConfig, type RuntimeRequestConfig } from '../../src/shared/request-config'
import { mergeVariables } from '../../src/shared/variables'
import { LIMITS } from '../../src/shared/primitives'
import { startFixture } from '../fixtures/http'

let fixture: Awaited<ReturnType<typeof startFixture>>
beforeEach(async () => { fixture = await startFixture() })
afterEach(async () => { await fixture.close() })
function capture(path: string, config: Partial<RuntimeRequestConfig> = {}): MaterializedRequest {
  const variables = mergeVariables(randomUUID(), null, [])
  if (!variables.ok) throw new Error('Invalid fixture variables')
  const result = materialize({ ...createDefaultRequestConfig(), urlTemplate: fixture.url + path, ...config }, variables.data)
  if (!result.ok) throw new Error('Invalid fixture snapshot')
  return result.data
}
const send = (snapshot: MaterializedRequest) => executeSingleHop(snapshot, new AbortController().signal)
it('sends original UTF-8 bytes, appended query and ordered duplicate headers over native HTTP', async () => {
  const text = ' { "message": "سلام" } \n', row = (key: string, value: string) => ({ id: randomUUID(), enabled: true, key, value })
  const result = await send(capture('/echo?key=first', { method: 'POST', queryRows: [row('key', 'second'), row('', '')], headerRows: [row('X-Fixture', 'one'), row('X-Fixture', 'two')], body: { kind: 'json', text }, auth: { mode: 'basic', usernameTemplate: 'کاربر', passwordTemplate: 'synthetic' } }))
  expect(result.ok).toBe(true)
  if (!result.ok || result.data.body.kind !== 'text') throw new Error('Missing echo text')
  const echo: unknown = JSON.parse(result.data.body.text)
  expect(echo).toMatchObject({ method: 'POST', url: '/echo?key=first&key=second&=', bodyBase64: Buffer.from(text).toString('base64'), bodyLength: Buffer.byteLength(text) })
  expect(echo).toMatchObject({ rawHeaders: expect.arrayContaining(['X-Fixture', 'one', 'X-Fixture', 'two', 'application/json', String(Buffer.byteLength(text)), `Basic ${Buffer.from('کاربر:synthetic').toString('base64')}`, 'gzip, deflate, br', new URL(fixture.url).host]) })
})
it('keeps non-2xx and redirect-off responses, duplicate Set-Cookie headers and monotonic metadata', async () => {
  const result = await send(capture('/status'))
  expect(result).toMatchObject({ ok: true, data: { statusCode: 503, redirectCount: 0, finalUrl: fixture.url + '/status', bodySizeBytes: 19, body: { kind: 'text', text: 'service unavailable' } } })
  if (!result.ok) throw new Error('Missing response')
  expect(result.data.durationMs).toBeGreaterThanOrEqual(0)
  expect(result.data.headers.filter(h => h.name.toLowerCase() === 'set-cookie')).toEqual([{ name: 'Set-Cookie', value: 'fixture=a' }, { name: 'Set-Cookie', value: 'fixture=b' }])
  expect(await send(capture('/redirect'))).toMatchObject({ ok: true, data: { statusCode: 302, redirectCount: 0, body: { text: 'original redirect' } } })
  expect(await send(capture('/echo', { followRedirects: true }))).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
})
it.each(['GET', 'HEAD', 'OPTIONS'] as const)('sends %s without a body or automatic Content-Type', async method => {
  const result = await send(capture('/echo', { method }))
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('Missing response')
  if (method === 'HEAD') { expect(result.data.bodySizeBytes).toBe(0); return }
  if (result.data.body.kind !== 'text') throw new Error('Missing text')
  expect(JSON.parse(result.data.body.text)).toMatchObject({ method, bodyLength: 0 })
  expect(result.data.body.text).not.toContain('Content-Type')
})
it.each(['gzip', 'deflate', 'br'])('decodes %s and reports decoded UTF-8 byte size', async encoding => {
  expect(await send(capture('/' + encoding))).toMatchObject({ ok: true, data: { bodySizeBytes: Buffer.byteLength('{"message":"سلام"}'), body: { kind: 'text', text: '{"message":"سلام"}', charset: 'utf-8' } } })
  expect(await send(capture('/corrupt/' + encoding))).toMatchObject({ ok: false, error: { code: 'DECOMPRESSION_FAILURE' } })
})
it.each(['/empty', '/not-modified'])('accepts empty %s responses despite compression metadata', async path => {
  expect(await send(capture(path))).toMatchObject({ ok: true, data: { bodySizeBytes: 0 } })
})
it.each(['/binary', '/charset', '/unknown-encoding', '/nul', '/invalid-utf8'])('classifies %s as binary without lossy decoding', async path => {
  expect(await send(capture(path))).toMatchObject({ ok: true, data: { body: { kind: 'binary' } } })
})
it.each(['/missing-type', '/xml', '/json'])('classifies valid UTF-8 %s as text', async path => {
  expect(await send(capture(path))).toMatchObject({ ok: true, data: { body: { kind: 'text', charset: 'utf-8' } } })
})
it('enforces inclusive encoded and decoded limits, including compressed bombs', async () => {
  expect(await send(capture('/at-limit'))).toMatchObject({ ok: true, data: { bodySizeBytes: LIMITS.decodedResponseBytes, body: { kind: 'binary', sizeBytes: LIMITS.decodedResponseBytes } } })
  for (const path of ['/encoded-large', '/bomb']) expect(await send(capture(path))).toMatchObject({ ok: false, error: { code: 'RESPONSE_TOO_LARGE' } })
})
it('maps reset/truncated/upgrade failures and aborts active streams without hanging', async () => {
  for (const path of ['/reset', '/truncated', '/upgrade']) expect(await send(capture(path))).toMatchObject({ ok: false, error: { code: 'NETWORK_FAILURE' } })
  const controller = new AbortController(), result = executeSingleHop(capture('/hold'), controller.signal)
  await new Promise<void>(resolve => fixture.server.once('request', () => resolve()))
  controller.abort()
  expect(await result).toMatchObject({ ok: false, error: { code: 'CANCELLED' } })
  expect(await executeSingleHop(capture('/echo'), controller.signal)).toMatchObject({ ok: false, error: { code: 'CANCELLED' } })
})
it('rejects untrusted TLS and maps refusal/DNS errors without leaking raw diagnostics', async () => {
  const secure = await startFixture(true)
  try { expect(await send(capture('', { urlTemplate: secure.url + '/echo' }))).toMatchObject({ ok: false, error: { code: 'TLS_FAILURE' } }) }
  finally { await secure.close() }
  const closed = await startFixture(), url = closed.url
  await closed.close()
  expect(await send(capture('', { urlTemplate: url }))).toMatchObject({ ok: false, error: { code: 'CONNECTION_REFUSED' } })
  for (const code of ['ENOTFOUND', 'EAI_AGAIN']) {
    const result = transportError({ code, message: 'synthetic-token /private/path https://fixture?credential=synthetic' })
    expect(result.code).toBe('DNS_FAILURE'); expect(JSON.stringify(result)).not.toContain('synthetic'); expect(JSON.stringify(result)).not.toContain('/private')
  }
  for (const code of ['EPROTO', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_SSL_WRONG_VERSION_NUMBER', 'CERT_HAS_EXPIRED', 'SELF_SIGNED_CERT_IN_CHAIN']) expect(transportError({ code }).code).toBe('TLS_FAILURE')
})

it.each(['PUT', 'PATCH', 'DELETE'] as const)('preserves %s and raw UTF-8 body bytes on the wire', async method => {
  const text = 'synthetic سلام'
  const result = await send(capture('/echo', { method, body: { kind: 'raw', text, mediaType: 'text/plain' } }))
  if (!result.ok || result.data.body.kind !== 'text') throw new Error('Missing captured request')
  expect(JSON.parse(result.data.body.text)).toMatchObject({ method, bodyLength: Buffer.byteLength(text), bodyBase64: Buffer.from(text).toString('base64') })
})
it('keeps 401/500 and literal HTML as responses and aborts the delayed fixture', async () => {
  for (const statusCode of [401, 500]) expect(await send(capture('/status/' + statusCode))).toMatchObject({ ok: true, data: { statusCode, body: { kind: 'text', text: 'synthetic HTTP error' } } })
  expect(await send(capture('/html'))).toMatchObject({ ok: true, data: { statusCode: 200, body: { kind: 'text', text: '<script>window.syntheticResponseExecuted=true</script>' } } })
  const controller = new AbortController()
  const seen = new Promise<void>(resolve => fixture.server.once('request', () => resolve()))
  const pending = executeSingleHop(capture('/delay'), controller.signal)
  await seen
  controller.abort()
  expect(await pending).toMatchObject({ ok: false, error: { code: 'CANCELLED' } })
})
