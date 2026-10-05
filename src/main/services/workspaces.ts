import type Database from 'better-sqlite3'
import { Repositories, RepositoryError } from '../db/repositories'
import { nameSchema, uuidSchema } from '../../shared/primitives'
import { workspaceSnapshotSchema } from '../../shared/workspaces'

export class WorkspaceService {
  private readonly repositories: Repositories
  constructor(private readonly db: Database.Database, private readonly secrets?: { forgetWorkspace(workspace: string): void }, private readonly deleted?: (workspace: string) => void, private readonly beforeDelete?: (workspace: string) => void) { this.repositories = new Repositories(db) }
  list() {
    return workspaceSnapshotSchema.parse({
      workspaces: this.repositories.listWorkspaces(), selectedWorkspaceId: this.repositories.getSelectedWorkspace()
    })
  }
  private mutate(operation: () => void) {
    try {
      // Selection and DTO validation commit together with the metadata mutation.
      return this.db.transaction(() => { operation(); return this.list() }).immediate()
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError('DATABASE_WRITE_FAILED')
    }
  }
  create(name: string) {
    name = nameSchema.parse(name)
    return this.mutate(() => {
      const workspace = this.repositories.createWorkspace(name)
      this.repositories.selectWorkspace(workspace.id)
    })
  }
  rename(id: string, name: string) {
    id = uuidSchema.parse(id); name = nameSchema.parse(name)
    return this.mutate(() => { this.repositories.renameWorkspace(id, name) })
  }
  delete(id: string) {
    id = uuidSchema.parse(id)
    this.repositories.getWorkspace(id)
    this.beforeDelete?.(id)
    // Repository deletion clears active selection; empty selection is the fallback.
    const result = this.mutate(() => { this.repositories.deleteWorkspace(id) })
    this.secrets?.forgetWorkspace(id)
    this.deleted?.(id)
    return result
  }
  select(id: string | null) {
    id = uuidSchema.nullable().parse(id)
    return this.mutate(() => { this.repositories.selectWorkspace(id) })
  }
}
