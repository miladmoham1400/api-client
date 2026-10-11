import type Database from 'better-sqlite3'
import { Repositories, RepositoryError } from '../db/repositories'
import { folderSnapshotSchema } from '../../shared/folders'
import { nameSchema, uuidSchema } from '../../shared/primitives'

export class FolderService {
  private readonly r: Repositories
  constructor(private readonly db: Database.Database) { this.r = new Repositories(db) }
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
  delete(workspace: string, id: string) {
    id = uuidSchema.parse(id)
    return this.mutate(workspace, () => { this.r.deleteFolder(workspace,id) })
  }
}
