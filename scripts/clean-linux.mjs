import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
// Remove generated Linux output only; never touch application userData.
const root = fileURLToPath(new URL('..', import.meta.url))
for (const relative of ['out', 'dist/linux']) rmSync(resolve(root, relative), { recursive: true, force: true })
