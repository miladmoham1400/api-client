import { randomUUID } from 'node:crypto'
import { lstat, open, realpath, rename, rm } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

export class ExportFileError extends Error {
  constructor(readonly code: 'VALIDATION' | 'EXPORT_WRITE_FAILED') { super('Workspace export could not be written') }
}
const inside = (path: string, root: string) => { const rel = relative(root, path); return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)) }
async function existing(path: string) {
  try { return await lstat(path) }
  catch (error) { if (error && typeof error === 'object' && Reflect.get(error, 'code') === 'ENOENT') return null; throw error }
}
/** The destination comes only from the main-owned native save dialog. */
export async function writeExportFile(destination: string, json: string, protectedRoots: string[], authorized: () => boolean, commit = rename): Promise<void> {
  let temporary: string | null = null
  try {
    if (!isAbsolute(destination) || extname(destination).toLowerCase() !== '.json') throw new ExportFileError('VALIDATION')
    const parent = await realpath(dirname(destination)), target = join(parent, basename(destination))
    for (const root of protectedRoots) {
      // Canonical and lexical checks also protect aliased application/data directories.
      const canonical = await realpath(root).catch(() => resolve(root))
      if (inside(target, resolve(root)) || inside(target, canonical)) throw new ExportFileError('VALIDATION')
    }
    const previous = await existing(target)
    if (previous && (!previous.isFile() || previous.isSymbolicLink())) throw new ExportFileError('VALIDATION')
    if (previous) {
      const file = await open(target, 'r')
      try {
        const signature = Buffer.alloc(16)
        await file.read(signature, 0, 16, 0)
        if (signature.equals(Buffer.from('SQLite format 3\0'))) throw new ExportFileError('VALIDATION')
      } finally { await file.close() }
    }
    if (!authorized()) throw new ExportFileError('VALIDATION')
    temporary = join(parent, `.offline-api-client-export-${randomUUID()}.tmp`)
    const file = await open(temporary, 'wx', 0o600)
    try { await file.writeFile(json, 'utf8'); await file.sync() } finally { await file.close() }
    if (!authorized()) throw new ExportFileError('VALIDATION')
    await commit(temporary, target)
  } catch (error) { throw error instanceof ExportFileError ? error : new ExportFileError('EXPORT_WRITE_FAILED') }
  finally { if (temporary) await rm(temporary, { force: true }).catch(() => {}) }
}
