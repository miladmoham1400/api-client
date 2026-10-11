import { randomUUID } from 'node:crypto'
import { type WorkspaceExport } from '../../shared/transfer'
import { workspaceImportSchema, importPreviewSchema, type ImportPreview } from '../../shared/import'
import { RepositoryError, Repositories } from '../db/repositories'
import { IMPORT_MAX_BYTES, readImport } from '../files/import-read'

export function validateImport(bytes: Uint8Array): WorkspaceExport {
  if (bytes.byteLength > IMPORT_MAX_BYTES) throw new RepositoryError('IMPORT_TOO_LARGE')
  let value: unknown
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { throw new RepositoryError('INVALID_IMPORT') }
  if (value !== null && typeof value === 'object' && ('format' in value || 'version' in value) &&
    (Reflect.get(value, 'format') !== 'offline-api-client-workspace' || ![1, 2].includes(Reflect.get(value, 'version')))) throw new RepositoryError('UNSUPPORTED_FORMAT_VERSION')
  const parsed = workspaceImportSchema.safeParse(value)
  if (!parsed.success) throw new RepositoryError('INVALID_IMPORT')
  return parsed.data
}
export class WorkspaceImportService {
  private pending: { token: string; dto: WorkspaceExport } | null = null
  private generation = 0
  private choosing = false
  constructor(private readonly repositories: Repositories) {}
  clear() { this.pending = null; this.generation++ }
  async choose(choose: () => Promise<string | null>, authorized: () => boolean) {
    if (this.choosing) throw new RepositoryError('VALIDATION')
    this.clear(); this.choosing = true
    const generation = this.generation
    try {
      const path = await choose()
      if (!authorized() || generation !== this.generation) throw new RepositoryError('NOT_FOUND')
      if (path === null) return { status: 'cancelled' as const }
      const dto = validateImport(await readImport(path))
      if (!authorized() || generation !== this.generation) throw new RepositoryError('NOT_FOUND')
      const w = dto.workspace, token = randomUUID()
      const preview: ImportPreview = importPreviewSchema.parse({ token, name: w.name, collections: w.collections.map(c => c.name), folders: dto.version === 2 ? dto.workspace.folders.map(f => f.name) : [], environments: w.environments.map(e => e.name), requests: w.requests.length, variables: w.variables.length,
        missingVariables: w.variables.filter(v => v.isSensitive).length,
        missingCredentials: w.requests.filter(r => r.config.auth.mode !== 'none' && r.config.auth.requiresCredentials).length,
        missingFiles: w.requests.reduce((n, r) => n + (r.config.body.kind === 'multipart' ? r.config.body.rows.filter(v => v.kind === 'file').length : 0), 0) })
      this.pending = { token, dto }
      return { status: 'preview' as const, preview }
    } finally { this.choosing = false }
  }
  confirm(token: string) {
    if (!this.pending || this.pending.token !== token) throw new RepositoryError('NOT_FOUND')
    // Import exactly the validated preview, not potentially changed file bytes.
    const result = this.repositories.importWorkspace(this.pending.dto.workspace)
    this.clear()
    return { workspaceId: result.id, name: result.name }
  }
  cancel(token: string) {
    if (!this.pending || this.pending.token !== token) throw new RepositoryError('NOT_FOUND')
    this.clear(); return null
  }
}
