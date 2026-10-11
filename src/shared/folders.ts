import { z } from 'zod'
import { folderDepths, folderSchema } from './api-library'
import { collectionSchema } from './entities'
import { nameSchema, uuidSchema } from './primitives'
import { resultSchema, type Result } from './results'

// Metadata only; validating the full graph also rejects foreign/orphan parents and collections.
export const folderSnapshotSchema = z.strictObject({ workspaceId: uuidSchema, collections: z.array(collectionSchema), folders: z.array(folderSchema) }).superRefine((data, ctx) => {
  const collections = new Set(data.collections.map(c => c.id))
  try {
    if (collections.size !== data.collections.length || data.collections.some(c => c.workspaceId !== data.workspaceId) || data.folders.some(f => !collections.has(f.collectionId))) throw new Error('Invalid owners')
    folderDepths(data.workspaceId, data.folders)
  } catch { ctx.addIssue({ code: 'custom', message: 'Invalid folder snapshot' }) }
})
export const folderResultSchema = resultSchema(folderSnapshotSchema)
export const folderInputs = {
  list: z.tuple([uuidSchema]),
  create: z.tuple([uuidSchema, uuidSchema, uuidSchema.nullable(), nameSchema]),
  rename: z.tuple([uuidSchema, uuidSchema, nameSchema]),
  move: z.tuple([uuidSchema, uuidSchema, uuidSchema, uuidSchema.nullable()]),
  delete: z.tuple([uuidSchema, uuidSchema])
}
export const FOLDER_CHANNELS = Object.freeze({ list: 'folders:list', create: 'folders:create', rename: 'folders:rename', move: 'folders:move', delete: 'folders:delete' })
export type FolderSnapshot = z.infer<typeof folderSnapshotSchema>
type Reply = Promise<Result<FolderSnapshot>>
export interface FolderApi {
  readonly list: (workspace: string) => Reply
  readonly create: (workspace: string, collection: string, parent: string | null, name: string) => Reply
  readonly rename: (workspace: string, id: string, name: string) => Reply
  readonly move: (workspace: string, id: string, collection: string, parent: string | null) => Reply
  readonly delete: (workspace: string, id: string) => Reply
}
