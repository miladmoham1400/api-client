import { expect, it } from 'vitest'
import { formatJsonBody } from '../../src/renderer/features/requests/json-format'
import { requestDraftSchema } from '../../src/shared/requests'
it('formats JSON lexically without rounding numbers or substituting templates', () => {
  const source = '{"large":9007199254740993,"raw":{{ count }},"url":"{{base_url}}","text":"سلام"}'
  const result = formatJsonBody(source)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.text).toContain('9007199254740993')
  expect(result.text).toContain('"raw": {{ count }}')
  expect(result.text).toContain('"url": "{{base_url}}"')
  expect(formatJsonBody(result.text)).toEqual(result)
})
it.each(['{"a":1 "b":2}', "{'a':1}", '{"a":"missing}', '{"a":1,}', ''])('reports useful JSON positions without inventing a repair: %s', source => {
  const result = formatJsonBody(source)
  expect(result.ok).toBe(false)
  if (!result.ok) { expect(result.line).toBeGreaterThan(0); expect(result.column).toBeGreaterThan(0); expect(result.message.length).toBeGreaterThan(5) }
})
it('rejects unknown/duplicate variants and a GET hiding a selected body', () => {
  const id = '00000000-0000-4000-8000-000000000001', body = { kind: 'json', text: '{}' }
  const draft = { name: 'Variant', method: 'POST', urlTemplate: '', body, bodyVariants: [{ id, name: 'One', body }], selectedBodyVariantId: id }
  expect(requestDraftSchema.safeParse(draft).success).toBe(true)
  expect(requestDraftSchema.safeParse({ ...draft, selectedBodyVariantId: '00000000-0000-4000-8000-000000000002' }).success).toBe(false)
  expect(requestDraftSchema.safeParse({ ...draft, bodyVariants: [draft.bodyVariants[0], draft.bodyVariants[0]] }).success).toBe(false)
  expect(requestDraftSchema.safeParse({ ...draft, method: 'GET', body: { kind: 'none' } }).success).toBe(false)
})
