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
  constructor(private readonly db: Database.Database, private readonly secrets?: RequestSecretLifecycle) { this.r = new Repositories(db) }
  private active(workspace: string) {
    uuidSchema.parse(workspace)
    if (this.r.getSelectedWorkspace() !== workspace) throw new RepositoryError('NOT_FOUND')
  }
  newRow(workspace: string) { this.active(workspace); return { id: randomUUID(), key: '', value: '', enabled: true } }
  list(workspace: string) {
    this.active(workspace)
    const selected = this.r.getState(workspace).selectedRequestId
    const request = selected ? this.r.getRequest(workspace, selected) : null
    const editor = request ? { id: request.id, workspaceId: request.workspaceId, collectionId: request.collectionId, name: request.name, createdAt: request.createdAt, updatedAt: request.updatedAt, method: request.config.method, urlTemplate: request.config.urlTemplate, queryRows: request.config.queryRows, headerRows: request.config.headerRows, timeoutMs: request.config.timeoutMs, followRedirects: request.config.followRedirects } : null
    return requestSnapshotSchema.parse({ workspaceId: workspace, requests: this.r.listRequests(workspace), editor })
  }
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
    return this.mutate(workspace, () => {
      const config = { ...createDefaultRequestConfig(), method: draft.method, urlTemplate: draft.urlTemplate, ...this.fields(draft), auth: { mode: 'none' as const } }
      const request = this.r.createRequest(workspace, draft.name, draft.collectionId, config)
      this.select(workspace, request.id)
    })
  }
  private fields(draft: RequestDraft) {
    return { ...(draft.queryRows === undefined ? {} : { queryRows: draft.queryRows }), ...(draft.headerRows === undefined ? {} : { headerRows: draft.headerRows }), ...(draft.timeoutMs === undefined ? {} : { timeoutMs: draft.timeoutMs }), ...(draft.followRedirects === undefined ? {} : { followRedirects: draft.followRedirects }) }
  }
  save(workspace: string, id: string, input: RequestDraft) {
    id = uuidSchema.parse(id); const draft = requestDraftSchema.parse(input)
    return this.mutate(workspace, () => {
      const previous = this.r.getRequest(workspace, id)
      this.r.saveRequest(workspace, id, draft.name, { ...previous.config, method: draft.method, urlTemplate: draft.urlTemplate, ...this.fields(draft) })
      this.select(workspace, id)
    })
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
