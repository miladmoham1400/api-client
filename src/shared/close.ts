import { z } from 'zod'
import { uuidSchema } from './primitives'
import { resultSchema, type Result } from './results'

export const CLOSE_CHANNELS = Object.freeze({ requested: 'app:close-requested', decision: 'app:close-decision' })
export const closeRequestedSchema = z.strictObject({ token: uuidSchema })
export const closeDecisionInput = z.tuple([uuidSchema, z.enum(['close', 'cancel'])])
export const closeDecisionResult = resultSchema(z.null())
export interface CloseApi {
  readonly onCloseRequested: (callback: (request: z.infer<typeof closeRequestedSchema>) => void) => () => void
  readonly requestCloseDecision: (token: string, decision: 'close' | 'cancel') => Promise<Result<null>>
}
