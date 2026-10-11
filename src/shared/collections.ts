import { z } from 'zod'
import { collectionSchema, requestSummarySchema } from './entities'
import { nameSchema, uuidSchema } from './primitives'
import { resultSchema, type Result } from './results'

export const groupingSchema = z.strictObject({
  workspaceId: uuidSchema, collections: z.array(collectionSchema), requests: z.array(requestSummarySchema)
}).superRefine((data, ctx) => {
  const collections = new Set(data.collections.map(item => item.id))
  const requests = new Set(data.requests.map(item => item.id))
  if (collections.size !== data.collections.length || requests.size !== data.requests.length ||
      data.collections.some(item => item.workspaceId !== data.workspaceId) ||
      data.requests.some(item => item.workspaceId !== data.workspaceId || (item.collectionId !== null && !collections.has(item.collectionId)))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid workspace grouping' })
  }
})
export const groupingResultSchema = resultSchema(groupingSchema)
export const collectionInputs = {
  list: z.tuple([uuidSchema]), create: z.tuple([uuidSchema, nameSchema]),
  rename: z.tuple([uuidSchema, uuidSchema, nameSchema]), delete: z.tuple([uuidSchema, uuidSchema]),
  move: z.tuple([uuidSchema, uuidSchema, uuidSchema.nullable(), uuidSchema.nullable().optional().default(null)])
}
export const COLLECTION_CHANNELS = Object.freeze({ list: 'collections:list', create: 'collections:create', rename: 'collections:rename', delete: 'collections:delete', move: 'requests:move' })
export type Grouping = z.infer<typeof groupingSchema>
type Reply = Promise<Result<Grouping>>
export interface CollectionApi {
  readonly list: (workspaceId: string) => Reply
  readonly create: (workspaceId: string, name: string) => Reply
  readonly rename: (workspaceId: string, id: string, name: string) => Reply
  readonly delete: (workspaceId: string, id: string) => Reply
}
export interface RequestGroupingApi { readonly move: (workspaceId: string, id: string, collectionId: string | null, folderId?: string | null) => Reply }
