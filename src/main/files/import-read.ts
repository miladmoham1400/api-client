import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import { LIMITS } from '../../shared/primitives'
import { RepositoryError } from '../db/repositories'
export const IMPORT_MAX_BYTES = LIMITS.importBytes
/** Only a main-owned native chooser supplies the path. Never follow paths from JSON. */
export async function readImport(path: string): Promise<Buffer> {
  const file = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0))
  try {
    const stat = await file.stat()
    if (!stat.isFile()) throw new RepositoryError('INVALID_IMPORT')
    if (stat.size > IMPORT_MAX_BYTES) throw new RepositoryError('IMPORT_TOO_LARGE')
    const bytes = Buffer.alloc(IMPORT_MAX_BYTES + 1)
    let size = 0
    while (size < bytes.length) {
      const read = await file.read(bytes, size, bytes.length - size, null)
      if (!read.bytesRead) break
      size += read.bytesRead
    }
    if (size > IMPORT_MAX_BYTES) throw new RepositoryError('IMPORT_TOO_LARGE')
    return bytes.subarray(0, size)
  } finally { await file.close() }
}
