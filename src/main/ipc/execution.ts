import { z } from 'zod'
import { createOwnedHandler } from './guard'
import type { ExecutionService } from '../services/execution'
import { executionInputs } from '../../shared/execution'
import { executionAcceptedSchema, type DomainError } from '../../shared/results'

class SendError extends Error { constructor(readonly detail: DomainError) { super('Send rejected') } }
export function createExecutionHandlers(getWindow: Parameters<typeof createOwnedHandler>[0], trustedUrl: string, getService: () => ExecutionService | null) {
  return {
    send: createOwnedHandler(getWindow, trustedUrl, executionInputs.send, executionAcceptedSchema, args => {
      const service = getService()
      if (!service) throw new SendError({ code: 'DATABASE_UNAVAILABLE', message: 'Local database unavailable', retryable: true })
      const result = service.send(...args)
      if (!result.ok) throw new SendError(result.error)
      return result.data
    }, error => error instanceof SendError ? error.detail : { code: 'VALIDATION', message: 'Operation unavailable', retryable: false }),
    start: createOwnedHandler(getWindow, trustedUrl, executionInputs.start, z.null(), ([id]) => { getService()?.start(id); return null })
  }
}
