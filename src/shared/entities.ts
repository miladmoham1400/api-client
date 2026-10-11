import { z } from 'zod'
import { LIMITS, limitedText, nameSchema, timestampSchema, uniqueIds, uuidSchema, variableKeySchema } from './primitives'
import { runtimeRequestConfigSchema, storedRequestConfigSchema } from './request-config'

const identity = { id: uuidSchema, name: nameSchema, createdAt: timestampSchema, updatedAt: timestampSchema }
export const workspaceSchema = z.strictObject(identity)
export const collectionSchema = z.strictObject({ ...identity, workspaceId: uuidSchema, sortOrder: z.number().int().nonnegative() })
export const environmentSchema = z.strictObject({ ...identity, workspaceId: uuidSchema })
export const requestSummarySchema = z.strictObject({ ...identity, workspaceId: uuidSchema, collectionId: uuidSchema.nullable(), folderId: uuidSchema.nullable() }).refine(r => r.folderId === null || r.collectionId !== null, { path: ['folderId'], message: 'Folder requires a collection' })
export const runtimeRequestSchema = requestSummarySchema.safeExtend({ config: runtimeRequestConfigSchema })
export const storedRequestSchema = requestSummarySchema.safeExtend({ config: storedRequestConfigSchema })
export const requestInputSchema = z.strictObject({ name: nameSchema, collectionId: uuidSchema.nullable(), config: runtimeRequestConfigSchema })
export const workspaceStateSchema = z.strictObject({ workspaceId: uuidSchema, activeEnvironmentId: uuidSchema.nullable(), selectedRequestId: uuidSchema.nullable() })
export const themeSchema = z.enum(['light', 'dark'])
export const closeDecisionSchema = z.enum(['save', 'discard', 'cancel'])
export const appSettingsSchema = z.strictObject({ theme: themeSchema, lastWorkspaceId: uuidSchema.nullable() })
export const secretStorageModeSchema = z.enum(['secure', 'session'])

const variableIdentity = {
  id: uuidSchema, workspaceId: uuidSchema, environmentId: uuidSchema.nullable(),
  key: variableKeySchema, createdAt: timestampSchema, updatedAt: timestampSchema
}
export const storedVariableSchema = z.discriminatedUnion('isSensitive', [
  z.strictObject({ ...variableIdentity, isSensitive: z.literal(false), plainValue: limitedText(), secretId: z.null() }),
  z.strictObject({ ...variableIdentity, isSensitive: z.literal(true), plainValue: z.null(), secretId: uuidSchema })
])
export const variableListItemSchema = z.discriminatedUnion('isSensitive', [
  z.strictObject({ ...variableIdentity, isSensitive: z.literal(false), value: limitedText() }),
  z.strictObject({ ...variableIdentity, isSensitive: z.literal(true), hasValue: z.boolean(), maskedDisplay: z.literal('••••••••'), storageMode: secretStorageModeSchema })
])
export const variableInputSchema = z.strictObject({
  environmentId: uuidSchema.nullable(), key: variableKeySchema, value: limitedText(), isSensitive: z.boolean()
})
export const variableScopeSchema = z.strictObject({ workspaceId: uuidSchema, environmentId: uuidSchema.nullable() })
export const variableScopeEntriesSchema = uniqueIds(variableListItemSchema, LIMITS.variablesPerScope).superRefine((variables, ctx) => {
  const keys = new Set<string>()
  const first = variables[0]
  variables.forEach((variable, index) => {
    if (first && (variable.workspaceId !== first.workspaceId || variable.environmentId !== first.environmentId)) {
      ctx.addIssue({ code: 'custom', message: 'Variables must share one scope', path: [index, 'environmentId'] })
    }
    if (keys.has(variable.key)) ctx.addIssue({ code: 'custom', message: 'Duplicate variable key', path: [index, 'key'] })
    keys.add(variable.key)
  })
})
export const uploadCapabilitySchema = z.strictObject({ fileId: uuidSchema, name: limitedText(), size: z.number().int().nonnegative().max(LIMITS.fileBytes) })
export type Workspace = z.infer<typeof workspaceSchema>
export type Collection = z.infer<typeof collectionSchema>
export type Environment = z.infer<typeof environmentSchema>
export type RequestSummary = z.infer<typeof requestSummarySchema>
export type RuntimeRequest = z.infer<typeof runtimeRequestSchema>
export type StoredRequest = z.infer<typeof storedRequestSchema>
export type RequestInput = z.infer<typeof requestInputSchema>
export type StoredVariable = z.infer<typeof storedVariableSchema>
export type VariableListItem = z.infer<typeof variableListItemSchema>
export type VariableInput = z.infer<typeof variableInputSchema>
export type WorkspaceState = z.infer<typeof workspaceStateSchema>
export type Theme = z.infer<typeof themeSchema>
export type UploadCapability = z.infer<typeof uploadCapabilitySchema>
