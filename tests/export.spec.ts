import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron, expect, test } from '@playwright/test'
import { workspaceExportSchema } from '../src/shared/transfer'
import { shutdown } from './fixtures/shutdown'

const execute = promisify(execFile)
test('native workspace export/cancel preserves saved configuration, omissions and unsaved editor; destination errors retain data', async () => {
  test.skip(process.platform !== 'linux' || !process.env.DISPLAY, 'Native chooser helper is Linux X11 only; other platforms remain unverified')
  const directory = mkdtempSync(join(tmpdir(), 'api-client-export-ui-')), destination = join(directory, 'workspace.json')
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  const application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
    const workspace = await page.evaluate(async () => {
      const api = window.offlineApi, created = await api.workspaces.create('Export fixture')
      if (!created.ok || !created.data.selectedWorkspaceId) throw new Error('Missing workspace')
      const w = created.data.selectedWorkspaceId
      await api.variables.upsert(w, null, 'token', 'synthetic-export-variable-secret', true)
      await api.variables.upsert(w, null, 'plain', 'ordinary-visible', false)
      const row = await api.requests.newRow(w)
      if (!row.ok) throw new Error('Missing row')
      const made = await api.requests.create(w, { name: 'Saved fixture', method: 'POST', urlTemplate: 'http://127.0.0.1/saved', collectionId: null,
        headerRows: [{ ...row.data, key: 'Authorization', value: 'synthetic-export-header-secret', enabled: false }],
        body: { kind: 'multipart', rows: [{ id: row.data.id, key: 'upload', kind: 'file', enabled: true, fileName: 'fixture.txt', fileSize: 12 }] },
        auth: { mode: 'basic', username: { kind: 'value', value: 'synthetic-export-user-secret' }, password: { kind: 'value', value: 'synthetic-export-password-secret{{token}}' } } })
      if (!made.ok) throw new Error('Missing request')
      return w
    })
    await page.reload()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Saved fixture')
    await page.getByLabel('Request name', { exact: true }).fill('Unsaved draft stays here')
    const saved = await page.evaluate(w => window.offlineApi.requests.list(w), workspace)
    const secrets = await application.evaluate(({ app }) => {
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`)
      const Driver: typeof import('better-sqlite3') = load('better-sqlite3'), db = new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try { return { bytes: Array.from(db.serialize()), rows: db.prepare('SELECT id FROM secrets').all() } } finally { db.close() }
    })
    async function openExport() {
      await page.getByRole('button', { name: 'Workspace menu', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Export workspace JSON', exact: true }).click()
      return page.getByRole('dialog', { name: 'Export workspace JSON', exact: true })
    }
    let warning = await openExport()
    await expect(warning.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
    await expect(warning).toContainText('Unsaved request edits are not included')
    await expect(warning).toContainText('Review the JSON before sharing')
    await page.screenshot({ path: '/tmp/api-client-export-warning.png', animations: 'disabled' })
    await warning.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Workspace menu', exact: true })).toBeFocused()
    expect(readdirSync(directory)).not.toContain('workspace.json')
    warning = await openExport()
    await warning.getByRole('button', { name: 'Choose save location', exact: true }).click()
    await execute('python3', ['tests/fixtures/native-upload-dialog.py', 'cancel', 'Export workspace JSON'], { timeout: 15_000 })
    await expect(warning).not.toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /^Export cancelled\.$/ })).toBeVisible()
    expect(readdirSync(directory)).not.toContain('workspace.json')
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Unsaved draft stays here')
    warning = await openExport()
    await warning.getByRole('button', { name: 'Choose save location', exact: true }).click()
    await execute('python3', ['tests/fixtures/native-upload-dialog.py', destination, 'Export workspace JSON'], { timeout: 15_000 })
    await expect(warning).not.toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /^Workspace exported\.$/ })).toBeVisible()
    const bytes = readFileSync(destination, 'utf8'), dto = workspaceExportSchema.parse(JSON.parse(bytes))
    expect(dto.workspace.requests[0]).toMatchObject({ name: 'Saved fixture', config: { headerRows: [{ key: 'Authorization', value: '', enabled: false }], auth: { mode: 'basic', usernameTemplate: '', passwordTemplate: '', requiresCredentials: true }, body: { kind: 'multipart', rows: [{ fileName: 'fixture.txt', fileSize: 12, requiresSelection: true }] } } })
    expect(dto.workspace.variables).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'token', isSensitive: true, requiresValue: true }), expect.objectContaining({ key: 'plain', value: 'ordinary-visible', requiresValue: false })]))
    for (const value of ['synthetic-export-variable-secret', 'synthetic-export-header-secret', 'synthetic-export-user-secret', 'synthetic-export-password-secret', directory, 'secretId', 'fileId', 'response', 'activeEnvironmentId', 'selectedRequestId']) expect(bytes).not.toContain(value)
    for (const row of secrets.rows) { if (!row || typeof row !== 'object' || typeof Reflect.get(row, 'id') !== 'string') throw new Error('Invalid synthetic row'); expect(bytes).not.toContain(Reflect.get(row, 'id') as string) }
    expect(await page.evaluate(w => window.offlineApi.requests.list(w), workspace)).toEqual(saved)
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Unsaved draft stays here')
    const userData = await application.evaluate(({ app }) => app.getPath('userData'))
    warning = await openExport()
    await warning.getByRole('button', { name: 'Choose save location', exact: true }).click()
    await execute('python3', ['tests/fixtures/native-upload-dialog.py', join(userData, 'blocked.json'), 'Export workspace JSON'], { timeout: 15_000 })
    await expect(warning.getByRole('alert')).toContainText('outside application and data folders')
    expect(readdirSync(userData)).not.toContain('blocked.json')
    await warning.getByRole('button', { name: 'Cancel', exact: true }).click()
    const after = await application.evaluate(({ app }) => {
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`)
      const Driver: typeof import('better-sqlite3') = load('better-sqlite3'), db = new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try { return Array.from(db.serialize()) } finally { db.close() }
    })
    expect(after).toEqual(secrets.bytes)
    expect(readdirSync(directory).filter(value => value.endsWith('.tmp'))).toEqual([])
  } finally { await shutdown(application); rmSync(directory, { recursive: true, force: true }) }
})
