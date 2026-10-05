import { randomUUID } from 'node:crypto'
import { closeSync, constants, fstatSync, openSync, read } from 'node:fs'
import { basename } from 'node:path'
import { runtimeBodySchema } from '../../shared/request-config'
import { LIMITS, uuidSchema } from '../../shared/primitives'
import { uploadSelectionSchema, type UploadSelection } from '../../shared/files'
import type { DomainError, ErrorCode, FieldPath } from '../../shared'

export class UploadError extends Error {
  constructor(readonly code: ErrorCode, readonly field?: FieldPath) { super('Upload unavailable') }
  dto(): DomainError {
    const message = this.code === 'FILE_TOO_LARGE' ? 'Selected files exceed the upload limit' :
      this.code === 'FILE_CHANGED' ? 'File changed or is no longer readable. Select it again.' :
      this.code === 'FILE_REQUIRED' ? 'Select a file again' : 'Operation unavailable'
    return { code: this.code, message, retryable: false, ...(this.field ? { field: this.field } : {}) }
  }
}
interface Capability { workspace: string; path: string; size: number }
// Main-only descriptors. The caller must close the entire batch on every terminal path.
export interface UploadLease { readonly rowId: string; readonly name: string; readonly size: number; readonly fd: number; stream(): AsyncIterable<Uint8Array>; close(): void }
export class UploadService {
  #files = new Map<string, Capability>()
  #epoch = 0
  #workspaceEpoch = new Map<string, number>()
  constructor(private readonly assertWorkspace: (workspace: string) => void) {}
  clear() { this.#files.clear(); this.#workspaceEpoch.clear(); this.#epoch++ }
  forgetWorkspace(workspace: string) {
    for (const [id, file] of this.#files) if (file.workspace === workspace) this.#files.delete(id)
    this.#workspaceEpoch.set(workspace, (this.#workspaceEpoch.get(workspace) ?? 0) + 1)
  }
  async choose(workspace: string, choosePath: () => Promise<string | null>): Promise<UploadSelection | null> {
    workspace = uuidSchema.parse(workspace); this.assertWorkspace(workspace)
    const epoch = this.#epoch, workspaceEpoch = this.#workspaceEpoch.get(workspace)
    const path = await choosePath()
    if (epoch !== this.#epoch || workspaceEpoch !== this.#workspaceEpoch.get(workspace)) throw new UploadError('FILE_REQUIRED')
    this.assertWorkspace(workspace)
    if (path === null) return null
    const fd = this.open(path)
    try {
      const size = fstatSync(fd).size
      const selection = uploadSelectionSchema.parse({ fileId: randomUUID(), name: basename(path), size })
      this.#files.set(selection.fileId, { workspace, path, size })
      return selection
    } finally { closeSync(fd) }
  }
  release(workspace: string, id: string): null {
    workspace = uuidSchema.parse(workspace); id = uuidSchema.parse(id)
    this.lookup(workspace, id)
    this.#files.delete(id)
    return null
  }
  private lookup(workspace: string, id: string): Capability {
    this.assertWorkspace(uuidSchema.parse(workspace))
    const file = this.#files.get(uuidSchema.parse(id))
    if (!file || file.workspace !== workspace) throw new UploadError('FILE_REQUIRED')
    return file
  }
  private open(path: string, expectedSize?: number, field?: FieldPath): number {
    let fd: number | undefined
    try {
      // Nonblocking open avoids hanging on a FIFO substituted after selection on POSIX.
      fd = openSync(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0))
      const stat = fstatSync(fd)
      if (!stat.isFile()) throw new UploadError('FILE_CHANGED', field)
      if (stat.size > LIMITS.fileBytes) throw new UploadError('FILE_TOO_LARGE', field)
      if (expectedSize !== undefined && stat.size !== expectedSize) throw new UploadError('FILE_CHANGED', field)
      return fd
    } catch (error) {
      if (fd !== undefined) closeSync(fd)
      throw error instanceof UploadError ? error : new UploadError('FILE_CHANGED', field)
    }
  }
  // TASK-022 must call this before connecting and keep these descriptors private to main.
  captureForSend(workspace: string, body: unknown): () => UploadLease[] {
    const parsed = runtimeBodySchema.parse(body), captured = new Map<string, Capability>()
    this.assertWorkspace(uuidSchema.parse(workspace))
    if (parsed.kind === 'multipart') parsed.rows.forEach((row, index) => {
      if (row.kind !== 'file' || !row.enabled) return
      const field: FieldPath = `body.rows[${index}].fileId`
      if (!row.fileId) throw new UploadError('FILE_REQUIRED', field)
      try { captured.set(row.fileId, { ...this.lookup(workspace, row.fileId) }) }
      catch (error) { if (error instanceof UploadError) throw new UploadError(error.code, field); throw error }
    })
    // Row edits/reselection may release the draft capability without mutating an accepted execution.
    return () => this.openRows(workspace, parsed, (_workspace, id) => {
      const file = captured.get(id)
      if (!file) throw new UploadError('FILE_REQUIRED')
      return file
    })
  }
  openForSend(workspace: string, body: unknown): UploadLease[] {
    return this.openRows(workspace, body, (w, id) => this.lookup(w, id))
  }
  private openRows(workspace: string, body: unknown, lookup: (workspace: string, id: string) => Capability): UploadLease[] {
    workspace = uuidSchema.parse(workspace); this.assertWorkspace(workspace)
    const parsed = runtimeBodySchema.parse(body), leases: UploadLease[] = []
    if (parsed.kind !== 'multipart') return leases
    let total = 0
    try {
      parsed.rows.forEach((row, index) => {
        if (row.kind !== 'file' || !row.enabled) return
        const field: FieldPath = `body.rows[${index}].fileId`
        if (!row.fileId) throw new UploadError('FILE_REQUIRED', field)
        let file: Capability
        try { file = lookup(workspace, row.fileId) }
        catch (error) { if (error instanceof UploadError) throw new UploadError(error.code, field); throw error }
        const fd = this.open(file.path, file.size, field)
        let closing = false, closed = false, pending = false, used = false
        const close = () => { closing = true; if (!closed && !pending) { closed = true; closeSync(fd) } }
        leases.push({ rowId: row.id, name: basename(file.path), size: file.size, fd, close,
          async *stream() {
            if (used || closing) throw new UploadError('FILE_CHANGED', field)
            used = true
            let position = 0
            try {
              while (position < file.size) {
                if (closing) return
                const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, file.size - position))
                pending = true
                let count: number
                try { count = await new Promise<number>((resolve, reject) => read(fd, buffer, 0, buffer.length, position, (error, bytes) => error ? reject(error) : resolve(bytes))) }
                finally { pending = false; if (closing) close() }
                if (closing) return
                if (count === 0) throw new UploadError('FILE_CHANGED', field)
                position += count
                yield buffer.subarray(0, count)
              }
              if (!closing && fstatSync(fd).size !== file.size) throw new UploadError('FILE_CHANGED', field)
            } catch { throw new UploadError('FILE_CHANGED', field) }
          } })
        total += file.size
        if (total > LIMITS.selectedFileBytes) throw new UploadError('FILE_TOO_LARGE', field)
      })
      return leases
    } catch (error) { for (const lease of leases) lease.close(); throw error }
  }
}
