import type { RequestSecretLifecycle, RequestSecretChange } from './requests'
import type Database from 'better-sqlite3'
import { Repositories, RepositoryError } from '../db/repositories'
import { folderSnapshotSchema } from '../../shared/folders'
import { nameSchema, uuidSchema } from '../../shared/primitives'

export class FolderService {
  private readonly r: Repositories
  constructor(private readonly db: Database.Database, private readonly secrets?: RequestSecretLifecycle) { this.r = new Repositories(db) }
  private active(workspace: string) {
    uuidSchema.parse(workspace)
    if (this.r.getSelectedWorkspace() !== workspace) throw new RepositoryError('NOT_FOUND')
  }
  list(workspace: string) {
    this.active(workspace)
    return folderSnapshotSchema.parse({ workspaceId: workspace, collections: this.r.listCollections(workspace), folders: this.r.listFolders(workspace) })
  }
  private mutate(workspace: string, operation: () => void) {
    try { return this.db.transaction(() => { this.active(workspace); operation(); return this.list(workspace) }).immediate() }
    catch (error) { if (error instanceof RepositoryError) throw error; throw new RepositoryError('DATABASE_WRITE_FAILED') }
  }
  create(workspace: string, collection: string, parent: string|null, name: string) {
    collection = uuidSchema.parse(collection); parent = uuidSchema.nullable().parse(parent); name = nameSchema.parse(name)
    return this.mutate(workspace, () => { this.r.createFolder(workspace,collection,parent,name) })
  }
  rename(workspace: string, id: string, name: string) {
    id = uuidSchema.parse(id); name = nameSchema.parse(name)
    return this.mutate(workspace, () => { this.r.renameFolder(workspace,id,name) })
  }
  move(workspace: string, id: string, collection: string, parent: string|null) {
    id = uuidSchema.parse(id); collection = uuidSchema.parse(collection); parent = uuidSchema.nullable().parse(parent)
    return this.mutate(workspace, () => { this.r.moveFolder(workspace,id,collection,parent) })
  }
  duplicate(workspace: string, id: string) {
    id = uuidSchema.parse(id)
    let staged: RequestSecretChange | undefined
    try {
      const result = this.db.transaction(() => {
        this.active(workspace)
        const source = this.r.getFolder(workspace, id), folders = this.r.listFolders(workspace)
        const mapping = new Map<string, string>(), pending = [source]
        const copies: { sourceId: string; id: string }[] = []
        while (pending.length) {
          const folder = pending.shift()!
          const name = folder.id === id ? Array.from(folder.name).slice(0, 93).join('') + ' (copy)' : folder.name
          const parent = folder.id === id ? folder.parentFolderId : mapping.get(folder.parentFolderId!)!
          const copy = this.r.createFolder(workspace, source.collectionId, parent, name)
          mapping.set(folder.id, copy.id)
          pending.push(...folders.filter(child => child.parentFolderId === folder.id))
        }
        // Snapshot originals before inserting requests; never iterate newly copied rows.
        for (const request of this.r.listRequests(workspace)) {
          const destination = request.folderId && mapping.get(request.folderId)
          if (!destination) continue
          const copy = this.r.duplicateRequest(workspace, request.id)
          this.r.saveRequest(workspace, copy.request.id, request.name, copy.request.config)
          this.r.moveRequest(workspace, copy.request.id, source.collectionId, destination)
          copies.push(...copy.secretCopies)
        }
        if (this.secrets) staged = this.secrets.prepareDuplicateSessionValues(workspace, copies)
        return this.list(workspace)
      }).immediate()
      staged?.commit()
      return result
    } catch (error) {
      staged?.rollback()
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError('DATABASE_WRITE_FAILED')
    }
  }
  delete(workspace: string, id: string) {
    id = uuidSchema.parse(id)
    return this.mutate(workspace, () => { this.r.deleteFolder(workspace,id) })
  }
}
