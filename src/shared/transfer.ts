import { z } from 'zod'
import { LIMITS, limitedText, nameSchema, timestampSchema, uniqueIds, uuidSchema, variableKeySchema } from './primitives'
import { LIBRARY_LIMITS } from './api-library'
import { exportRequestConfigSchema } from './request-config'

export const exportCollectionSchema = z.strictObject({ id: uuidSchema, name: nameSchema, sortOrder: z.number().int().nonnegative() })
export const exportEnvironmentSchema = z.strictObject({ id: uuidSchema, name: nameSchema })
const variableFields = { id: uuidSchema, environmentId: uuidSchema.nullable(), key: variableKeySchema }
export const exportVariableSchema = z.discriminatedUnion('isSensitive', [
  z.strictObject({ ...variableFields, isSensitive: z.literal(false), value: limitedText(), requiresValue: z.literal(false) }),
  z.strictObject({ ...variableFields, isSensitive: z.literal(true), requiresValue: z.literal(true) })
])
export const exportRequestSchema = z.strictObject({ id: uuidSchema, collectionId: uuidSchema.nullable(), name: nameSchema, config: exportRequestConfigSchema })
export const exportWorkspaceSchema = z.strictObject({
  id: uuidSchema, name: nameSchema,
  collections: uniqueIds(exportCollectionSchema, LIMITS.collections),
  environments: uniqueIds(exportEnvironmentSchema, LIMITS.environments),
  variables: z.array(exportVariableSchema).max((LIMITS.environments + 1) * LIMITS.variablesPerScope),
  requests: uniqueIds(exportRequestSchema, LIMITS.requests)
}).superRefine((workspace, ctx) => {
  const ids = new Set<string>([workspace.id])
  const collections = new Set(workspace.collections.map(item => item.id))
  const environments = new Set(workspace.environments.map(item => item.id))
  for (const group of ['collections', 'environments', 'variables', 'requests'] as const) {
    workspace[group].forEach((item, index) => {
      if (ids.has(item.id)) ctx.addIssue({ code: 'custom', message: 'Duplicate source ID', path: [group, index, 'id'] })
      ids.add(item.id)
    })
  }
  const scopeKeys = new Map<string | null, Set<string>>()
  workspace.variables.forEach((variable, index) => {
    if (variable.environmentId !== null && !environments.has(variable.environmentId)) {
      ctx.addIssue({ code: 'custom', message: 'Unknown environment', path: ['variables', index, 'environmentId'] })
    }
    const keys = scopeKeys.get(variable.environmentId) ?? new Set<string>()
    if (keys.has(variable.key)) ctx.addIssue({ code: 'custom', message: 'Duplicate variable key', path: ['variables', index, 'key'] })
    keys.add(variable.key)
    scopeKeys.set(variable.environmentId, keys)
  })
  // Count entries (not unique keys) so duplicates cannot hide a scope overflow.
  const counts = new Map<string | null, number>()
  workspace.variables.forEach((variable, index) => {
    const count = (counts.get(variable.environmentId) ?? 0) + 1
    counts.set(variable.environmentId, count)
    if (count > LIMITS.variablesPerScope) ctx.addIssue({ code: 'custom', message: 'Variable scope exceeds limit', path: ['variables', index] })
  })
  workspace.requests.forEach((request, index) => {
    if (request.collectionId !== null && !collections.has(request.collectionId)) {
      ctx.addIssue({ code: 'custom', message: 'Unknown collection', path: ['requests', index, 'collectionId'] })
    }
  })
})
export const workspaceExportV1Schema = z.strictObject({
  format: z.literal('offline-api-client-workspace'), version: z.literal(1),
  exportedAt: timestampSchema, workspace: exportWorkspaceSchema
})
export const exportFolderSchema = z.strictObject({
  id: uuidSchema, collectionId: uuidSchema, parentFolderId: uuidSchema.nullable(),
  name: nameSchema, sortOrder: z.number().int().nonnegative()
})
export type ExportFolder = z.infer<typeof exportFolderSchema>
/** Bound every walk independently of source order; no recursive traversal of untrusted input. */
export function exportFolderDepths(input: readonly ExportFolder[]): Map<string, number> {
  const folders = new Map(input.map(folder => [folder.id, folder])), depths = new Map<string, number>()
  if (folders.size !== input.length) throw new Error('Duplicate folder ID')
  for (const folder of input) {
    let current: ExportFolder | undefined = folder
    const seen = new Set<string>()
    while (current) {
      if (seen.has(current.id) || seen.size >= LIBRARY_LIMITS.folderDepth) throw new Error('Invalid folder hierarchy')
      seen.add(current.id)
      if (current.parentFolderId === null) break
      const parent: ExportFolder | undefined = folders.get(current.parentFolderId)
      if (!parent || parent.collectionId !== folder.collectionId) throw new Error('Invalid folder hierarchy')
      current = parent
    }
    depths.set(folder.id, seen.size)
  }
  return depths
}
export const exportWorkspaceV2Schema = exportWorkspaceSchema.safeExtend({
  folders: uniqueIds(exportFolderSchema, LIBRARY_LIMITS.foldersPerWorkspace),
  requests: uniqueIds(exportRequestSchema.extend({ folderId: uuidSchema.nullable() }), LIMITS.requests)
}).superRefine((workspace, ctx) => {
  const ids = new Set([workspace.id, ...workspace.collections.map(c => c.id), ...workspace.environments.map(e => e.id),
    ...workspace.variables.map(v => v.id), ...workspace.requests.map(r => r.id)])
  const collections = new Set(workspace.collections.map(c => c.id)), folders = new Map(workspace.folders.map(f => [f.id, f]))
  workspace.folders.forEach((folder, index) => {
    if (ids.has(folder.id)) ctx.addIssue({ code: 'custom', message: 'Duplicate source ID', path: ['folders', index, 'id'] })
    ids.add(folder.id)
    if (!collections.has(folder.collectionId)) ctx.addIssue({ code: 'custom', message: 'Unknown collection', path: ['folders', index, 'collectionId'] })
  })
  try { exportFolderDepths(workspace.folders) }
  catch { ctx.addIssue({ code: 'custom', message: 'Invalid folder hierarchy', path: ['folders'] }) }
  workspace.requests.forEach((request, index) => {
    if (request.folderId !== null && (request.collectionId === null || folders.get(request.folderId)?.collectionId !== request.collectionId)) {
      ctx.addIssue({ code: 'custom', message: 'Invalid request destination', path: ['requests', index, 'folderId'] })
    }
  })
})
export const workspaceExportV2Schema = workspaceExportV1Schema.extend({ version: z.literal(2), workspace: exportWorkspaceV2Schema })
export const workspaceExportSchema = z.discriminatedUnion('version', [workspaceExportV1Schema, workspaceExportV2Schema])
export type WorkspaceExport = z.infer<typeof workspaceExportSchema>
export type WorkspaceExportV2 = z.infer<typeof workspaceExportV2Schema>
export type ExportVariable = z.infer<typeof exportVariableSchema>
