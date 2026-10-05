import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { materialize } from '../../src/main/http/materialize'
import { executeSingleHop } from '../../src/main/http/transport'
import { createDefaultRequestConfig, type TextRow } from '../../src/shared/request-config'
import { startFixture } from '../fixtures/http'

const row = (key: string, value: string, enabled = true): TextRow => ({ id: randomUUID(), key, value, enabled })
const config = (rows: TextRow[]) => ({ ...createDefaultRequestConfig(), method: 'POST' as const, urlTemplate: 'http://127.0.0.1/echo', body: { kind: 'urlencoded' as const, rows } })

it('resolves enabled keys/values only, encodes once and captures independent immutable form bytes', () => {
  const source = config([row('empty', ''), row('{{key}}', '%2F'), row('{{key}}', '{{value}}'), row('{{missing}}', '{{missing}}', false), row('', '')])
  const result = materialize(source, new Map([['key', 'repeat'], ['value', 'سلام 🌍 + & =']]))
  if (!result.ok) throw new Error('Missing form snapshot')
  const expected = 'empty=&repeat=%252F&repeat=%D8%B3%D9%84%D8%A7%D9%85+%F0%9F%8C%8D+%2B+%26+%3D&='
  expect(result.data.bodyBytes?.toString()).toBe(expected)
  expect(result.data.headers).toContainEqual({ name: 'Content-Length', value: String(Buffer.byteLength(expected)) })
  expect(result.data.headers).toContainEqual({ name: 'Content-Type', value: 'application/x-www-form-urlencoded' })
  result.data.bodyBytes?.fill(0); source.body.rows[0]!.value = 'edited'
  expect(result.data.bodyBytes?.toString()).toBe(expected)
})
it('reports enabled missing/unavailable variables at their original row path', () => {
  for (const field of ['key', 'value'] as const) {
    const rows = [row('{{ignored}}', '{{ignored}}', false), row(field === 'key' ? '{{missing}}' : 'key', field === 'value' ? '{{missing}}' : '')]
    expect(materialize(config(rows), new Map())).toMatchObject({ ok: false, error: { code: 'VARIABLE_MISSING', field: `body.rows[1].${field}` } })
    expect(materialize(config(rows), new Map([['missing', null]]))).toMatchObject({ ok: false, error: { code: 'SECRET_UNAVAILABLE', field: `body.rows[1].${field}` } })
  }
})
it('enforces form Content-Type, optional charset, duplicate singletons and managed length', () => {
  const c = config([row('key', 'value')])
  for (const type of ['application/x-www-form-urlencoded', 'Application/X-WWW-Form-Urlencoded; CHARSET="utf-8"']) {
    const result = materialize({ ...c, headerRows: [row('content-type', type)] }, new Map())
    expect(result.ok && result.data.headers.filter(h => h.name.toLowerCase() === 'content-type')).toEqual([{ name: 'content-type', value: type }])
  }
  for (const type of ['application/json', 'text/plain', 'application/x-www-form-urlencoded; boundary=invalid', 'application/x-www-form-urlencoded; charset=utf-8; charset=utf-8']) expect(materialize({ ...c, headerRows: [row('Content-Type', type)] }, new Map())).toMatchObject({ ok: false, error: { code: 'CONTENT_TYPE_CONFLICT' } })
  expect(materialize({ ...c, headerRows: [row('Content-Type', 'application/x-www-form-urlencoded'), row('content-type', 'application/x-www-form-urlencoded')] }, new Map())).toMatchObject({ ok: false, error: { code: 'INVALID_HEADER' } })
  expect(materialize({ ...c, headerRows: [row('Content-Length', '1')] }, new Map())).toMatchObject({ ok: false, error: { code: 'INVALID_HEADER' } })
  expect(materialize({ ...c, headerRows: [row('Content-Type', '{{missing}}', false)] }, new Map())).toMatchObject({ ok: true })
})
it('distinguishes an empty form from None, rejects GET/HEAD forms and bounds resolved row fields', () => {
  for (const rows of [[], [row('{{missing}}', '{{missing}}', false)]]) {
    const result = materialize(config(rows), new Map())
    expect(result.ok && result.data.bodyBytes?.length).toBe(0)
    expect(result.ok && result.data.headers).toContainEqual({ name: 'Content-Length', value: '0' })
  }
  for (const method of ['GET', 'HEAD'] as const) expect(materialize({ ...config([]), method }, new Map())).toMatchObject({ ok: false, error: { field: 'body' } })
  expect(materialize(config([row('key', '{{large}}')]), new Map([['large', 'x'.repeat(10001)]]))).toMatchObject({ ok: false, error: { field: 'body.rows[0].value' } })
  expect(materialize(config([row('{{large}}', '')]), new Map([['large', 'x'.repeat(40001)]]))).toMatchObject({ ok: false, error: { field: 'body.rows[0].key' } })
})
it('delivers exact form bytes, duplicate ordering, Unicode and literal percent values over native HTTP', async () => {
  const fixture = await startFixture()
  try {
    const c = { ...config([row('same', ''), row('same', '%2F'), row('سلام', '🌍 + %'), row('{{missing}}', '', false)]), urlTemplate: fixture.url + '/echo' }
    const captured = materialize(c, new Map())
    if (!captured.ok) throw new Error('Missing fixture snapshot')
    const result = await executeSingleHop(captured.data, new AbortController().signal)
    if (!result.ok || result.data.body.kind !== 'text') throw new Error('Missing echo')
    const expected = 'same=&same=%252F&%D8%B3%D9%84%D8%A7%D9%85=%F0%9F%8C%8D+%2B+%25'
    expect(JSON.parse(result.data.body.text)).toMatchObject({ method: 'POST', bodyBase64: Buffer.from(expected).toString('base64'), bodyLength: Buffer.byteLength(expected), rawHeaders: expect.arrayContaining(['Content-Type', 'application/x-www-form-urlencoded', 'Content-Length', String(Buffer.byteLength(expected))]) })
    expect([...new URLSearchParams(expected)]).toEqual([['same', ''], ['same', '%2F'], ['سلام', '🌍 + %']])
  } finally { await fixture.close() }
})
