import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'

test('twenty explicitly saved requests remain independently selectable, grouped and sendable after normal reopen', async () => {
  test.setTimeout(90_000)
  const received: { method: string | undefined; url: string | undefined; body: string }[] = []
  const fixture = await startFixture(false, (request, response) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => { body += chunk })
    request.on('end', () => {
      const record = { method: request.method, url: request.url, body }
      received.push(record)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(record))
    })
  })
  const directory = mkdtempSync(join(tmpdir(), 'api-client-multi-request-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  let application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
  try {
    let page = await application.firstWindow()
    await page.getByRole('button', { name: 'Create Workspace', exact: true }).click()
    const workspaceDialog = page.getByRole('dialog', { name: 'Create workspace', exact: true })
    await workspaceDialog.getByLabel('Workspace name').fill('Multi-request fixture')
    await workspaceDialog.getByRole('button', { name: 'Create workspace', exact: true }).click()
    await expect(workspaceDialog).not.toBeVisible()
    const selected = await page.evaluate(() => window.offlineApi.workspaces.list())
    if (!selected.ok || !selected.data.selectedWorkspaceId) throw new Error('Missing workspace')
    const workspace = selected.data.selectedWorkspaceId
    for (const name of ['Users', 'Admin']) {
      await page.getByRole('button', { name: 'Create Collection', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Create collection', exact: true })
      await dialog.getByLabel('Collection name').fill(name)
      await dialog.getByRole('button', { name: 'Create collection', exact: true }).click()
      await expect(dialog).not.toBeVisible()
    }
    const groups = await page.evaluate(w => window.offlineApi.collections.list(w), workspace)
    if (!groups.ok || groups.data.collections.length !== 2) throw new Error('Missing collections')
    const ids = groups.data.collections.map(c => c.id)
    for (let index = 0; index < 20; index++) {
      const name = `API ${String(index).padStart(2, '0')}`
      await page.getByRole('button', { name: 'Create Request', exact: true }).click()
      await page.getByLabel('Request name', { exact: true }).fill(name)
      await page.getByLabel('HTTP method', { exact: true }).selectOption(index % 2 ? 'PUT' : 'POST')
      await page.getByLabel('Request URL', { exact: true }).fill(`${fixture.url}/api/${index}`)
      await page.getByRole('region', { name: 'Request editor', exact: true }).getByRole('tab', { name: 'Body', exact: true }).click()
      await page.getByLabel('Body mode', { exact: true }).selectOption('json')
      await page.getByLabel('JSON source text', { exact: true }).fill(JSON.stringify({ index }))
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()
      await expect(page.getByRole('group', { name: `Request: ${name}`, exact: true })).toBeVisible()
      if (index % 3 !== 0) {
        const destination = ids[index % 3 - 1]!
        await page.getByRole('button',{name:`Actions for request: ${name}`,exact:true}).click()
        await page.getByRole('menuitem',{name:'Move request',exact:true}).click()
        const move=page.getByRole('dialog',{name:'Move request',exact:true})
        await move.getByLabel('Destination').selectOption(destination)
        await move.getByRole('button',{name:'Move',exact:true}).click()
        await expect(move).not.toBeVisible()
        await expect(page.getByRole('button', { name: 'Create Request', exact: true })).toBeEnabled()
      }
    }
    for(const collection of groups.data.collections) { const row=page.locator(`[data-library-id="${collection.id}"]`); if(await row.getAttribute('aria-expanded')==='false') await row.getByRole('button').first().click() }
    const before = await page.evaluate(w => window.offlineApi.requests.list(w), workspace)
    if (!before.ok) throw new Error('Missing requests')
    expect(before.data.requests).toHaveLength(20)
    expect(new Set(before.data.requests.map(r => r.id)).size).toBe(20)
    for (let index = 0; index < 20; index++) {
      expect(before.data.requests.find(r => r.name === `API ${String(index).padStart(2, '0')}`)?.collectionId).toBe(index % 3 ? ids[index % 3 - 1] : null)
    }
    // A cancelled attempt to create another draft must leave the library unchanged.
    await page.getByLabel('Request name', { exact: true }).fill('Keep this unsaved draft')
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    await page.getByRole('dialog', { name: 'Unsaved request changes', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Keep this unsaved draft')
    expect(await page.evaluate(w => window.offlineApi.requests.list(w), workspace)).toEqual(before)
    await page.getByRole('button', { name: 'Discard edits', exact: true }).click()
    expect(received).toEqual([])
    const closed = application.waitForEvent('close')
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
    await closed
    application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
    page = await application.firstWindow()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('API 19')
    expect(await page.evaluate(w => window.offlineApi.requests.list(w), workspace)).toEqual(before)
    // Walk every sidebar entry after reopening, without sending or rewriting saved data.
    for (let index = 0; index < 20; index++) {
      const name = `API ${String(index).padStart(2, '0')}`
      await page.getByRole('group', { name: `Request: ${name}`, exact: true }).getByRole('button', { name, exact: true }).click()
      await expect(page.getByLabel('Request name', { exact: true })).toHaveValue(name)
      await expect(page.getByLabel('Request URL', { exact: true })).toHaveValue(`${fixture.url}/api/${index}`)
      await expect(page.getByLabel('HTTP method', { exact: true })).toHaveValue(index % 2 ? 'PUT' : 'POST')
      await page.getByRole('region', { name: 'Request editor', exact: true }).getByRole('tab', { name: 'Body', exact: true }).click()
      await expect(page.getByLabel('JSON source text', { exact: true })).toHaveValue(JSON.stringify({ index }))
    }
    expect(received).toEqual([])
    for (const index of [0, 10, 19]) {
      const name = `API ${String(index).padStart(2, '0')}`
      await page.getByRole('group', { name: `Request: ${name}`, exact: true }).getByRole('button', { name, exact: true }).click()
      await expect(page.getByLabel('Request URL', { exact: true })).toHaveValue(`${fixture.url}/api/${index}`)
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      const record = { method: index % 2 ? 'PUT' : 'POST', url: `/api/${index}`, body: JSON.stringify({ index }) }
      await expect(page.getByLabel('Response body text', { exact: true })).toHaveText(JSON.stringify(record))
      expect(received.at(-1)).toEqual(record)
    }
    expect(received).toHaveLength(3)
    const after = await page.evaluate(w => window.offlineApi.requests.list(w), workspace)
    expect(after.ok && after.data.requests).toEqual(before.data.requests)
  } finally { await shutdown(application); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})
