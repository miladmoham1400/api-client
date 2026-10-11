import { z } from 'zod'
import { httpMethodSchema, nameSchema, timestampSchema, uuidSchema } from './primitives'

export const LIBRARY_LIMITS = Object.freeze({ folderDepth: 16, foldersPerWorkspace: 1000, expandedCollections: 1000 })
export const requestDestinationSchema = z.strictObject({ collectionId: uuidSchema.nullable(), folderId: uuidSchema.nullable() })
  .refine(value => value.folderId === null || value.collectionId !== null, { path: ['folderId'], message: 'Folder requires a collection' })
export const libraryContainerSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('workspace'), collectionId: z.null(), folderId: z.null() }),
  z.strictObject({ kind: z.literal('collection'), collectionId: uuidSchema, folderId: z.null() }),
  z.strictObject({ kind: z.literal('folder'), collectionId: uuidSchema, folderId: uuidSchema })
])
export const folderSchema = z.strictObject({
  id: uuidSchema, workspaceId: uuidSchema, collectionId: uuidSchema, parentFolderId: uuidSchema.nullable(),
  name: nameSchema, sortOrder: z.number().int().nonnegative(), createdAt: timestampSchema, updatedAt: timestampSchema
}).refine(folder => folder.id !== folder.parentFolderId, { path: ['parentFolderId'], message: 'Invalid parent' })
export const libraryRequestMetadataSchema = z.strictObject({
  id: uuidSchema, workspaceId: uuidSchema, name: nameSchema, method: httpMethodSchema,
  destination: libraryContainerSchema, createdAt: timestampSchema, updatedAt: timestampSchema
})
const expansionIds = (limit: number) => z.array(uuidSchema).max(limit).refine(ids => new Set(ids).size === ids.length, 'Duplicate expansion IDs')
export const treeExpansionSchema = z.strictObject({
  expandedCollectionIds: expansionIds(LIBRARY_LIMITS.expandedCollections),
  expandedFolderIds: expansionIds(LIBRARY_LIMITS.foldersPerWorkspace)
})
export const workspaceTreeStateSchema = treeExpansionSchema.extend({ workspaceId: uuidSchema, version: z.literal(1) })
export type Folder = z.infer<typeof folderSchema>
export type RequestDestination = z.infer<typeof requestDestinationSchema>
export type LibraryContainer = z.infer<typeof libraryContainerSchema>
export type LibraryRequestMetadata = z.infer<typeof libraryRequestMetadataSchema>
export type WorkspaceTreeState = z.infer<typeof workspaceTreeStateSchema>

/** Bounded parent walks: reject corrupt ownership, missing parents, cycles and excessive depth. */
export function folderDepths(workspaceId: string, input: readonly Folder[]): Map<string, number> {
  uuidSchema.parse(workspaceId)
  const folders = new Map<string, Folder>()
  for (const value of input) {
    const folder = folderSchema.parse(value)
    if (folder.workspaceId !== workspaceId || folders.has(folder.id)) throw new Error('Invalid folder hierarchy')
    folders.set(folder.id, folder)
  }
  const depths = new Map<string, number>()
  for (const folder of folders.values()) {
    let current: Folder | undefined = folder
    const seen = new Set<string>()
    while (current) {
      if (seen.has(current.id) || seen.size >= LIBRARY_LIMITS.folderDepth) throw new Error('Invalid folder hierarchy')
      seen.add(current.id)
      if (current.parentFolderId === null) break
      const parent: Folder | undefined = folders.get(current.parentFolderId)
      if (!parent || parent.collectionId !== folder.collectionId) throw new Error('Invalid folder hierarchy')
      current = parent
    }
    depths.set(folder.id, seen.size)
  }
  return depths
}
