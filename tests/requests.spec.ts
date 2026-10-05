import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

test('explicit Save/Ctrl+S persists independent drafts; failed save, duplicate and delete are safe', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-request-ui-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  let application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
  try {
    let page = await application.firstWindow()
    await page.getByRole('button', { name: 'Create Workspace', exact: true }).click()
    let dialog = page.getByRole('dialog', { name: 'Create workspace', exact: true })
    await dialog.getByLabel('Workspace name').fill('Request workspace')
    await dialog.getByRole('button', { name: 'Create workspace', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    const workspace = await page.evaluate(() => window.offlineApi.workspaces.list())
    if (!workspace.ok || !workspace.data.selectedWorkspaceId) throw new Error('Missing workspace')
    const id = workspace.data.selectedWorkspaceId
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    await expect(page.getByLabel('HTTP method', { exact: true })).toHaveValue('GET')
    await expect(page.getByLabel('Request URL', { exact: true })).toHaveValue('')
    expect(await page.evaluate(workspace => window.offlineApi.requests.list(workspace), id)).toMatchObject({ ok: true, data: { requests: [], editor: null } })
    await page.getByLabel('Request name', { exact: true }).fill('Echo')
    await page.getByLabel('HTTP method', { exact: true }).selectOption('POST')
    await page.getByLabel('Request URL', { exact: true }).fill('{{base_url}}/echo')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()
    const saved = await page.evaluate(workspace => window.offlineApi.requests.list(workspace), id)
    if (!saved.ok || !saved.data.editor) throw new Error('Missing saved request')
    const requestId = saved.data.editor.id
    await page.getByLabel('Request URL', { exact: true }).fill('http://127.0.0.1/unsaved')
    await expect(page.getByLabel('Workspace', { exact: true })).toBeEnabled()
    expect(await page.evaluate(workspace => window.offlineApi.requests.list(workspace), id)).toEqual(saved)
    await application.evaluate(({ app }) => {
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`)
      const Driver: typeof import('better-sqlite3') = load('better-sqlite3'), db = new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try { db.exec("CREATE TRIGGER fail_request_save BEFORE UPDATE ON requests BEGIN SELECT RAISE(ABORT,'synthetic private failure'); END;") } finally { db.close() }
    })
    await page.getByLabel('Request URL', { exact: true }).focus()
    await page.keyboard.press('Control+s')
    await expect(page.getByRole('alert')).toContainText('draft has been kept')
    await expect(page.getByLabel('Request URL', { exact: true })).toHaveValue('http://127.0.0.1/unsaved')
    expect(await page.evaluate(workspace => window.offlineApi.requests.list(workspace), id)).toEqual(saved)
    await application.evaluate(({ app }) => {
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`)
      const Driver: typeof import('better-sqlite3') = load('better-sqlite3'), db = new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try { db.exec('DROP TRIGGER fail_request_save') } finally { db.close() }
    })
    await page.keyboard.press('Control+s')
    await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()
    await page.getByLabel('Request name', { exact: true }).fill('Not saved')
    await page.getByRole('button', { name: 'Discard edits', exact: true }).click()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Echo')
    await page.getByRole('button', { name: 'Duplicate saved request', exact: true }).click()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Echo (copy)')
    const copy = await page.evaluate(workspace => window.offlineApi.requests.list(workspace), id)
    if (!copy.ok || !copy.data.editor) throw new Error('Missing copy')
    expect(copy.data.editor.id).not.toBe(requestId)
    await expect(page.getByRole('region', { name: 'Response', exact: true })).toContainText('No response')
    await page.screenshot({ path: '/tmp/api-client-requests.png' })
    await application.close()
    application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
    page = await application.firstWindow()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Echo (copy)')
    await expect(page.getByLabel('HTTP method', { exact: true })).toHaveValue('POST')
    await expect(page.getByLabel('Request URL', { exact: true })).toHaveValue('http://127.0.0.1/unsaved')
    await page.getByRole('button', { name: 'Delete request', exact: true }).click()
    dialog = page.getByRole('dialog', { name: 'Delete request', exact: true })
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Echo (copy)')
    await page.getByRole('button', { name: 'Delete request', exact: true }).click()
    await dialog.getByRole('button', { name: 'Delete permanently', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'No request selected', exact: true })).toBeVisible()
    await page.getByRole('group', { name: 'Request: Echo', exact: true }).getByRole('button', { name: 'Echo', exact: true }).click()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Echo')
    const remaining = await page.evaluate(workspace => window.offlineApi.requests.list(workspace), id)
    expect(remaining.ok && remaining.data.requests.map(request => request.id)).toEqual([requestId])
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled()
  } finally { await shutdown(application); rmSync(directory, { recursive: true, force: true }) }
})
