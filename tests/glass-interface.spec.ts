import { test, expect } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'

test('glass workbench remains usable in both themes, small windows and dialogs; theme survives restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-glass-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  let sends = 0
  const fixture = await startFixture(false, (req, res) => {
    sends++; req.resume()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true, data: { id: 42, name: 'Alex Morgan', email: 'alex@example.test', role: 'developer', permissions: ['read:users', 'write:users'] }, meta: { version: 'v1', region: 'local' } }))
  })
  let app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
  try {
    let page = await app.firstWindow()
    await expect(page.locator('html')).toHaveClass('dark')
    await page.evaluate(async url => {
      const api = window.offlineApi
      const workspace = await api.workspaces.create('Development')
      if (!workspace.ok || !workspace.data.selectedWorkspaceId) throw new Error('Workspace fixture failed')
      const id = workspace.data.selectedWorkspaceId
      await api.collections.create(id, 'Acme API')
      let library = await api.library.list(id)
      if (!library.ok) throw new Error('Library fixture failed')
      const collectionId = library.data.collections[0]!.id
      await api.folders.create(id, collectionId, null, 'Authentication')
      await api.folders.create(id, collectionId, null, 'Users')
      library = await api.library.list(id)
      if (!library.ok) throw new Error('Library fixture failed')
      const folderId = library.data.folders.find(f => f.name === 'Authentication')!.id
      for (const [name, method] of [['List users', 'GET'], ['Update profile', 'PATCH'], ['Delete user', 'DELETE']] as const) {
        await api.requests.create(id, { name, method, urlTemplate: url, collectionId, folderId: library.data.folders.find(f => f.name === 'Users')!.id, body: { kind: 'none' }, auth: { mode: 'none' } })
      }
      await api.requests.create(id, { name: 'Create session', method: 'POST', urlTemplate: url + '/v1/auth/login', collectionId, folderId, body: { kind: 'json', text: '{\n  "email": "alex@example.test",\n  "password": "{{password}}"\n}' }, auth: { mode: 'none' } })
      await api.library.setExpansion(id, { expandedCollectionIds: [collectionId], expandedFolderIds: library.data.folders.map(f => f.id) })
    }, fixture.url)
    await page.reload()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Create session')
    await page.getByRole('region', { name: 'Request editor', exact: true }).getByRole('tab', { name: 'Body', exact: true }).click()
    const response = page.getByRole('region', { name: 'Response', exact: true })
    await expect(response).toContainText('Your response, right here')
    const material = await response.evaluate(element => ({ blur: getComputedStyle(element).backdropFilter, background: getComputedStyle(element).backgroundColor }))
    expect(material.blur).toContain('blur')
    expect(material.background).toContain('rgba')
    await page.screenshot({ path: '/tmp/api-client-glass-dark-empty.png', animations: 'disabled' })
    expect(sends).toBe(0)
    // Use a non-secret body to keep the fixture independent from variable configuration.
    await expect(page.getByLabel('JSON source text', { exact: true })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await page.getByLabel('JSON source text', { exact: true }).fill('{\n  "email": "alex@example.test",\n  "remember": true\n}')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(response.getByLabel('Response metrics')).toContainText('200')
    await expect(response).toContainText('Alex Morgan')
    for (const theme of ['dark', 'light'] as const) {
      await page.getByLabel('Theme', { exact: true }).selectOption(theme)
      await expect(page.locator('html')).toHaveClass(theme)
      await expect(page.getByLabel('Theme', { exact: true })).toBeEnabled()
      await page.screenshot({ path: `/tmp/api-client-glass-${theme}.png`, animations: 'disabled' })
      await page.setViewportSize({ width: 1000, height: 700 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeInViewport()
      await expect(response.getByLabel('Response metrics')).toBeInViewport()
      await page.screenshot({ path: `/tmp/api-client-glass-${theme}-compact.png`, animations: 'disabled' })
      await page.getByRole('button', { name: 'Create Collection', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Create collection', exact: true })
      await expect(dialog.getByLabel('Collection name')).toBeFocused()
      await dialog.getByLabel('Collection name').fill('New collection')
      await page.screenshot({ path: `/tmp/api-client-glass-${theme}-dialog.png`, animations: 'disabled' })
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.setViewportSize({ width: 1280, height: 720 })
    }
    expect(sends).toBe(1)
    await page.getByLabel('Theme', { exact: true }).selectOption('dark')
    await expect(page.getByLabel('Theme', { exact: true })).toBeEnabled()
    await app.close()
    app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
    page = await app.firstWindow()
    await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('dark')
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Create session')
    expect(sends).toBe(1)
    expect(await page.evaluate(() => performance.getEntriesByType('resource').every(e => e.name.startsWith('file:') || e.name.startsWith('data:')))).toBe(true)
  } finally { await shutdown(app); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})
