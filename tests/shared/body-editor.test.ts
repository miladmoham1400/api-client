import { expect, it } from 'vitest'
import { requestDraftSchema } from '../../src/shared/requests'
import { initialBodyDrafts, switchBody } from '../../src/renderer/features/requests/body-state'
import { LIMITS } from '../../src/shared/primitives'
const base = { name: 'Body', method: 'POST', urlTemplate: '' }
it('retains inactive source drafts without putting them in the active body', () => {
  const source = { kind: 'json' as const, text: ' {\n  "value": "{{value}}"\n}  ' }
  const raw = switchBody(initialBodyDrafts(source), source, 'raw')
  const edited = { kind: 'raw' as const, text: 'سلام 🌍\n', mediaType: 'text/plain' }
  const none = switchBody(raw.cache, edited, 'none')
  expect(none.body).toEqual({ kind: 'none' })
  const json = switchBody(none.cache, none.body, 'json')
  expect(json.body).toEqual(source)
  expect(switchBody(json.cache, json.body, 'raw').body).toEqual(edited)
  expect(requestDraftSchema.parse({ ...base, body: json.body }).body).toEqual(source)
})
it('distinguishes empty JSON from None and enforces UTF-8 size, method and media type without resolving templates', () => {
  expect(requestDraftSchema.parse({ ...base, body: { kind: 'json', text: '' } }).body).toEqual({ kind: 'json', text: '' })
  expect(requestDraftSchema.safeParse({ ...base, body: { kind: 'json', text: '{{json}}' } }).success).toBe(true)
  expect(requestDraftSchema.safeParse({ ...base, body: { kind: 'raw', text: 'x'.repeat(LIMITS.textBodyBytes), mediaType: 'text/plain' } }).success).toBe(true)
  const oversized = requestDraftSchema.safeParse({ ...base, body: { kind: 'json', text: 'س'.repeat(LIMITS.textBodyBytes / 2 + 1) } })
  expect(oversized.success).toBe(false)
  if (!oversized.success) expect(oversized.error.issues[0]?.path).toEqual(['body', 'text'])
  for (const method of ['GET', 'HEAD']) expect(requestDraftSchema.safeParse({ ...base, method, body: { kind: 'raw', text: '', mediaType: 'text/plain' } }).success).toBe(false)
  expect(requestDraftSchema.safeParse({ ...base, method: 'GET', body: { kind: 'none' } }).success).toBe(true)
  expect(requestDraftSchema.safeParse({ ...base, body: { kind: 'raw', text: '', mediaType: 'bad\r\nvalue' } }).success).toBe(false)
  expect(requestDraftSchema.safeParse({ ...base, body: { kind: 'none', text: 'inactive' } }).success).toBe(false)
})
it('retains form rows independently across body-mode switches and saved-draft copies', () => {
  const form = { kind: 'urlencoded' as const, rows: [{ id: '00000000-0000-4000-8000-000000000001', key: 'same', value: '', enabled: false }] }
  const cache = initialBodyDrafts(form)
  const raw = switchBody(cache, form, 'raw')
  const restored = switchBody(raw.cache, raw.body, 'urlencoded')
  expect(restored.body).toEqual(form)
  if (restored.body.kind !== 'urlencoded') throw new Error('Missing form')
  restored.body.rows[0]!.value = 'edited'
  expect(form.rows[0]?.value).toBe('')
  expect(cache.urlencoded.rows[0]?.value).toBe('')
  expect(requestDraftSchema.safeParse({ ...base, body: form }).success).toBe(true)
  expect(requestDraftSchema.safeParse({ ...base, body: { kind: 'multipart', rows: [] } }).success).toBe(false)
})
