import { z } from 'zod'
import { exportWorkspaceSchema, exportWorkspaceV2Schema, workspaceExportV1Schema, workspaceExportV2Schema } from './transfer'
import { nameSchema, uuidSchema } from './primitives'
import { resultSchema, type Result } from './results'
export const IMPORT_CHANNELS = Object.freeze({ choose: 'transfer:choose-import', confirm: 'transfer:import-workspace', cancel: 'transfer:cancel-import' })
export const importChooseInput = z.tuple([])
export const importTokenInput = z.tuple([uuidSchema])
const count = z.number().int().nonnegative()
export const importPreviewSchema = z.strictObject({
  token: uuidSchema, name: nameSchema, collections: z.array(nameSchema), folders: z.array(nameSchema), environments: z.array(nameSchema),
  requests: count, variables: count, missingVariables: count, missingCredentials: count, missingFiles: count
})
export const importChooseSchema = z.discriminatedUnion('status', [z.strictObject({ status: z.literal('cancelled') }), z.strictObject({ status: z.literal('preview'), preview: importPreviewSchema })])
export const importCreatedSchema = z.strictObject({ workspaceId: uuidSchema, name: nameSchema })
export const importChooseResult = resultSchema(importChooseSchema)
export const importCreatedResult = resultSchema(importCreatedSchema)
export const importCancelResult = resultSchema(z.null())
export type ImportPreview = z.infer<typeof importPreviewSchema>
export interface ImportApi {
  readonly chooseImport: () => Promise<Result<z.infer<typeof importChooseSchema>>>
  readonly importWorkspace: (token: string) => Promise<Result<z.infer<typeof importCreatedSchema>>>
  readonly cancelImport: (token: string) => Promise<Result<null>>
}

// Import applies the same saved-request method/body rule as explicit create/save.
const methodBodyRule = (workspace: z.infer<typeof exportWorkspaceSchema>, ctx: z.RefinementCtx) => {
  workspace.requests.forEach((request, index) => {
    if (['GET', 'HEAD'].includes(request.config.method) && request.config.body.kind !== 'none') {
      ctx.addIssue({ code: 'custom', message: 'GET and HEAD cannot have a body', path: ['requests', index, 'config', 'body'] })
    }
  })
}
const importWorkspaceV1Schema = exportWorkspaceSchema.superRefine(methodBodyRule)
const importWorkspaceV2Schema = exportWorkspaceV2Schema.superRefine(methodBodyRule)
export const importWorkspaceDataSchema = z.union([importWorkspaceV1Schema, importWorkspaceV2Schema])
export const workspaceImportSchema = z.discriminatedUnion('version', [
  workspaceExportV1Schema.safeExtend({ workspace: importWorkspaceV1Schema }),
  workspaceExportV2Schema.safeExtend({ workspace: importWorkspaceV2Schema })
])
