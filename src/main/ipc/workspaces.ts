import { z } from 'zod'
import { createOwnedHandler } from './guard'
import { RepositoryError } from '../db/repositories'
import type { WorkspaceService } from '../services/workspaces'
import { workspaceInputs, workspaceSnapshotSchema } from '../../shared/workspaces'
import type { DomainError } from '../../shared/results'

function operationError(error: unknown): DomainError {
  const code = error instanceof RepositoryError ? error.code : 'DATABASE_UNAVAILABLE'
  return { code, message: code === 'NOT_FOUND' ? 'Workspace not found' : code === 'VALIDATION' ? 'Invalid input' : 'Local workspace operation failed. Try again.', retryable: code === 'DATABASE_UNAVAILABLE' || code === 'DATABASE_WRITE_FAILED' }
}
export function createWorkspaceHandlers(
  getWindow: Parameters<typeof createOwnedHandler>[0], trustedUrl: string, getService: () => WorkspaceService | null
) {
  function handler<I extends z.ZodType>(input: I, operation: (service: WorkspaceService, args: z.infer<I>) => z.infer<typeof workspaceSnapshotSchema>) {
    return createOwnedHandler(getWindow, trustedUrl, input, workspaceSnapshotSchema, args => {
      const service = getService()
      if (!service) throw new RepositoryError('DATABASE_UNAVAILABLE')
      return operation(service, args)
    }, operationError)
  }
  return {
    list: handler(workspaceInputs.list, service => service.list()),
    create: handler(workspaceInputs.create, (service, [name]) => service.create(name)),
    rename: handler(workspaceInputs.rename, (service, [id, name]) => service.rename(id, name)),
    delete: handler(workspaceInputs.delete, (service, [id]) => service.delete(id)),
    select: handler(workspaceInputs.select, (service, [id]) => service.select(id))
  }
}
