import { z } from 'zod'
import { createOwnedHandler } from './guard'
import { RepositoryError } from '../db/repositories'
import type { CollectionService } from '../services/collections'
import { collectionInputs, groupingSchema } from '../../shared/collections'
import type { DomainError } from '../../shared/results'

function operationError(error: unknown): DomainError {
  const code = error instanceof RepositoryError ? error.code : 'DATABASE_UNAVAILABLE'
  return { code, message: code === 'NOT_FOUND' ? 'Item not found' : code === 'VALIDATION' ? 'Invalid input' : 'Local collection operation failed. Try again.', retryable: code === 'DATABASE_UNAVAILABLE' || code === 'DATABASE_WRITE_FAILED' }
}
export function createCollectionHandlers(getWindow: Parameters<typeof createOwnedHandler>[0], trustedUrl: string, getService: () => CollectionService | null) {
  function handler<I extends z.ZodType>(input: I, operation: (service: CollectionService, args: z.infer<I>) => z.infer<typeof groupingSchema>) {
    return createOwnedHandler(getWindow, trustedUrl, input, groupingSchema, args => {
      const service = getService()
      if (!service) throw new RepositoryError('DATABASE_UNAVAILABLE')
      return operation(service, args)
    }, operationError)
  }
  return {
    list: handler(collectionInputs.list, (service, [workspace]) => service.list(workspace)),
    create: handler(collectionInputs.create, (service, [workspace, name]) => service.create(workspace, name)),
    rename: handler(collectionInputs.rename, (service, [workspace, id, name]) => service.rename(workspace, id, name)),
    delete: handler(collectionInputs.delete, (service, [workspace, id]) => service.delete(workspace, id)),
    move: handler(collectionInputs.move, (service, [workspace, id, collection]) => service.move(workspace, id, collection))
  }
}
