import { z } from 'zod'
import { createOwnedAsyncHandler, type createOwnedHandler } from './guard'
import { RepositoryError } from '../db/repositories'
import { ExportFileError } from '../files/export-write'
import type { WorkspaceExportService } from '../services/workspace-export'
import { exportInputSchema, exportOutcomeSchema, postmanExportInput } from '../../shared/export'

export function createExportHandler(getWindow: Parameters<typeof createOwnedHandler>[0], trustedUrl: string, getService: () => WorkspaceExportService | null, choosePath: () => Promise<string | null>) {
  return createOwnedAsyncHandler(getWindow, trustedUrl, exportInputSchema, exportOutcomeSchema, async ([workspace], authorized) => {
    const service = getService()
    if (!service) throw new RepositoryError('DATABASE_UNAVAILABLE')
    return service.export(workspace, choosePath, authorized)
  }, error => {
    const code = error instanceof RepositoryError || error instanceof ExportFileError ? error.code : error instanceof z.ZodError ? 'VALIDATION' : 'EXPORT_WRITE_FAILED'
    return { code, message: code === 'NOT_FOUND' ? 'Workspace export unavailable.' : code === 'VALIDATION' ? error instanceof ExportFileError ? 'Export unavailable. Choose a JSON file outside application and data folders.' : 'Workspace export unavailable. Check saved configuration and the 10 MiB export limit, then try again.' : 'Workspace could not be exported. Your saved data has not been changed. Try again.', retryable: code === 'EXPORT_WRITE_FAILED' || code === 'DATABASE_UNAVAILABLE' }
  })
}

export function createPostmanExportHandler(getWindow: Parameters<typeof createOwnedHandler>[0], trustedUrl: string, getService: () => WorkspaceExportService | null, choosePath: () => Promise<string | null>) {
  return createOwnedAsyncHandler(getWindow, trustedUrl, postmanExportInput, exportOutcomeSchema, async ([workspace, collection], authorized) => {
    const service = getService()
    if (!service) throw new RepositoryError('DATABASE_UNAVAILABLE')
    return service.export(workspace, choosePath, authorized, collection)
  }, error => ({ code: error instanceof RepositoryError || error instanceof ExportFileError ? error.code : 'EXPORT_WRITE_FAILED', message: 'Collection export unavailable. Choose a JSON file outside application/data folders and check the saved collection and 10 MiB limit.', retryable: true }))
}
