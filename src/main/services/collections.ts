import type Database from 'better-sqlite3'
import { Repositories, RepositoryError } from '../db/repositories'
import { groupingSchema } from '../../shared/collections'
import { nameSchema, uuidSchema } from '../../shared/primitives'

export class CollectionService {
  private readonly repositories: Repositories
  constructor(private readonly db: Database.Database) { this.repositories = new Repositories(db) }
  private active(workspaceId: string) {
    uuidSchema.parse(workspaceId)
    if (this.repositories.getSelectedWorkspace() !== workspaceId) throw new RepositoryError('NOT_FOUND')
  }
  list(workspaceId: string) {
    this.active(workspaceId)
    return groupingSchema.parse({ workspaceId, collections: this.repositories.listCollections(workspaceId), requests: this.repositories.listRequests(workspaceId) })
  }
  private mutate(workspaceId: string, operation: () => void) {
    try {
      return this.db.transaction(() => { this.active(workspaceId); operation(); return this.list(workspaceId) }).immediate()
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError('DATABASE_WRITE_FAILED')
    }
  }
  create(workspaceId: string, name: string) {
    name = nameSchema.parse(name)
    return this.mutate(workspaceId, () => { this.repositories.createCollection(workspaceId, name) })
  }
  rename(workspaceId: string, id: string, name: string) {
    id = uuidSchema.parse(id); name = nameSchema.parse(name)
    return this.mutate(workspaceId, () => { this.repositories.renameCollection(workspaceId, id, name) })
  }
  delete(workspaceId: string, id: string) {
    id = uuidSchema.parse(id)
    return this.mutate(workspaceId, () => { this.repositories.deleteCollection(workspaceId, id) })
  }
  move(workspaceId: string, id: string, collectionId: string | null, folderId: string | null = null) {
    id = uuidSchema.parse(id); collectionId = uuidSchema.nullable().parse(collectionId)
    return this.mutate(workspaceId, () => { this.repositories.moveRequest(workspaceId, id, collectionId, folderId) })
  }
}
