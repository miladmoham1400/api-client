import { executionAcceptedResultSchema, executionCancelResultSchema, executionInputs, type ExecutionApi } from '../shared/execution'
import { executionCompletedSchema, validationError } from '../shared/results'
import { subscribeValidated } from './listeners'

export function createExecutionApi(
  invokeSend: (args: unknown[]) => Promise<unknown>,
  acknowledge: (id: string) => void,
  add: (listener: (event: unknown, payload: unknown) => void) => void,
  remove: (listener: (event: unknown, payload: unknown) => void) => void,
  invokeCancel: (id: string) => Promise<unknown>
): ExecutionApi {
  let subscriptions = 0
  const api: ExecutionApi = {
    send: async (workspace, request, draft, environment) => {
      const input = executionInputs.send.safeParse([workspace, request, draft, environment])
      if (!input.success) return { ok: false, error: validationError(input.error, true) }
      if (!subscriptions) return { ok: false, error: { code: 'VALIDATION', message: 'Subscribe to completion before sending', retryable: false } }
      try {
        const result = executionAcceptedResultSchema.parse(await invokeSend(input.data))
        if (result.ok) {
          const id = result.data.executionId
          // Return acceptance to the caller before acknowledging on the next renderer turn.
          setTimeout(() => acknowledge(id), 0)
        }
        return result
      } catch { return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } } }
    },
    cancel: async id => {
      const input = executionInputs.cancel.safeParse([id])
      if (!input.success) return { ok: false, error: validationError(input.error, true) }
      try { return executionCancelResultSchema.parse(await invokeCancel(input.data[0])) }
      catch { return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } } }
    },
    onCompleted: callback => {
      if (typeof callback !== 'function') throw new TypeError('Completion callback required')
      const unsubscribe = subscribeValidated(executionCompletedSchema, add, remove, callback)
      subscriptions++
      let active = true
      return () => { if (!active) return; active = false; subscriptions--; unsubscribe() }
    }
  }
  return Object.freeze(api)
}
