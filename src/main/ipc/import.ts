import { z } from 'zod'
import { createOwnedAsyncHandler, createOwnedHandler } from './guard'
import { RepositoryError } from '../db/repositories'
import type { WorkspaceImportService } from '../services/workspace-import'
import { importChooseInput, importTokenInput, importChooseSchema, importCreatedSchema } from '../../shared/import'
import type { DomainError } from '../../shared/results'
export function createImportHandlers(getWindow: Parameters<typeof createOwnedHandler>[0], trustedUrl: string, getService: () => WorkspaceImportService | null, choose: () => Promise<string | null>) {
  const service = () => { const value = getService(); if (!value) throw new RepositoryError('DATABASE_UNAVAILABLE'); return value }
  const error = (e: unknown): DomainError => {
    const code = e instanceof RepositoryError ? e.code : 'INVALID_IMPORT'
    return { code, message: code === 'IMPORT_TOO_LARGE' ? 'Import exceeds the 10 MiB limit.' : code === 'UNSUPPORTED_FORMAT_VERSION' ? 'Only Offline API Client workspace format v1 is supported.' : code === 'NOT_FOUND' ? 'Import preview expired. Choose the file again.' : code === 'DATABASE_WRITE_FAILED' || code === 'DATABASE_UNAVAILABLE' ? 'Import could not be saved. No partial workspace was created. Try again.' : 'Invalid workspace import. Check its format, limits, omissions and references.', retryable: code === 'DATABASE_WRITE_FAILED' || code === 'DATABASE_UNAVAILABLE' }
  }
  return {
    choose: createOwnedAsyncHandler(getWindow, trustedUrl, importChooseInput, importChooseSchema, async (_, authorized) => service().choose(choose, authorized), error),
    confirm: createOwnedHandler(getWindow, trustedUrl, importTokenInput, importCreatedSchema, ([token]) => service().confirm(token), error),
    cancel: createOwnedHandler(getWindow, trustedUrl, importTokenInput, z.null(), ([token]) => service().cancel(token), error)
  }
}
