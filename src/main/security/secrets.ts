import type Database from 'better-sqlite3'
import { Repositories, RepositoryError } from '../db/repositories'
import { limitedText } from '../../shared/primitives'
import type { RequestSecretChange, RequestSecretLifecycle } from '../services/requests'

export interface StorageBackend {
  isEncryptionAvailable(): boolean
  getSelectedStorageBackend(): string
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}
export class SecretStore implements RequestSecretLifecycle {
  private readonly r: Repositories
  private session = new Map<string, { workspace: string; value: string }>()
  private staging = false
  constructor(private readonly db: Database.Database, private readonly backend: StorageBackend, private readonly platform: string) { this.r = new Repositories(db) }
  capability(): 'secure' | 'session' {
    try {
      return this.backend.isEncryptionAvailable() && (this.platform !== 'linux' || !['basic_text', 'unknown'].includes(this.backend.getSelectedStorageBackend())) ? 'secure' : 'session'
    } catch { return 'session' }
  }
  /** Pair owner changes and memory changes; publish session values only after SQLite commits. */
  transaction<T>(operation: () => T): T {
    if (this.staging) return operation()
    if (this.db.inTransaction) throw new RepositoryError('DATABASE_WRITE_FAILED')
    const previous = this.session
    this.session = new Map(previous); this.staging = true
    try { return this.db.transaction(() => {
      const result = operation()
      for (const [id, entry] of this.session) {
        try { this.r.getSecret(entry.workspace, id) } catch (error) { if (error instanceof RepositoryError && error.code === 'NOT_FOUND') this.session.delete(id); else throw error }
      }
      return result
    }).immediate() }
    catch (error) { this.session = previous; if (error instanceof RepositoryError) throw error; throw new RepositoryError('DATABASE_WRITE_FAILED') }
    finally { this.staging = false }
  }
  private encoded(value: string) {
    const parsed = limitedText().safeParse(value)
    if (!parsed.success) throw new RepositoryError('VALIDATION')
    value = parsed.data
    const storageMode = this.capability()
    if (storageMode === 'session') return { storageMode, encryptedValue: null }
    try { return { storageMode, encryptedValue: this.backend.encryptString(value) } }
    catch { throw new RepositoryError('SECRET_UNAVAILABLE') }
  }
  create(workspace: string, value: string) {
    return this.transaction(() => {
      this.r.getWorkspace(workspace)
      const encoded = this.encoded(value), record = this.r.createSecret(workspace, encoded.storageMode, encoded.encryptedValue)
      if (record.storageMode === 'session') this.session.set(record.id, { workspace, value })
      return { secretId: record.id, storageMode: record.storageMode }
    })
  }
  update(workspace: string, id: string, value: string) {
    return this.transaction(() => {
      this.r.getSecret(workspace, id)
      const encoded = this.encoded(value), record = this.r.updateSecret(workspace, id, encoded.storageMode, encoded.encryptedValue)
      this.session.delete(id)
      if (record.storageMode === 'session') this.session.set(id, { workspace, value })
      return { secretId: record.id, storageMode: record.storageMode }
    })
  }
  unresolved(workspace: string) { return this.transaction(() => ({ secretId: this.r.createSecret(workspace, 'session', null).id, storageMode: 'session' as const })) }
  reveal(workspace: string, id: string): string {
    const record = this.r.getSecret(workspace, id)
    if (record.storageMode === 'session') {
      const entry = this.session.get(id)
      if (!entry || entry.workspace !== workspace) throw new RepositoryError('SECRET_UNAVAILABLE')
      return entry.value
    }
    if (this.capability() !== 'secure' || !record.encryptedValue) throw new RepositoryError('SECRET_UNAVAILABLE')
    try { return limitedText().parse(this.backend.decryptString(record.encryptedValue)) }
    catch { throw new RepositoryError('SECRET_UNAVAILABLE') }
  }
  presence(workspace: string, id: string) {
    const record = this.r.getSecret(workspace, id)
    const hasValue = record.storageMode === 'secure' ? this.capability() === 'secure' : this.session.get(id)?.workspace === workspace
    return { hasValue, maskedDisplay: '••••••••' as const, storageMode: record.storageMode }
  }
  delete(workspace: string, id: string) { return this.transaction(() => { this.r.deleteSecret(workspace, id); this.session.delete(id) }) }
  forgetWorkspace(workspace: string) { for (const [id, entry] of this.session) if (entry.workspace === workspace) this.session.delete(id) }
  clear() { this.session.clear() }
  prepareRemoveSessionValues(workspace: string, ids: readonly string[]): RequestSecretChange {
    for (const id of ids) this.r.getSecret(workspace, id)
    return { commit: () => { for (const id of ids) this.session.delete(id) }, rollback: () => {} }
  }
  prepareDuplicateSessionValues(workspace: string, copies: readonly { sourceId: string; id: string }[]): RequestSecretChange {
    const pending: { id: string; value?: string }[] = []
    for (const copy of copies) {
      this.r.getSecret(workspace, copy.id)
      const source = this.r.getSecret(workspace, copy.sourceId)
      let value: string
      try { value = this.reveal(workspace, copy.sourceId) }
      catch (error) {
        // A missing session value remains missing in its independent copy.
        if (source.storageMode !== 'session' || !(error instanceof RepositoryError) || error.code !== 'SECRET_UNAVAILABLE') throw error
        this.r.updateSecret(workspace, copy.id, 'session', null); pending.push({ id: copy.id }); continue
      }
      const encoded = this.encoded(value)
      this.r.updateSecret(workspace, copy.id, encoded.storageMode, encoded.encryptedValue)
      pending.push({ id: copy.id, ...(encoded.storageMode === 'session' ? { value } : {}) })
    }
    return { commit: () => { for (const entry of pending) { this.session.delete(entry.id); if (entry.value !== undefined) this.session.set(entry.id, { workspace, value: entry.value }) } }, rollback: () => {} }
  }
}
