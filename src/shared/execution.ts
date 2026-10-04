import { z } from 'zod'
import { uuidSchema } from './primitives'
import { requestDraftSchema, type RequestDraft } from './requests'
import { executionAcceptedSchema, resultSchema, type ExecutionCompleted, type Result } from './results'

export const EXECUTION_CHANNELS = Object.freeze({ send: 'execution:send', start: 'execution:start', completed: 'execution:completed' })
export const executionInputs = {
  send: z.tuple([uuidSchema, uuidSchema.nullable(), requestDraftSchema, uuidSchema.nullable()]),
  start: z.tuple([uuidSchema])
}
export const executionAcceptedResultSchema = resultSchema(executionAcceptedSchema)
export interface ExecutionApi {
  readonly send: (workspace: string, request: string | null, draft: RequestDraft, environment: string | null) => Promise<Result<z.infer<typeof executionAcceptedSchema>>>
  readonly onCompleted: (callback: (completion: ExecutionCompleted) => void) => () => void
}
