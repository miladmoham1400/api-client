import type { SecretStore } from '../security/secrets'
import type { AuthDraft } from '../../shared/auth-editor'
import { credentialTemplateSchema, type StoredAuth } from '../../shared/request-config'
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { Repositories, RepositoryError } from '../db/repositories'
import { createDefaultRequestConfig } from '../../shared/request-config'
import { requestCreateSchema, requestDraftSchema, requestSnapshotSchema, type RequestDraft } from '../../shared/requests'
import { uuidSchema } from '../../shared/primitives'

/** Main-only staged hooks for TASK-013; no values/mappings cross IPC.
 * Preparation must not change live session values. Commit/rollback must not throw.
 */
export interface RequestSecretChange { commit(): void; rollback(): void }
export interface RequestSecretLifecycle {
  prepareDuplicateSessionValues(workspaceId: string, copies: readonly { sourceId: string; id: string }[]): RequestSecretChange
  prepareRemoveSessionValues(workspaceId: string, ids: readonly string[]): RequestSecretChange
}
export class RequestService {
  private readonly r: Repositories
  constructor(private readonly db: Database.Database, private readonly secrets?: RequestSecretLifecycle, private readonly store?: SecretStore) { this.r = new Repositories(db) }
  private active(workspace: string) {
    uuidSchema.parse(workspace)
    if (this.r.getSelectedWorkspace() !== workspace) throw new RepositoryError('NOT_FOUND')
  }
  newRow(workspace: string) { this.active(workspace); return { id: randomUUID(), key: '', value: '', enabled: true } }
  list(workspace: string) {
    this.active(workspace)
    const selected = this.r.getState(workspace).selectedRequestId
    const request = selected ? this.r.getRequest(workspace, selected) : null
    const editor = request ? { id: request.id, workspaceId: request.workspaceId, collectionId: request.collectionId, name: request.name, createdAt: request.createdAt, updatedAt: request.updatedAt, method: request.config.method, urlTemplate: request.config.urlTemplate, queryRows: request.config.queryRows, headerRows: request.config.headerRows, timeoutMs: request.config.timeoutMs, followRedirects: request.config.followRedirects, auth: this.authEditor(workspace, request.config.auth), credentialStorage: this.store?.capability() ?? 'session', body: ['none', 'json', 'raw', 'urlencoded'].includes(request.config.body.kind) ? request.config.body : null } : null
    return requestSnapshotSchema.parse({ workspaceId: workspace, requests: this.r.listRequests(workspace), editor })
  }
  private authEditor(w: string, auth: StoredAuth) {
    const field = (credential: Extract<StoredAuth, { mode: 'bearer' }>['token']) => {
      if (credential.kind === 'template') return { kind: 'value' as const, value: credential.template }
      const metadata = this.store ? this.store.presence(w, credential.secretId) : { hasValue: false, storageMode: this.r.getSecret(w, credential.secretId).storageMode }
      return { kind: 'stored' as const, hasValue: metadata.hasValue, storageMode: metadata.storageMode }
    }
    return auth.mode === 'none' ? { mode: 'none' as const } : auth.mode === 'bearer' ? { mode: 'bearer' as const, token: field(auth.token) } : { mode: 'basic' as const, username: field(auth.username), password: field(auth.password) }
  }
  private storeAuth(w: string, draft: AuthDraft, previous?: StoredAuth): StoredAuth {
    const old = previous?.mode === draft.mode ? previous : undefined
    const field = (input: Extract<AuthDraft, { mode: 'bearer' }>['token'], prior?: Extract<StoredAuth, { mode: 'bearer' }>['token']): Extract<StoredAuth, { mode: 'bearer' }>['token'] => {
      if (input.kind === 'keep') { if (!prior) throw new RepositoryError('VALIDATION'); return { ...prior } }
      if (credentialTemplateSchema.safeParse(input.value).success) return { kind: 'template', template: input.value }
      if (!this.store) throw new RepositoryError('SECRET_UNAVAILABLE')
      return { kind: 'secret', secretId: this.store.create(w, input.value).secretId }
    }
    return draft.mode === 'none' ? { mode: 'none' } : draft.mode === 'bearer' ? { mode: 'bearer', token: field(draft.token, old?.mode === 'bearer' ? old.token : undefined) } : { mode: 'basic', username: field(draft.username, old?.mode === 'basic' ? old.username : undefined), password: field(draft.password, old?.mode === 'basic' ? old.password : undefined) }
  }
  private authTransaction<T>(auth: AuthDraft | undefined, operation: () => T): T { return auth && this.store ? this.store.transaction(operation) : operation() }
  private select(workspace: string, id: string) { const state = this.r.getState(workspace); this.r.setState(workspace, state.activeEnvironmentId, id) }
  private mutate(workspace: string, operation: (stage: (change: RequestSecretChange) => void) => void) {
    let change: RequestSecretChange | undefined
    try {
      const result = this.db.transaction(() => { this.active(workspace); operation(staged => { change = staged }); return this.list(workspace) }).immediate()
      change?.commit()
      return result
    } catch (error) { change?.rollback(); if (error instanceof RepositoryError) throw error; throw new RepositoryError('DATABASE_WRITE_FAILED') }
  }
  get(workspace: string, id: string) {
    id = uuidSchema.parse(id)
    return this.mutate(workspace, () => { this.r.getRequest(workspace, id); this.select(workspace, id) })
  }
  create(workspace: string, input: unknown) {
    const draft = requestCreateSchema.parse(input)
    return this.authTransaction(draft.auth, () => this.mutate(workspace, () => {
      const config = { ...createDefaultRequestConfig(), method: draft.method, urlTemplate: draft.urlTemplate, ...this.fields(draft), auth: draft.auth ? this.storeAuth(workspace, draft.auth) : { mode: 'none' as const } }
      const request = this.r.createRequest(workspace, draft.name, draft.collectionId, config)
      this.select(workspace, request.id)
    }))
  }
  private fields(draft: RequestDraft) {
    return { ...(draft.body === undefined ? {} : { body: draft.body }), ...(draft.queryRows === undefined ? {} : { queryRows: draft.queryRows }), ...(draft.headerRows === undefined ? {} : { headerRows: draft.headerRows }), ...(draft.timeoutMs === undefined ? {} : { timeoutMs: draft.timeoutMs }), ...(draft.followRedirects === undefined ? {} : { followRedirects: draft.followRedirects }) }
  }
  save(workspace: string, id: string, input: RequestDraft) {
    id = uuidSchema.parse(id); const draft = requestDraftSchema.parse(input)
    return this.authTransaction(draft.auth, () => this.mutate(workspace, () => {
      const previous = this.r.getRequest(workspace, id)
      this.r.saveRequest(workspace, id, draft.name, { ...previous.config, method: draft.method, urlTemplate: draft.urlTemplate, ...this.fields(draft), auth: draft.auth ? this.storeAuth(workspace, draft.auth, previous.config.auth) : previous.config.auth })
      this.select(workspace, id)
    }))
  }
  duplicate(workspace: string, id: string) {
    id = uuidSchema.parse(id)
    return this.mutate(workspace, stage => {
      const copy = this.r.duplicateRequest(workspace, id)
      if (this.secrets) stage(this.secrets.prepareDuplicateSessionValues(workspace, copy.secretCopies))
      this.select(workspace, copy.request.id)
    })
  }
  delete(workspace: string, id: string) {
    id = uuidSchema.parse(id)
    return this.mutate(workspace, stage => {
      const request = this.r.getRequest(workspace, id), auth = request.config.auth
      const values = auth.mode === 'none' ? [] : auth.mode === 'bearer' ? [auth.token] : [auth.username, auth.password]
      const ids = [...new Set(values.flatMap(value => value.kind === 'secret' ? [value.secretId] : []))]
      if (this.secrets) stage(this.secrets.prepareRemoveSessionValues(workspace, ids))
      this.r.deleteRequest(workspace, id)
    })
  }
}
