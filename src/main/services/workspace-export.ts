import type Database from 'better-sqlite3'
import { Repositories, RepositoryError } from '../db/repositories'
import { uuidSchema } from '../../shared/primitives'
import { serializeWorkspace } from './export-serializer'
import { writeExportFile } from '../files/export-write'
import type { ExportOutcome } from '../../shared/export'

export class WorkspaceExportService {
  private readonly repositories: Repositories
  private running = false
  constructor(private readonly db: Database.Database, private readonly protectedRoots: string[]) { this.repositories = new Repositories(db) }
  snapshot(workspace: string) {
    workspace = uuidSchema.parse(workspace)
    const r = this.repositories
    // The first SELECT establishes one read snapshot; there are no awaits inside this transaction.
    return this.db.transaction(() => {
      if (r.listFolders(workspace).length) throw new RepositoryError('FOLDER_EXPORT_UNAVAILABLE')
      const source = r.getWorkspace(workspace), environments = r.listEnvironments(workspace)
      return serializeWorkspace({ workspace: source, collections: r.listCollections(workspace), environments,
        variables: [null, ...environments.map(value => value.id)].flatMap(scope => r.listVariables(workspace, scope)),
        requests: r.listRequests(workspace).map(value => r.getRequest(workspace, value.id)) })
    }).deferred()
  }
  async export(workspace: string, choosePath: () => Promise<string | null>, authorized: () => boolean): Promise<ExportOutcome> {
    if (this.running) throw new RepositoryError('VALIDATION')
    this.running = true
    try {
      const dto = this.snapshot(workspace), json = `${JSON.stringify(dto, null, 2)}\n`
      const destination = await choosePath()
      if (!authorized()) throw new RepositoryError('NOT_FOUND')
      if (destination === null) return { status: 'cancelled' }
      this.repositories.getWorkspace(workspace)
      if (this.repositories.listFolders(workspace).length) throw new RepositoryError('FOLDER_EXPORT_UNAVAILABLE')
      await writeExportFile(destination, json, this.protectedRoots, authorized)
      return { status: 'saved' }
    } finally { this.running = false }
  }
}
