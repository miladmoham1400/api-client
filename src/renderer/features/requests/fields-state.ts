import type { RequestDraft } from '../../../shared/requests'
import type { TextRow } from '../../../shared/request-config'
import { requestDraftSchema } from '../../../shared/requests'
import { formatFieldPath } from '../../../shared/primitives'

export type RowGroup = 'queryRows' | 'headerRows'
export function copyDraft(source: RequestDraft): RequestDraft {
  return { name: source.name, method: source.method, urlTemplate: source.urlTemplate, queryRows: (source.queryRows ?? []).map(row => ({ ...row })), headerRows: (source.headerRows ?? []).map(row => ({ ...row })), timeoutMs: source.timeoutMs ?? 30000, followRedirects: source.followRedirects ?? false }
}
export function updateRow(draft: RequestDraft, group: RowGroup, id: string, patch: Partial<Pick<TextRow, 'key' | 'value' | 'enabled'>>): RequestDraft {
  return { ...draft, [group]: (draft[group] ?? []).map(row => row.id === id ? { ...row, ...patch } : row) }
}
export function removeRow(draft: RequestDraft, group: RowGroup, id: string): RequestDraft { return { ...draft, [group]: (draft[group] ?? []).filter(row => row.id !== id) } }
export function fieldErrors(draft: RequestDraft): Record<string, string> {
  const result = requestDraftSchema.safeParse(draft), errors: Record<string, string> = {}
  if (result.success) return errors
  for (const issue of result.error.issues) {
    const path = formatFieldPath(issue.path)
    if (!path) continue
    errors[path] = path === 'timeoutMs' ? 'Timeout must be an integer from 100 to 300,000 ms.' : path === 'name' ? 'Name must contain 1–100 characters after trimming.' : path.endsWith('.key') || path.endsWith('.value') || path === 'urlTemplate' ? 'Use at most 10,000 characters.' : path === 'queryRows' || path === 'headerRows' ? 'Use at most 200 rows with distinct row IDs.' : 'Invalid field value.'
  }
  return errors
}
export function moveRow(draft: RequestDraft, group: RowGroup, id: string, direction: -1 | 1): RequestDraft {
  const rows = [...(draft[group] ?? [])], index = rows.findIndex(row => row.id === id), target = index + direction
  if (index < 0 || target < 0 || target >= rows.length) return draft
  const row = rows[index]
  if (!row) return draft
  rows.splice(index, 1); rows.splice(target, 0, row)
  return { ...draft, [group]: rows }
}
