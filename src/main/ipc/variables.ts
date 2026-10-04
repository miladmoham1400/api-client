import { z } from 'zod'
import { createOwnedHandler } from './guard'
import { RepositoryError } from '../db/repositories'
import type { VariableService } from '../services/variables'
import { environmentInputs, variableInputs, environmentSnapshotSchema, variableSnapshotSchema } from '../../shared/variable-management'
import { revealedValueSchema, type DomainError } from '../../shared/results'
export function createVariableHandlers(getWindow: Parameters<typeof createOwnedHandler>[0], url: string, getService: () => VariableService | null) {
  const mapError = (error: unknown): DomainError => ({ code: error instanceof RepositoryError ? error.code : 'DATABASE_UNAVAILABLE', message: error instanceof RepositoryError && error.code === 'SECRET_UNAVAILABLE' ? 'Sensitive value unavailable. Re-enter it.' : 'Variable operation failed. Check the scope and fields, then try again.', retryable: false })
  function handler<I extends z.ZodType, O extends z.ZodType>(input: I, output: O, operation: (s: VariableService, args: z.infer<I>) => z.infer<O>) { return createOwnedHandler(getWindow, url, input, output, args => { const s = getService(); if (!s) throw new RepositoryError('DATABASE_UNAVAILABLE'); return operation(s, args) }, mapError) }
  return { environments: {
    list: handler(environmentInputs.list, environmentSnapshotSchema, (s, [w]) => s.environments(w)), create: handler(environmentInputs.create, environmentSnapshotSchema, (s, [w, n]) => s.createEnvironment(w, n)), rename: handler(environmentInputs.rename, environmentSnapshotSchema, (s, [w, id, n]) => s.renameEnvironment(w, id, n)), delete: handler(environmentInputs.delete, environmentSnapshotSchema, (s, [w, id]) => s.deleteEnvironment(w, id)), select: handler(environmentInputs.select, environmentSnapshotSchema, (s, [w, id]) => s.select(w, id))
  }, variables: {
    list: handler(variableInputs.list, variableSnapshotSchema, (s, [w, scope]) => s.list(w, scope)), upsert: handler(variableInputs.upsert, variableSnapshotSchema, (s, [w, scope, k, v, sensitive, id]) => s.upsert(w, scope, k, v, sensitive, id)), delete: handler(variableInputs.delete, variableSnapshotSchema, (s, [w, id]) => s.delete(w, id)), reveal: handler(variableInputs.reveal, revealedValueSchema, (s, [w, id]) => s.reveal(w, id))
  } }
}
