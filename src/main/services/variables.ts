import type Database from 'better-sqlite3'
import { Repositories, RepositoryError } from '../db/repositories'
import { SecretStore } from '../security/secrets'
import { environmentSnapshotSchema, variableSnapshotSchema, environmentInputs, variableInputs } from '../../shared/variable-management'
import { LIMITS } from '../../shared/primitives'
import type { StoredVariable } from '../../shared/entities'

export class VariableService {
  private readonly r: Repositories
  constructor(db: Database.Database, private readonly secrets: SecretStore) { this.r = new Repositories(db) }
  private active(w: string) { if (this.r.getSelectedWorkspace() !== w) throw new RepositoryError('NOT_FOUND'); this.r.getWorkspace(w) }
  environments(w: string) {
    this.active(w)
    return environmentSnapshotSchema.parse({ workspaceId: w, environments: this.r.listEnvironments(w), activeEnvironmentId: this.r.getState(w).activeEnvironmentId, storageMode: this.secrets.capability() })
  }
  private item(v: StoredVariable) {
    const { id, workspaceId, environmentId, key, createdAt, updatedAt } = v
    const identity = { id, workspaceId, environmentId, key, createdAt, updatedAt }
    return v.isSensitive ? { ...identity, isSensitive: true as const, ...this.secrets.presence(v.workspaceId, v.secretId) } : { ...identity, isSensitive: false as const, value: v.plainValue }
  }
  list(w: string, scope: string | null) {
    this.active(w); if (scope) this.r.getEnvironment(w, scope)
    const selected = this.r.getState(w).activeEnvironmentId
    const effective = new Map(this.r.listVariables(w, null).map(v => [v.key, v]))
    if (selected) for (const v of this.r.listVariables(w, selected)) effective.set(v.key, v)
    return variableSnapshotSchema.parse({ workspaceId: w, environmentId: scope, items: this.r.listVariables(w, scope).map(v => this.item(v)), effective: [...effective.values()].map(v => this.item(v)) })
  }
  createEnvironment(w: string, name: string) { [w, name] = environmentInputs.create.parse([w, name]); return this.secrets.transaction(() => { this.active(w); if (this.r.listEnvironments(w).length >= LIMITS.environments) throw new RepositoryError('VALIDATION'); this.r.createEnvironment(w, name); return this.environments(w) }) }
  renameEnvironment(w: string, id: string, name: string) { [w, id, name] = environmentInputs.rename.parse([w, id, name]); return this.secrets.transaction(() => { this.active(w); this.r.renameEnvironment(w, id, name); return this.environments(w) }) }
  deleteEnvironment(w: string, id: string) { [w, id] = environmentInputs.delete.parse([w, id]); return this.secrets.transaction(() => { this.active(w); this.r.deleteEnvironment(w, id); return this.environments(w) }) }
  select(w: string, id: string | null) { [w, id] = environmentInputs.select.parse([w, id]); return this.secrets.transaction(() => { this.active(w); if (id) this.r.getEnvironment(w, id); const state = this.r.getState(w); this.r.setState(w, id, state.selectedRequestId); return this.environments(w) }) }
  upsert(w: string, scope: string | null, key: string, value: string, sensitive: boolean, id?: string | null) {
    [w, scope, key, value, sensitive, id] = variableInputs.upsert.parse([w, scope, key, value, sensitive, id])
    return this.secrets.transaction(() => {
      this.active(w); if (scope) this.r.getEnvironment(w, scope)
      const old = this.r.listVariables(w, scope).find(v => v.key === key)
      if (id) { const owned = this.r.getVariable(w, id); if (owned.environmentId !== scope || owned.key !== key) throw new RepositoryError('NOT_FOUND') }
      if ((old && old.id !== id) || (id && !old)) throw new RepositoryError('VALIDATION')
      if (sensitive) {
        const handle = old?.secretId ? this.secrets.update(w, old.secretId, value) : this.secrets.create(w, value)
        this.r.upsertVariable(w, scope, key, { isSensitive: true, plainValue: null, secretId: handle.secretId })
      } else this.r.upsertVariable(w, scope, key, { isSensitive: false, plainValue: value, secretId: null })
      return this.list(w, scope)
    })
  }
  delete(w: string, id: string) { return this.secrets.transaction(() => { this.active(w); const v = this.r.getVariable(w, id); this.r.deleteVariable(w, id); return this.list(w, v.environmentId) }) }
  reveal(w: string, id: string) { this.active(w); const v = this.r.getVariable(w, id); return { value: v.isSensitive ? this.secrets.reveal(w, v.secretId) : v.plainValue } }
}
