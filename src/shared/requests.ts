import { z } from 'zod'
import { requestSummarySchema } from './entities'
import { httpMethodSchema, limitedText, nameSchema, uuidSchema } from './primitives'
import { resultSchema, type Result } from './results'

export const requestDraftSchema = z.strictObject({ name: nameSchema, method: httpMethodSchema, urlTemplate: limitedText() })
export const requestCreateSchema = requestDraftSchema.extend({ collectionId: uuidSchema.nullable() })
export const requestEditorSchema = requestSummarySchema.extend({ method: httpMethodSchema, urlTemplate: limitedText() })
export const requestSnapshotSchema = z.strictObject({ workspaceId: uuidSchema, requests: z.array(requestSummarySchema), editor: requestEditorSchema.nullable() }).superRefine((data, ctx) => {
  const ids = new Set(data.requests.map(item => item.id))
  if (ids.size !== data.requests.length || data.requests.some(item => item.workspaceId !== data.workspaceId) || (data.editor && (data.editor.workspaceId !== data.workspaceId || !ids.has(data.editor.id)))) ctx.addIssue({ code: 'custom', message: 'Invalid request snapshot' })
})
export const requestResultSchema = resultSchema(requestSnapshotSchema)
export const requestInputs = {
  list: z.tuple([uuidSchema]), get: z.tuple([uuidSchema, uuidSchema]), create: z.tuple([uuidSchema, requestCreateSchema]),
  save: z.tuple([uuidSchema, uuidSchema, requestDraftSchema]), duplicate: z.tuple([uuidSchema, uuidSchema]), delete: z.tuple([uuidSchema, uuidSchema])
}
export const REQUEST_CHANNELS = Object.freeze({ list: 'requests:list', get: 'requests:get', create: 'requests:create', save: 'requests:save', duplicate: 'requests:duplicate', delete: 'requests:delete' })
export type RequestDraft = z.infer<typeof requestDraftSchema>
export type RequestSnapshot = z.infer<typeof requestSnapshotSchema>
type Reply = Promise<Result<RequestSnapshot>>
export interface RequestPersistenceApi {
  readonly list: (workspace: string) => Reply
  readonly get: (workspace: string, id: string) => Reply
  readonly create: (workspace: string, input: z.infer<typeof requestCreateSchema>) => Reply
  readonly save: (workspace: string, id: string, input: RequestDraft) => Reply
  readonly duplicate: (workspace: string, id: string) => Reply
  readonly delete: (workspace: string, id: string) => Reply
}
