import { z } from 'zod'
import { resultSchema, type Result } from './results'

export const bootstrapSchema = z.strictObject({
  stage: z.literal('foundation'),
  capabilities: z.strictObject({ database: z.literal(false), requests: z.literal(false) })
})
export const bootstrapResultSchema = resultSchema(bootstrapSchema)
export const bootstrapInputSchema = z.tuple([])
export const IPC_CHANNELS = Object.freeze({ getBootstrap: 'app:get-bootstrap' })
export type Bootstrap = z.infer<typeof bootstrapSchema>
export interface DesktopApi {
  readonly app: { readonly getBootstrap: () => Promise<Result<Bootstrap>> }
}
