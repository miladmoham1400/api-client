import { z } from 'zod'
import { createOwnedHandler } from './guard'
import { RepositoryError } from '../db/repositories'
import type { RequestService } from '../services/requests'
import { requestInputs, requestSnapshotSchema } from '../../shared/requests'
import type { DomainError } from '../../shared/results'

function operationError(error: unknown): DomainError {
  const code = error instanceof RepositoryError ? error.code : 'DATABASE_UNAVAILABLE'
  return { code, message: code === 'NOT_FOUND' ? 'Request not found' : code === 'VALIDATION' ? 'Invalid input' : 'Local request operation failed. Try again.', retryable: code === 'DATABASE_UNAVAILABLE' || code === 'DATABASE_WRITE_FAILED' }
}
export function createRequestHandlers(getWindow: Parameters<typeof createOwnedHandler>[0], trustedUrl: string, getService: () => RequestService | null) {
  function handler<I extends z.ZodType>(input: I, operation: (service: RequestService, args: z.infer<I>) => z.infer<typeof requestSnapshotSchema>) {
    return createOwnedHandler(getWindow, trustedUrl, input, requestSnapshotSchema, args => { const service = getService(); if (!service) throw new RepositoryError('DATABASE_UNAVAILABLE'); return operation(service, args) }, operationError)
  }
  return {
    list: handler(requestInputs.list, (service, [workspace]) => service.list(workspace)),
    get: handler(requestInputs.get, (service, [workspace, id]) => service.get(workspace, id)),
    create: handler(requestInputs.create, (service, [workspace, input]) => service.create(workspace, input)),
    save: handler(requestInputs.save, (service, [workspace, id, input]) => service.save(workspace, id, input)),
    duplicate: handler(requestInputs.duplicate, (service, [workspace, id]) => service.duplicate(workspace, id)),
    delete: handler(requestInputs.delete, (service, [workspace, id]) => service.delete(workspace, id))
  }
}
