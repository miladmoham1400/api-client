import type { CloseApi } from './close'
import type { FileApi } from './files'
import type { EnvironmentApi, VariableApi } from './variable-management'
import { z } from 'zod'
import type { CollectionApi, RequestGroupingApi } from './collections'
import type { RequestPersistenceApi } from './requests'
import type { ExecutionApi } from './execution'
import type { WorkspaceApi } from './workspaces'
import { resultSchema, type Result } from './results'

export const bootstrapSchema = z.strictObject({
  stage: z.literal('foundation'),
  database: z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('ready') }),
    z.strictObject({ status: z.literal('unavailable'), message: z.literal('The local database could not be opened. Your existing data has not been replaced. Close the app and check access to the database location.'), path: z.string() })
  ]),
  capabilities: z.strictObject({ database: z.boolean(), requests: z.boolean() })
})
export const bootstrapResultSchema = resultSchema(bootstrapSchema)
export const bootstrapInputSchema = z.tuple([])
export const IPC_CHANNELS = Object.freeze({ getBootstrap: 'app:get-bootstrap' })
export type Bootstrap = z.infer<typeof bootstrapSchema>
export interface DesktopApi {
  readonly files: FileApi
  readonly environments: EnvironmentApi
  readonly variables: VariableApi
  readonly workspaces: WorkspaceApi
  readonly collections: CollectionApi
  readonly requests: RequestGroupingApi & RequestPersistenceApi
  readonly execution: ExecutionApi
  readonly app: CloseApi & { readonly getBootstrap: () => Promise<Result<Bootstrap>> }
}
