import type Database from 'better-sqlite3'
import { Repositories, RepositoryError } from '../db/repositories'
import { uuidSchema } from '../../shared/primitives'
import { serializeWorkspace } from './export-serializer'
import { IMPORT_MAX_BYTES } from '../files/import-read'
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
      const source = r.getWorkspace(workspace), environments = r.listEnvironments(workspace)
      return serializeWorkspace({ workspace: source, folders: r.listFolders(workspace), collections: r.listCollections(workspace), environments,
        variables: [null, ...environments.map(value => value.id)].flatMap(scope => r.listVariables(workspace, scope)),
        requests: r.listStoredRequests(workspace) })
    }).deferred()
  }
  async export(workspace: string, choosePath: () => Promise<string | null>, authorized: () => boolean): Promise<ExportOutcome> {
    if (this.running) throw new RepositoryError('VALIDATION')
    this.running = true
    try {
      const dto = this.snapshot(workspace), json = `${JSON.stringify(dto, null, 2)}\n`
      if (Buffer.byteLength(json, 'utf8') > IMPORT_MAX_BYTES) throw new RepositoryError('VALIDATION')
      const destination = await choosePath()
      if (!authorized()) throw new RepositoryError('NOT_FOUND')
      if (destination === null) return { status: 'cancelled' }
      this.repositories.getWorkspace(workspace)
      await writeExportFile(destination, json, this.protectedRoots, authorized)
      return { status: 'saved' }
    } finally { this.running = false }
  }
}
