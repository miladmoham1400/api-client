import { z } from 'zod'
import type { CollectionApi, RequestGroupingApi } from './collections'
import type { WorkspaceApi } from './workspaces'
import { resultSchema, type Result } from './results'

export const bootstrapSchema = z.strictObject({
  stage: z.literal('foundation'),
  database: z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('ready') }),
    z.strictObject({ status: z.literal('unavailable'), message: z.literal('The local database could not be opened. Your existing data has not been replaced. Close the app and check access to the database location.'), path: z.string() })
  ]),
  capabilities: z.strictObject({ database: z.boolean(), requests: z.literal(false) })
})
export const bootstrapResultSchema = resultSchema(bootstrapSchema)
export const bootstrapInputSchema = z.tuple([])
export const IPC_CHANNELS = Object.freeze({ getBootstrap: 'app:get-bootstrap' })
export type Bootstrap = z.infer<typeof bootstrapSchema>
export interface DesktopApi {
  readonly workspaces: WorkspaceApi
  readonly collections: CollectionApi
  readonly requests: RequestGroupingApi
  readonly app: { readonly getBootstrap: () => Promise<Result<Bootstrap>> }
}
