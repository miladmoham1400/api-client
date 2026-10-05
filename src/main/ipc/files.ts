import { z } from 'zod'
import { createOwnedAsyncHandler, createOwnedHandler } from './guard'
import { RepositoryError } from '../db/repositories'
import { UploadError, type UploadService } from '../files/uploads'
import { fileInputs, uploadSelectionSchema } from '../../shared/files'
import type { DomainError } from '../../shared/results'

function operationError(error: unknown): DomainError {
  if (error instanceof UploadError) return error.dto()
  const code = error instanceof RepositoryError ? error.code : 'VALIDATION'
  return { code, message: 'Operation unavailable', retryable: code === 'DATABASE_UNAVAILABLE' }
}
export function createFileHandlers(
  getWindow: Parameters<typeof createOwnedHandler>[0], trustedUrl: string,
  getService: () => UploadService | null, choosePath: () => Promise<string | null>
) {
  const service = () => { const value = getService(); if (!value) throw new RepositoryError('DATABASE_UNAVAILABLE'); return value }
  return {
    chooseUpload: createOwnedAsyncHandler(getWindow, trustedUrl, fileInputs.chooseUpload,
      uploadSelectionSchema.nullable(), ([workspace]) => service().choose(workspace, choosePath), operationError),
    releaseUpload: createOwnedHandler(getWindow, trustedUrl, fileInputs.releaseUpload, z.null(),
      ([workspace, id]) => service().release(workspace, id), operationError)
  }
}
