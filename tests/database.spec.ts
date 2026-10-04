import { _electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

test('native SQLite loads in Electron, reopens saved data and reports corrupt startup without replacement', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-native-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  let application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
    expect((await page.evaluate(() => window.offlineApi.app.getBootstrap())).ok).toBe(true)
    const id = randomUUID()
    const location = await application.evaluate(({ app }) => `${app.getPath('userData')}/offline-api-client.sqlite`)
    expect(location.startsWith(directory)).toBe(true)
    const evidence = await application.evaluate(({ app }, id) => {
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`)
      const Driver: typeof import('better-sqlite3') = load('better-sqlite3')
      const db = new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try {
        const stamp = new Date().toISOString()
        db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?)').run(id, 'Synthetic persistent row', stamp, stamp)
        return { ledger: db.prepare('SELECT version FROM schema_migrations').all(), abi: process.versions.modules }
      } finally { db.close() }
    }, id)
    expect(evidence.ledger).toEqual([{ version: 1 }])
    expect(evidence.abi).toBe('149')
    await application.close()
    application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
    await application.firstWindow()
    expect(await application.evaluate(({ app }) => {
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`)
      const Driver: typeof import('better-sqlite3') = load('better-sqlite3')
      const db = new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try { return db.prepare('SELECT id FROM workspaces').all() } finally { db.close() }
    })).toEqual([{ id }])
    await application.close()
    const corrupt = Buffer.from('synthetic corrupt database with <script>not executable</script>')
    writeFileSync(location, corrupt)
    application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
    const recovery = await application.firstWindow()
    await expect(recovery.getByRole('heading', { name: 'Database unavailable' })).toBeVisible()
    await expect(recovery.getByRole('alert')).toContainText('Database location:')
    const result = await recovery.evaluate(() => window.offlineApi.app.getBootstrap())
    expect(result.ok && result.data.database.status).toBe('unavailable')
    expect(result.ok && result.data.capabilities.database).toBe(false)
    expect(readFileSync(location)).toEqual(corrupt)
  } finally {
    await application.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
