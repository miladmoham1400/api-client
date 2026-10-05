import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

// Refuse cross-builds before touching outputs: they cannot verify Windows SQLite.
if (process.platform !== 'win32' || process.arch !== 'x64') {
  process.stderr.write('package:win requires a native Windows x64 host. No outputs were changed.\n')
  process.exit(1)
}

const root = fileURLToPath(new URL('..', import.meta.url))
for (const relative of ['out', 'dist/windows']) {
  rmSync(resolve(root, relative), { recursive: true, force: true })
}

// Invoke installed JavaScript CLIs directly, avoiding Bash and .cmd shell quoting.
for (const [cli, args] of [
  ['typescript/bin/tsc', ['--noEmit']],
  ['electron-vite/bin/electron-vite.js', ['build']],
  ['electron-builder/cli.js', ['--config', 'electron-builder.windows.json', '--win', 'nsis', '--x64', '--publish', 'never']]
]) {
  const result = spawnSync(process.execPath, [resolve(root, 'node_modules', cli), ...args], {
    cwd: root,
    stdio: 'inherit'
  })
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}
