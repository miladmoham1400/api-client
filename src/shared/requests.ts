import { authDraftSchema, authEditorSchema } from './auth-editor'
import { z } from 'zod'
import { requestSummarySchema } from './entities'
import { httpMethodSchema, limitedText, nameSchema, uuidSchema, timeoutSchema, textBodySchema, mediaTypeSchema } from './primitives'
import { textRowsSchema, textRowSchema } from './request-config'
import { resultSchema, type Result } from './results'

export const editableBodySchema = z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('none') }), z.strictObject({ kind: z.literal('json'), text: textBodySchema }), z.strictObject({ kind: z.literal('raw'), text: textBodySchema, mediaType: mediaTypeSchema }), z.strictObject({ kind: z.literal('urlencoded'), rows: textRowsSchema })])
export type EditableBody = z.infer<typeof editableBodySchema>
const fields = { queryRows: textRowsSchema, headerRows: textRowsSchema, timeoutMs: timeoutSchema, followRedirects: z.boolean() }
export const requestDraftSchema = z.strictObject({ name: nameSchema, method: httpMethodSchema, urlTemplate: limitedText(), queryRows: fields.queryRows.optional(), headerRows: fields.headerRows.optional(), timeoutMs: fields.timeoutMs.optional(), followRedirects: fields.followRedirects.optional(), body: editableBodySchema.optional(), auth: authDraftSchema.optional() }).refine(data => !data.body || data.body.kind === 'none' || !['GET', 'HEAD'].includes(data.method), { path: ['body'], message: 'GET and HEAD cannot have a body' })
export const requestCreateSchema = requestDraftSchema.safeExtend({ collectionId: uuidSchema.nullable() })
export const requestEditorSchema = requestSummarySchema.extend({ method: httpMethodSchema, urlTemplate: limitedText(), ...fields, body: editableBodySchema.nullable(), auth: authEditorSchema, credentialStorage: z.enum(['secure', 'session']) })
export const requestSnapshotSchema = z.strictObject({ workspaceId: uuidSchema, requests: z.array(requestSummarySchema), editor: requestEditorSchema.nullable() }).superRefine((data, ctx) => {
  const ids = new Set(data.requests.map(item => item.id))
  if (ids.size !== data.requests.length || data.requests.some(item => item.workspaceId !== data.workspaceId) || (data.editor && (data.editor.workspaceId !== data.workspaceId || !ids.has(data.editor.id)))) ctx.addIssue({ code: 'custom', message: 'Invalid request snapshot' })
})
export const requestResultSchema = resultSchema(requestSnapshotSchema)
export const requestInputs = {
  newRow: z.tuple([uuidSchema]), list: z.tuple([uuidSchema]), get: z.tuple([uuidSchema, uuidSchema]), create: z.tuple([uuidSchema, requestCreateSchema]),
  save: z.tuple([uuidSchema, uuidSchema, requestDraftSchema]), duplicate: z.tuple([uuidSchema, uuidSchema]), delete: z.tuple([uuidSchema, uuidSchema])
}
export const REQUEST_CHANNELS = Object.freeze({ newRow: 'requests:new-row', list: 'requests:list', get: 'requests:get', create: 'requests:create', save: 'requests:save', duplicate: 'requests:duplicate', delete: 'requests:delete' })
export type RequestDraft = z.infer<typeof requestDraftSchema>
export type RequestSnapshot = z.infer<typeof requestSnapshotSchema>
type Reply = Promise<Result<RequestSnapshot>>
export const requestRowResultSchema = resultSchema(textRowSchema)
export interface RequestPersistenceApi {
  readonly newRow: (workspace: string) => Promise<Result<z.infer<typeof textRowSchema>>>
  readonly list: (workspace: string) => Reply
  readonly get: (workspace: string, id: string) => Reply
  readonly create: (workspace: string, input: z.infer<typeof requestCreateSchema>) => Reply
  readonly save: (workspace: string, id: string, input: RequestDraft) => Reply
  readonly duplicate: (workspace: string, id: string) => Reply
  readonly delete: (workspace: string, id: string) => Reply
}
