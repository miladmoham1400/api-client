import { z } from 'zod'
import { createOwnedHandler } from './guard'
import { RepositoryError } from '../db/repositories'
import type { FolderService } from '../services/folders'
import { folderInputs, folderSnapshotSchema } from '../../shared/folders'
import type { DomainError } from '../../shared/results'

function operationError(error: unknown): DomainError {
  const code = error instanceof RepositoryError ? error.code : 'DATABASE_UNAVAILABLE'
  return { code, message: code === 'NOT_FOUND' ? 'Item not found' : code === 'VALIDATION' ? 'Invalid input' : 'Local folder operation failed. Try again.', retryable: code === 'DATABASE_UNAVAILABLE' || code === 'DATABASE_WRITE_FAILED' }
}
export function createFolderHandlers(getWindow: Parameters<typeof createOwnedHandler>[0], trustedUrl: string, getService: () => FolderService|null) {
  function handler<I extends z.ZodType>(input: I, operation: (service: FolderService, args: z.infer<I>) => z.infer<typeof folderSnapshotSchema>) {
    return createOwnedHandler(getWindow,trustedUrl,input,folderSnapshotSchema,args => {
      const service = getService()
      if (!service) throw new RepositoryError('DATABASE_UNAVAILABLE')
      return operation(service,args)
    },operationError)
  }
  return {
    list: handler(folderInputs.list,(s,[w]) => s.list(w)),
    create: handler(folderInputs.create,(s,[w,c,p,n]) => s.create(w,c,p,n)),
    rename: handler(folderInputs.rename,(s,[w,id,n]) => s.rename(w,id,n)),
    move: handler(folderInputs.move,(s,[w,id,c,p]) => s.move(w,id,c,p)),
    delete: handler(folderInputs.delete,(s,[w,id]) => s.delete(w,id))
  }
}
