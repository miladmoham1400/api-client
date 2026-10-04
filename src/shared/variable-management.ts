import { z } from 'zod'
import { environmentSchema, variableListItemSchema } from './entities'
import { uuidSchema, nameSchema, variableKeySchema, limitedText } from './primitives'
import { resultSchema, revealedValueSchema, type Result } from './results'
export const environmentSnapshotSchema = z.strictObject({ workspaceId: uuidSchema, environments: z.array(environmentSchema), activeEnvironmentId: uuidSchema.nullable(), storageMode: z.enum(['secure', 'session']) }).superRefine((data, ctx) => {
  const ids = new Set(data.environments.map(e => e.id))
  if (ids.size !== data.environments.length || data.environments.some(e => e.workspaceId !== data.workspaceId) || (data.activeEnvironmentId !== null && !ids.has(data.activeEnvironmentId))) ctx.addIssue({ code: 'custom', message: 'Invalid environments' })
})
export const variableSnapshotSchema = z.strictObject({ workspaceId: uuidSchema, environmentId: uuidSchema.nullable(), items: z.array(variableListItemSchema), effective: z.array(variableListItemSchema) }).superRefine((data, ctx) => {
  const keys = new Set(data.items.map(v => v.key)), effectiveKeys = new Set(data.effective.map(v => v.key))
  if (keys.size !== data.items.length || effectiveKeys.size !== data.effective.length || data.items.some(v => v.workspaceId !== data.workspaceId || v.environmentId !== data.environmentId) || data.effective.some(v => v.workspaceId !== data.workspaceId)) ctx.addIssue({ code: 'custom', message: 'Invalid variables' })
})
export const environmentResultSchema = resultSchema(environmentSnapshotSchema), variableResultSchema = resultSchema(variableSnapshotSchema), revealResultSchema = resultSchema(revealedValueSchema)
export const environmentInputs = { list: z.tuple([uuidSchema]), create: z.tuple([uuidSchema, nameSchema]), rename: z.tuple([uuidSchema, uuidSchema, nameSchema]), delete: z.tuple([uuidSchema, uuidSchema]), select: z.tuple([uuidSchema, uuidSchema.nullable()]) }
export const variableInputs = { list: z.tuple([uuidSchema, uuidSchema.nullable()]), upsert: z.tuple([uuidSchema, uuidSchema.nullable(), variableKeySchema, limitedText(), z.boolean(), uuidSchema.nullable().optional()]), delete: z.tuple([uuidSchema, uuidSchema]), reveal: z.tuple([uuidSchema, uuidSchema]) }
export const ENVIRONMENT_CHANNELS = Object.freeze({ list: 'environments:list', create: 'environments:create', rename: 'environments:rename', delete: 'environments:delete', select: 'environments:select' })
export const VARIABLE_CHANNELS = Object.freeze({ list: 'variables:list', upsert: 'variables:upsert', delete: 'variables:delete', reveal: 'variables:reveal' })
export type EnvironmentSnapshot = z.infer<typeof environmentSnapshotSchema>
export type VariableSnapshot = z.infer<typeof variableSnapshotSchema>
type EnvReply = Promise<Result<EnvironmentSnapshot>>
type VarReply = Promise<Result<VariableSnapshot>>
export interface EnvironmentApi { list(w: string): EnvReply; create(w: string, name: string): EnvReply; rename(w: string, id: string, name: string): EnvReply; delete(w: string, id: string): EnvReply; select(w: string, id: string | null): EnvReply }
export interface VariableApi { list(w: string, scope: string | null): VarReply; upsert(w: string, scope: string | null, key: string, value: string, sensitive: boolean, id?: string | null): VarReply; delete(w: string, id: string): VarReply; reveal(w: string, id: string): Promise<Result<z.infer<typeof revealedValueSchema>>> }
