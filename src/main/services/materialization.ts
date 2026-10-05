import { UploadError, type UploadService } from '../files/uploads'
import { BodyError } from '../http/body'
import type Database from 'better-sqlite3'
import { Repositories, RepositoryError } from '../db/repositories'
import type { SecretStore } from '../security/secrets'
import { materialize, type MaterializedRequest } from '../http/materialize'
import { createDefaultRequestConfig, type StoredAuth, type RuntimeAuth } from '../../shared/request-config'
import { requestDraftSchema, type RequestDraft } from '../../shared/requests'
import { mergeVariables, type ResolutionVariable } from '../../shared/variables'
import { uuidSchema } from '../../shared/primitives'
import { validationError, type Result } from '../../shared/results'

export class MaterializationService {
  private readonly r: Repositories
  constructor(db: Database.Database, private readonly store: SecretStore, private readonly uploads?: UploadService) { this.r = new Repositories(db) }
  capture(workspace: string, requestId: string | null, draft: RequestDraft, environmentId: string | null): Result<MaterializedRequest> {
    const checked = requestDraftSchema.safeParse(draft)
    if (!checked.success) return { ok: false, error: validationError(checked.error) }
    try {
      uuidSchema.parse(workspace); uuidSchema.nullable().parse(requestId); uuidSchema.nullable().parse(environmentId)
      if (this.r.getSelectedWorkspace() !== workspace) throw new RepositoryError('NOT_FOUND')
      if (environmentId) this.r.getEnvironment(workspace, environmentId)
      if (this.r.getState(workspace).activeEnvironmentId !== environmentId) throw new RepositoryError('NOT_FOUND')
      const previous = requestId ? this.r.getRequest(workspace, requestId).config : undefined
      const d = checked.data
      const field = (input: { kind: 'value'; value: string } | { kind: 'keep' }, old?: Extract<StoredAuth, { mode: 'bearer' }>['token']) => {
        if (input.kind === 'value') return input.value
        if (!old) throw new RepositoryError('VALIDATION')
        return old.kind === 'template' ? old.template : this.store.reveal(workspace, old.secretId)
      }
      const auth = d.auth
      const old = previous?.auth
      let runtime: RuntimeAuth = { mode: 'none' }
      if (!auth && old) {
        const read = (v: Extract<StoredAuth, { mode: 'bearer' }>['token']) => v.kind === 'template' ? v.template : this.store.reveal(workspace, v.secretId)
        runtime = old.mode === 'none' ? { mode: 'none' } : old.mode === 'bearer' ? { mode: 'bearer', tokenTemplate: read(old.token) } : { mode: 'basic', usernameTemplate: read(old.username), passwordTemplate: read(old.password) }
      } else if (auth?.mode === 'bearer') runtime = { mode: 'bearer', tokenTemplate: field(auth.token, old?.mode === 'bearer' ? old.token : undefined) }
      else if (auth?.mode === 'basic') runtime = { mode: 'basic', usernameTemplate: field(auth.username, old?.mode === 'basic' ? old.username : undefined), passwordTemplate: field(auth.password, old?.mode === 'basic' ? old.password : undefined) }
      const entries: ResolutionVariable[] = []
      for (const scope of environmentId ? [null, environmentId] : [null]) for (const v of this.r.listVariables(workspace, scope)) {
        let value: string | null = v.plainValue
        if (v.isSensitive) { try { value = this.store.reveal(workspace, v.secretId) } catch (error) { if (!(error instanceof RepositoryError) || error.code !== 'SECRET_UNAVAILABLE') throw error; value = null } }
        entries.push({ workspaceId: workspace, environmentId: scope, key: v.key, value })
      }
      const merged = mergeVariables(workspace, environmentId, entries)
      if (!merged.ok) return merged
      let capturedFiles: ReturnType<UploadService['captureForSend']> | undefined
      return materialize({ ...createDefaultRequestConfig(), ...previous, method: d.method, urlTemplate: d.urlTemplate, queryRows: d.queryRows ?? previous?.queryRows ?? [], headerRows: d.headerRows ?? previous?.headerRows ?? [], body: d.body ?? previous?.body ?? { kind: 'none' }, timeoutMs: d.timeoutMs ?? previous?.timeoutMs ?? 30000, followRedirects: d.followRedirects ?? previous?.followRedirects ?? false, auth: runtime }, merged.data, this.uploads ? source => {
        try { capturedFiles ??= this.uploads!.captureForSend(workspace, source); return capturedFiles().map(lease => ({ ...lease, async *stream() {
          try { yield* lease.stream() } catch (error) { throw error instanceof UploadError ? new BodyError(error.dto()) : error }
        } })) }
        catch (error) { throw error instanceof UploadError ? new BodyError(error.dto()) : error }
      } : undefined)
    } catch (error) {
      return { ok: false, error: { code: error instanceof RepositoryError ? error.code : 'VALIDATION', message: 'Request configuration or credential unavailable', field: 'auth', retryable: false } }
    }
  }
}
