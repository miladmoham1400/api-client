import { z } from 'zod'
import { uuidSchema } from './primitives'
import { requestDraftSchema, type RequestDraft } from './requests'
import { executionAcceptedSchema, resultSchema, type ExecutionCompleted, type Result } from './results'

export const EXECUTION_CHANNELS = Object.freeze({ send: 'execution:send', start: 'execution:start', cancel: 'execution:cancel', completed: 'execution:completed' })
export const executionInputs = {
  send: z.tuple([uuidSchema, uuidSchema.nullable(), requestDraftSchema, uuidSchema.nullable()]),
  start: z.tuple([uuidSchema]), cancel: z.tuple([uuidSchema])
}
export const executionAcceptedResultSchema = resultSchema(executionAcceptedSchema)
export const executionCancelResultSchema = resultSchema(z.null())
export interface ExecutionApi {
  readonly send: (workspace: string, request: string | null, draft: RequestDraft, environment: string | null) => Promise<Result<z.infer<typeof executionAcceptedSchema>>>
  readonly cancel: (executionId: string) => Promise<Result<null>>
  readonly onCompleted: (callback: (completion: ExecutionCompleted) => void) => () => void
}
