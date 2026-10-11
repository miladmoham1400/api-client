import { z } from 'zod'
import { folderSnapshotSchema } from './folders'
import { libraryRequestMetadataSchema, workspaceTreeStateSchema, treeExpansionSchema } from './api-library'
import { resultSchema, type Result } from './results'
import { uuidSchema } from './primitives'
export const librarySnapshotSchema = folderSnapshotSchema.safeExtend({ requests: z.array(libraryRequestMetadataSchema), treeState: workspaceTreeStateSchema }).superRefine((data, ctx) => {
  const collections = new Set(data.collections.map(c => c.id)), folders = new Map(data.folders.map(f => [f.id,f.collectionId]))
  const allIds=[...data.collections,...data.folders,...data.requests].map(item => item.id)
  if(new Set(allIds).size!==allIds.length) ctx.addIssue({code:'custom',message:'Duplicate library identity'})
  if (new Set(data.requests.map(r => r.id)).size !== data.requests.length || data.requests.some(r => r.workspaceId !== data.workspaceId || (r.destination.collectionId !== null && !collections.has(r.destination.collectionId)) || (r.destination.folderId !== null && folders.get(r.destination.folderId) !== r.destination.collectionId)) || data.treeState.workspaceId !== data.workspaceId || data.treeState.expandedCollectionIds.some(id => !collections.has(id)) || data.treeState.expandedFolderIds.some(id => !folders.has(id))) ctx.addIssue({code:'custom',message:'Invalid library snapshot'})
})
export const libraryResultSchema = resultSchema(librarySnapshotSchema)
export const treeStateResultSchema = resultSchema(workspaceTreeStateSchema)
export const LIBRARY_CHANNELS = Object.freeze({list:'library:list',setExpansion:'library:set-expansion'})
export const libraryInputs = {list:z.tuple([uuidSchema]),setExpansion:z.tuple([uuidSchema,treeExpansionSchema])}
export type LibrarySnapshot = z.infer<typeof librarySnapshotSchema>
export interface LibraryApi {
  readonly list: (workspace:string) => Promise<Result<LibrarySnapshot>>
  readonly setExpansion: (workspace:string,input:z.infer<typeof treeExpansionSchema>) => Promise<Result<z.infer<typeof workspaceTreeStateSchema>>>
}
