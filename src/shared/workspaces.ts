import { z } from 'zod'
import { workspaceSchema } from './entities'
import { nameSchema, uuidSchema } from './primitives'
import { resultSchema, type Result } from './results'

export const workspaceSnapshotSchema = z.strictObject({
  workspaces: z.array(workspaceSchema), selectedWorkspaceId: uuidSchema.nullable()
}).superRefine((snapshot, ctx) => {
  const ids = new Set(snapshot.workspaces.map(workspace => workspace.id))
  if (ids.size !== snapshot.workspaces.length || (snapshot.selectedWorkspaceId !== null && !ids.has(snapshot.selectedWorkspaceId))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid workspace selection' })
  }
})
export const workspaceResultSchema = resultSchema(workspaceSnapshotSchema)
export const workspaceInputs = {
  list: z.tuple([]), create: z.tuple([nameSchema]), rename: z.tuple([uuidSchema, nameSchema]),
  delete: z.tuple([uuidSchema]), select: z.tuple([uuidSchema.nullable()])
}
export const WORKSPACE_CHANNELS = Object.freeze({
  list: 'workspaces:list', create: 'workspaces:create', rename: 'workspaces:rename',
  delete: 'workspaces:delete', select: 'workspaces:select'
})
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>
export interface WorkspaceApi {
  readonly list: () => Promise<Result<WorkspaceSnapshot>>
  readonly create: (name: string) => Promise<Result<WorkspaceSnapshot>>
  readonly rename: (id: string, name: string) => Promise<Result<WorkspaceSnapshot>>
  readonly delete: (id: string) => Promise<Result<WorkspaceSnapshot>>
  readonly select: (id: string | null) => Promise<Result<WorkspaceSnapshot>>
}
