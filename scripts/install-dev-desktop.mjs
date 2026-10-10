import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'

// Developer-only registration; packaged startup never writes desktop entries.
if (process.platform === 'linux') {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const npmCli = process.env.npm_execpath
  if (!npmCli || !isAbsolute(npmCli) || !existsSync(npmCli)) throw new Error('Run via npm run desktop:install-dev')
  const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
  if (!isAbsolute(dataHome)) throw new Error('XDG_DATA_HOME must be absolute')
  const file = join(dataHome, 'applications', 'offline-api-client-dev.desktop')
  const marker = 'X-Offline-API-Client-Dev=true'
  if (existsSync(file) && !readFileSync(file, 'utf8').split('\n').includes(marker)) throw new Error(`Refusing to overwrite an unrelated desktop entry: ${file}`)
  const value = text => text.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\t', '\\t')
  // Desktop Exec has its own quoting rules; it is not a shell command.
  const arg = text => value('"' + text.replaceAll('%', '%%').replace(/["\\$`]/g, character => '\\' + character) + '"')
  const exec = ['/usr/bin/env', `PATH=${dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin`, process.execPath, npmCli, 'run', 'dev'].map(arg).join(' ')
  const entry = `[Desktop Entry]\nType=Application\nName=Offline API Client (Development)\nComment=Run the local source checkout\nExec=${exec}\nPath=${value(root)}\nIcon=${value(join(root, 'build', 'icon.png'))}\nTerminal=true\nCategories=Development;\nStartupWMClass=offline-api-client-dev\n${marker}\n`
  mkdirSync(dirname(file), { recursive: true })
  if (!existsSync(file) || readFileSync(file, 'utf8') !== entry) writeFileSync(file, entry, { mode: 0o644 })
  process.stdout.write(`Development desktop icon registered: ${file}\n`)
}
