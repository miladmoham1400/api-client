import { createOwnedHandler } from './guard'
import type { LibraryService } from '../services/library-view'
import { RepositoryError } from '../db/repositories'
import { libraryInputs, librarySnapshotSchema } from '../../shared/library-view'
import { workspaceTreeStateSchema } from '../../shared/api-library'
import type { DomainError } from '../../shared/results'
export function createLibraryHandlers(getWindow:Parameters<typeof createOwnedHandler>[0],url:string,getService:() => LibraryService|null) {
  const service=() => { const value=getService(); if(!value) throw new RepositoryError('DATABASE_UNAVAILABLE'); return value }
  const error=(error:unknown):DomainError => ({code:error instanceof RepositoryError ? error.code : 'DATABASE_UNAVAILABLE',message:'Library operation unavailable. Your saved requests have not been changed.',retryable:error instanceof RepositoryError && error.code==='DATABASE_UNAVAILABLE'})
  return {
    list:createOwnedHandler(getWindow,url,libraryInputs.list,librarySnapshotSchema,([w]) => service().list(w),error),
    setExpansion:createOwnedHandler(getWindow,url,libraryInputs.setExpansion,workspaceTreeStateSchema,([w,input]) => service().setExpansion(w,input),error)
  }
}
