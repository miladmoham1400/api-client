import { expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { copyDraft, updateRow, removeRow, moveRow, fieldErrors } from '../../src/renderer/features/requests/fields-state'
import { requestDraftSchema, requestInputs } from '../../src/shared/requests'
import { validationError } from '../../src/shared/results'

it('editing/removing/toggling/reordering stable IDs preserves duplicates, values and independent saved state', () => {
  const a = { id: randomUUID(), key: 'key', value: 'one', enabled: true }, b = { id: randomUUID(), key: 'key', value: '', enabled: false }
  const saved = { name: 'Saved', method: 'GET' as const, urlTemplate: '', queryRows: [a, b] }
  let draft = copyDraft(saved)
  draft = updateRow(draft, 'queryRows', b.id, { enabled: true, value: 'two' })
  expect(saved.queryRows).toEqual([a, b]); expect(draft.queryRows?.map(row => row.id)).toEqual([a.id, b.id])
  draft = moveRow(draft, 'queryRows', b.id, -1)
  expect(draft.queryRows?.map(row => row.key)).toEqual(['key', 'key']); expect(draft.queryRows?.map(row => row.id)).toEqual([b.id, a.id])
  draft = removeRow(draft, 'queryRows', a.id)
  expect(draft.queryRows).toEqual([{ ...b, enabled: true, value: 'two' }]); expect(saved.queryRows).toEqual([a, b])
  expect(moveRow(draft, 'queryRows', b.id, -1)).toBe(draft)
})
it('timeout boundaries, row limits/identity, disabled values and sanitized field paths are validated', () => {
  const draft = copyDraft({ name: 'Saved', method: 'GET', urlTemplate: '' })
  for (const timeoutMs of [100, 300000]) expect(requestDraftSchema.safeParse({ ...draft, timeoutMs }).success).toBe(true)
  for (const timeoutMs of [99, 300001, 1.5, NaN]) expect(fieldErrors({ ...draft, timeoutMs }).timeoutMs).toContain('100')
  const row = { id: randomUUID(), key: 'duplicate', value: '', enabled: false }
  expect(requestDraftSchema.safeParse({ ...draft, queryRows: [row, { ...row, id: randomUUID() }] }).success).toBe(true)
  expect(requestDraftSchema.safeParse({ ...draft, queryRows: [row, row] }).success).toBe(false)
  expect(requestDraftSchema.safeParse({ ...draft, headerRows: Array.from({ length: 201 }, () => ({ ...row, id: randomUUID() })) }).success).toBe(false)
  const invalid = { ...draft, headerRows: [{ ...row, value: 'x'.repeat(10001) }] }
  expect(fieldErrors(invalid)['headerRows[0].value']).toBe('Use at most 10,000 characters.')
  const parsed = requestInputs.save.safeParse([randomUUID(), randomUUID(), invalid])
  if (parsed.success) throw new Error('Expected rejection')
  expect(validationError(parsed.error, true)).toEqual({ code: 'VALIDATION', message: 'Invalid input', retryable: false, field: 'headerRows[0].value' })
})
