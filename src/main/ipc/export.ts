import { z } from 'zod'
import { createOwnedAsyncHandler, type createOwnedHandler } from './guard'
import { RepositoryError } from '../db/repositories'
import { ExportFileError } from '../files/export-write'
import type { WorkspaceExportService } from '../services/workspace-export'
import { exportInputSchema, exportOutcomeSchema } from '../../shared/export'

export function createExportHandler(getWindow: Parameters<typeof createOwnedHandler>[0], trustedUrl: string, getService: () => WorkspaceExportService | null, choosePath: () => Promise<string | null>) {
  return createOwnedAsyncHandler(getWindow, trustedUrl, exportInputSchema, exportOutcomeSchema, async ([workspace], authorized) => {
    const service = getService()
    if (!service) throw new RepositoryError('DATABASE_UNAVAILABLE')
    return service.export(workspace, choosePath, authorized)
  }, error => {
    const code = error instanceof RepositoryError || error instanceof ExportFileError ? error.code : error instanceof z.ZodError ? 'VALIDATION' : 'EXPORT_WRITE_FAILED'
    return { code, message: code === 'FOLDER_EXPORT_UNAVAILABLE' ? 'Folder-aware workspace export is not available yet. Your saved data has not been changed.' : code === 'NOT_FOUND' ? 'Workspace export unavailable.' : code === 'VALIDATION' ? error instanceof ExportFileError ? 'Export unavailable. Choose a JSON file outside application and data folders.' : 'Workspace export unavailable. Check saved configuration and try again.' : 'Workspace could not be exported. Your saved data has not been changed. Try again.', retryable: code === 'EXPORT_WRITE_FAILED' || code === 'DATABASE_UNAVAILABLE' }
  })
}
