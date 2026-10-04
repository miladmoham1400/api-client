import type { EditableBody } from '../../../shared/requests'
export type BodyDrafts = { json: Extract<EditableBody, { kind: 'json' }>; raw: Extract<EditableBody, { kind: 'raw' }> }
export function initialBodyDrafts(body?: EditableBody): BodyDrafts {
  return { json: body?.kind === 'json' ? { ...body } : { kind: 'json', text: '' }, raw: body?.kind === 'raw' ? { ...body } : { kind: 'raw', text: '', mediaType: 'text/plain' } }
}
export function switchBody(cache: BodyDrafts, active: EditableBody | undefined, kind: EditableBody['kind']): { cache: BodyDrafts; body: EditableBody } {
  const next = { ...cache, ...(active && active.kind !== 'none' ? { [active.kind]: { ...active } } : {}) }
  return { cache: next, body: kind === 'none' ? { kind: 'none' } : { ...next[kind] } }
}
