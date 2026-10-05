import { expect, it } from 'vitest'
import { materialize } from '../../src/main/http/materialize'
import { createDefaultRequestConfig, type RuntimeRequestConfig } from '../../src/shared/request-config'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const row = (n: number, key: string, value: string, enabled = true) => ({ id: id(n), key, value, enabled })
const config = (): RuntimeRequestConfig => ({ ...createDefaultRequestConfig(), method: 'POST', urlTemplate: 'http://127.0.0.1/echo?existing=%2F' })
it('appends duplicate query rows in order with exactly-once encoding, preserving templates', () => {
  const c = { ...config(), urlTemplate: '{{host}}/echo?existing=%2F', queryRows: [row(1, '{{key}}', '%2F'), row(2, '{{key}}', 'سلام /'), row(3, '{{missing}}', '', false)] }, copy = structuredClone(c)
  const result = materialize(c, new Map([['host', 'http://127.0.0.1'], ['key', 'same']]))
  expect(c).toEqual(copy)
  expect(result).toMatchObject({ ok: true, data: { url: 'http://127.0.0.1/echo?existing=%2F&same=%252F&same=%D8%B3%D9%84%D8%A7%D9%85+%2F' } })
})
it('generates Bearer and UTF-8 Basic bytes and rejects colon in the resolved username', () => {
  expect(materialize({ ...config(), auth: { mode: 'bearer', tokenTemplate: '{{fixture}}' } }, new Map([['fixture', 'synthetic-token']]))).toMatchObject({ ok: true, data: { headers: [{ name: 'Authorization', value: 'Bearer synthetic-token' }, { name: 'Accept-Encoding', value: 'gzip, deflate, br' }] } })
  const c = { ...config(), auth: { mode: 'basic' as const, usernameTemplate: '{{user}}', passwordTemplate: 'رمز' } }
  const result = materialize(c, new Map([['user', 'کاربر']]))
  expect(result).toMatchObject({ ok: true, data: { headers: [{ name: 'Authorization', value: `Basic ${Buffer.from('کاربر:رمز', 'utf8').toString('base64')}` }, { name: 'Accept-Encoding', value: 'gzip, deflate, br' }] } })
  expect(materialize(c, new Map([['user', 'a:b']]))).toMatchObject({ ok: false, error: { field: 'auth.usernameTemplate' } })
})
it('serializes raw Unicode and original JSON bytes, with byte Content-Length and independent immutable snapshots', () => {
  const c = { ...config(), body: { kind: 'raw' as const, text: 'سلام 🌍\n', mediaType: 'text/plain; charset=utf-8' } }, result = materialize(c, new Map())
  if (!result.ok) throw new Error('Missing materialization')
  expect(result.data.bodyBytes).toEqual(Buffer.from(c.body.text, 'utf8'))
  expect(result.data.headers).toContainEqual({ name: 'Content-Length', value: String(Buffer.byteLength(c.body.text, 'utf8')) })
  expect(Object.isFrozen(result.data)).toBe(true); expect(Object.isFrozen(result.data.headers)).toBe(true)
  result.data.bodyBytes!.fill(0); c.body.text = 'edited'
  expect(result.data.bodyBytes!.toString('utf8')).toBe('سلام 🌍\n')
  const json = materialize({ ...config(), body: { kind: 'json', text: ' {\n "value": "{{fixture}}"\n} ' } }, new Map([['fixture', 'سلام']]))
  expect(json.ok && json.data.bodyBytes?.toString('utf8')).toBe(' {\n "value": "سلام"\n} ')
})
it('keeps None distinct from empty raw, rejects blank/invalid substituted JSON and GET/HEAD bodies', () => {
  const none = materialize(config(), new Map()), empty = materialize({ ...config(), body: { kind: 'raw', text: '', mediaType: 'text/plain' } }, new Map())
  expect(none.ok && none.data.bodyBytes).toBeNull(); expect(empty.ok && empty.data.bodyBytes?.length).toBe(0)
  expect(none.ok && none.data.headers.some(h => h.name === 'Content-Type')).toBe(false)
  for (const text of ['', '{"value":"{{quote}}"}']) expect(materialize({ ...config(), body: { kind: 'json', text } }, new Map([['quote', 'synthetic"quote']]))).toMatchObject({ ok: false, error: { field: 'body.text' } })
  for (const method of ['GET', 'HEAD'] as const) expect(materialize({ ...config(), method, body: { kind: 'raw', text: '', mediaType: 'text/plain' } }, new Map())).toMatchObject({ ok: false, error: { field: 'body' } })
})
it('rejects managed/duplicate headers, auth conflicts and invalid wire characters while ignoring disabled rows', () => {
  for (const name of ['Host', 'content-length', 'Transfer-Encoding', 'Connection', 'Accept-Encoding']) expect(materialize({ ...config(), headerRows: [row(1, name, 'x')] }, new Map())).toMatchObject({ ok: false, error: { code: 'INVALID_HEADER' } })
  for (const headers of [[row(1, 'Content-Type', 'application/json'), row(2, 'content-type', 'text/plain')], [row(1, 'Authorization', 'a'), row(2, 'AUTHORIZATION', 'b')], [row(1, 'Bad name', 'x')], [row(1, 'X-Test', '\r\nsynthetic')]]) expect(materialize({ ...config(), headerRows: headers }, new Map())).toMatchObject({ ok: false, error: { code: 'INVALID_HEADER' } })
  expect(materialize({ ...config(), headerRows: [row(1, '{{bad-key}}', '{{missing}}', false), row(2, 'Authorization', 'synthetic')], auth: { mode: 'bearer', tokenTemplate: 'synthetic' } }, new Map())).toMatchObject({ ok: false, error: { code: 'AUTH_CONFLICT', field: 'auth' } })
  expect(materialize({ ...config(), headerRows: [row(1, 'Authorization', 'synthetic'), row(2, 'X-Repeat', 'a'), row(3, 'X-Repeat', 'b')] }, new Map())).toMatchObject({ ok: true })
})
it('enforces JSON Content-Type, accepts +json and raw overrides, and rejects invalid URLs/multipart serialization', () => {
  const body = { kind: 'json' as const, text: '{}' }
  expect(materialize({ ...config(), body, headerRows: [row(1, 'Content-Type', 'text/plain')] }, new Map())).toMatchObject({ ok: false, error: { code: 'CONTENT_TYPE_CONFLICT' } })
  expect(materialize({ ...config(), body, headerRows: [row(1, 'Content-Type', 'application/problem+json; charset=utf-8')] }, new Map())).toMatchObject({ ok: true })
  expect(materialize({ ...config(), body: { kind: 'raw', text: 'value', mediaType: 'text/plain' }, headerRows: [row(1, 'Content-Type', 'application/xml')] }, new Map())).toMatchObject({ ok: true })
  for (const urlTemplate of ['/relative', 'http://user:pass@localhost/', 'http://localhost/#', 'http://localhost/\r\n']) expect(materialize({ ...config(), urlTemplate }, new Map())).toMatchObject({ ok: false, error: { code: 'INVALID_URL' } })
  expect(materialize({ ...config(), urlTemplate: 'file:///tmp/file' }, new Map())).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED_SCHEME' } })
  expect(materialize({ ...config(), body: { kind: 'multipart', rows: [] } }, new Map())).toMatchObject({ ok: false, error: { field: 'body' } })
})
it('returns field-specific missing/unavailable failures without consuming a snapshot or exposing values', () => {
  let accepted = 0
  const result = materialize({ ...config(), headerRows: [row(1, 'X-Test', '{{missing}}')] }, new Map())
  if (result.ok) accepted++
  expect(accepted).toBe(0); expect(result).toMatchObject({ ok: false, error: { code: 'VARIABLE_MISSING', field: 'headerRows[0].value' } })
  expect(materialize({ ...config(), auth: { mode: 'bearer', tokenTemplate: '{{fixture}}' } }, new Map([['fixture', null]]))).toMatchObject({ ok: false, error: { code: 'SECRET_UNAVAILABLE', field: 'auth.tokenTemplate' } })
})
it('bounds expansion before JSON parsing or byte allocation and retains literal nested-looking variable output', () => {
  const expanded = materialize({ ...config(), body: { kind: 'json', text: '"' + '{{large}}'.repeat(1100) + '"' } }, new Map([['large', 'x'.repeat(5000)]]))
  expect(expanded).toMatchObject({ ok: false, error: { code: 'VALIDATION', field: 'body.text' } })
  const literal = materialize({ ...config(), body: { kind: 'raw', text: '{{nested}}', mediaType: 'text/plain' } }, new Map([['nested', '{{missing}}']]))
  expect(literal.ok && literal.data.bodyBytes?.toString()).toBe('{{missing}}')
})
