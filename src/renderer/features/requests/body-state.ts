import type { EditableBody } from '../../../shared/requests'
export type BodyDrafts = { json: Extract<EditableBody, { kind: 'json' }>; raw: Extract<EditableBody, { kind: 'raw' }>; multipart: Extract<EditableBody, { kind: 'multipart' }>; urlencoded: Extract<EditableBody, { kind: 'urlencoded' }> }
export function copyBody(body: EditableBody): EditableBody {
  if (body.kind === 'multipart') return { ...body, rows: body.rows.map(row => ({ ...row })) }
  if (body.kind === 'urlencoded') return { ...body, rows: body.rows.map(row => ({ ...row })) }
  return { ...body }
}
export function initialBodyDrafts(body?: EditableBody): BodyDrafts {
  return { multipart: body?.kind === 'multipart' ? { ...body, rows: body.rows.map(row => ({ ...row })) } : { kind: 'multipart', rows: [] }, json: body?.kind === 'json' ? { ...body } : { kind: 'json', text: '' }, raw: body?.kind === 'raw' ? { ...body } : { kind: 'raw', text: '', mediaType: 'text/plain' }, urlencoded: body?.kind === 'urlencoded' ? { ...body, rows: body.rows.map(row => ({ ...row })) } : { kind: 'urlencoded', rows: [] } }
}
export function switchBody(cache: BodyDrafts, active: EditableBody | undefined, kind: EditableBody['kind']): { cache: BodyDrafts; body: EditableBody } {
  const next = { ...cache, ...(active && active.kind !== 'none' ? { [active.kind]: copyBody(active) } : {}) }
  return { cache: next, body: kind === 'none' ? { kind: 'none' } : copyBody(next[kind]) }
}

/** Capability IDs are ephemeral selections, not saved edits. */
export function persistedBody(body: EditableBody): EditableBody {
  return body.kind !== 'multipart' ? copyBody(body) : { ...body, rows: body.rows.map(row => {
    if (row.kind !== 'file') return { ...row }
    return { id: row.id, key: row.key, kind: row.kind, enabled: row.enabled, ...(row.fileName === undefined ? {} : { fileName: row.fileName }), ...(row.fileSize === undefined ? {} : { fileSize: row.fileSize }) }
  }) }
}
export function retainSelections(saved: EditableBody | undefined, draft: EditableBody | undefined): EditableBody | undefined {
  if (saved?.kind !== 'multipart' || draft?.kind !== 'multipart') return saved
  return { ...saved, rows: saved.rows.map(row => {
    const old = draft.rows.find(item => item.id === row.id)
    return row.kind === 'file' && old?.kind === 'file' && old.fileId ? { ...row, fileId: old.fileId } : row
  }) }
}
