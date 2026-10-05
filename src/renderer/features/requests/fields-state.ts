import { copyBody } from './body-state'
import { authDraft, type AuthDraft, type AuthEditor } from '../../../shared/auth-editor'
import type { RequestDraft } from '../../../shared/requests'
import type { TextRow } from '../../../shared/request-config'
import { requestDraftSchema } from '../../../shared/requests'
import { formatFieldPath } from '../../../shared/primitives'

export type RowGroup = 'queryRows' | 'headerRows' | 'body.rows'
export function copyDraft(source: Omit<RequestDraft, 'body' | 'auth'> & { body?: RequestDraft['body'] | null; auth?: AuthDraft | AuthEditor | undefined }): RequestDraft {
  return { ...(source.auth ? { auth: authDraft(source.auth) } : {}), ...(source.body === undefined || source.body === null ? {} : { body: copyBody(source.body) }), name: source.name, method: source.method, urlTemplate: source.urlTemplate, queryRows: (source.queryRows ?? []).map(row => ({ ...row })), headerRows: (source.headerRows ?? []).map(row => ({ ...row })), timeoutMs: source.timeoutMs ?? 30000, followRedirects: source.followRedirects ?? false }
}
export function getRows(draft: RequestDraft | null, group: RowGroup): TextRow[] {
  return group === 'body.rows' ? draft?.body?.kind === 'urlencoded' ? draft.body.rows : [] : draft?.[group] ?? []
}
export function replaceRows(draft: RequestDraft, group: RowGroup, rows: TextRow[]): RequestDraft {
  return group === 'body.rows' ? draft.body?.kind === 'urlencoded' ? { ...draft, body: { ...draft.body, rows } } : draft : { ...draft, [group]: rows }
}
export function updateRow(draft: RequestDraft, group: RowGroup, id: string, patch: Partial<Pick<TextRow, 'key' | 'value' | 'enabled'>>): RequestDraft {
  return replaceRows(draft, group, getRows(draft, group).map(row => row.id === id ? { ...row, ...patch } : row))
}
export function removeRow(draft: RequestDraft, group: RowGroup, id: string): RequestDraft { return replaceRows(draft, group, getRows(draft, group).filter(row => row.id !== id)) }
export function fieldErrors(draft: RequestDraft): Record<string, string> {
  const result = requestDraftSchema.safeParse(draft), errors: Record<string, string> = {}
  if (result.success) return errors
  for (const issue of result.error.issues) {
    const path = formatFieldPath(issue.path)
    if (!path) continue
    errors[path] = path === 'body' ? 'GET and HEAD cannot have a body. Select None or change the method.' : path === 'body.text' ? 'Body must be at most 5 MiB of UTF-8 text.' : path === 'body.mediaType' ? 'Enter a valid media type, such as text/plain.' : path === 'timeoutMs' ? 'Timeout must be an integer from 100 to 300,000 ms.' : path === 'name' ? 'Name must contain 1–100 characters after trimming.' : path.endsWith('.key') || path.endsWith('.value') || path === 'urlTemplate' ? 'Use at most 10,000 characters.' : path === 'queryRows' || path === 'headerRows' || path === 'body.rows' ? 'Use at most 200 rows with distinct row IDs.' : 'Invalid field value.'
  }
  return errors
}
export function moveRow(draft: RequestDraft, group: RowGroup, id: string, direction: -1 | 1): RequestDraft {
  const rows = [...getRows(draft, group)], index = rows.findIndex(row => row.id === id), target = index + direction
  if (index < 0 || target < 0 || target >= rows.length) return draft
  const row = rows[index]
  if (!row) return draft
  rows.splice(index, 1); rows.splice(target, 0, row)
  return replaceRows(draft, group, rows)
}
