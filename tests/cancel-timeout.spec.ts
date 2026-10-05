import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { startFixture } from './fixtures/http'

test('Send/Cancel and Ctrl+Enter execute unsaved snapshots, release busy state and never save implicitly', async () => {
  const fixture = await startFixture(), urls: string[] = []
  fixture.server.on('request', request => urls.push(request.url ?? ''))
  const directory = mkdtempSync(join(tmpdir(), 'api-client-cancel-ui-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  const application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await application.firstWindow(), browserRequests: string[] = []
    page.on('request', request => { if (/^https?:/.test(request.url())) browserRequests.push(request.url()) })
    await page.getByRole('button', { name: 'Create Workspace', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Create workspace', exact: true })
    await dialog.getByLabel('Workspace name').fill('Cancel fixture')
    await dialog.getByRole('button', { name: 'Create workspace', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    const workspace = await page.getByLabel('Workspace', { exact: true }).inputValue()
    await page.evaluate(() => {
      const events: import('../src/shared/results').ExecutionCompleted[] = []
      Reflect.set(window, 'fixtureCompletions', events)
      window.offlineApi.execution.onCompleted(event => events.push(event))
    })
    const send = page.getByRole('button', { name: 'Send', exact: true }), cancel = page.getByRole('button', { name: 'Cancel', exact: true })
    await expect(send).toBeDisabled(); await expect(cancel).toBeDisabled()
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + '/hold')
    await page.getByRole('tab', { name: 'Settings', exact: true }).click()
    await page.getByLabel('Overall timeout (ms)', { exact: true }).fill('2000')
    expect(urls).toEqual([])
    await expect(send).toBeEnabled(); await send.click()
    await expect(cancel).toBeEnabled(); await expect(send).toBeDisabled()
    await expect.poll(() => urls.length).toBe(1)
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + '/echo')
    await page.keyboard.press('Control+Enter')
    expect(urls).toEqual(['/hold']) // Editing and shortcut did not start a second request.
    await cancel.click()
    await expect(page.getByRole('status').filter({ hasText: /^Request cancelled$/ })).toBeVisible()
    await expect(cancel).toBeDisabled(); await expect(send).toBeEnabled()
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + '/hold')
    await page.getByLabel('Overall timeout (ms)', { exact: true }).fill('100')
    await send.click()
    await expect(page.getByRole('alert').filter({ hasText: /^TIMEOUT:/ })).toBeVisible()
    await expect(send).toBeEnabled(); await expect(cancel).toBeDisabled()
    await page.getByLabel('Overall timeout (ms)', { exact: true }).fill('2000')
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + '/echo')
    await page.keyboard.press('Control+Enter')
    await expect(page.getByRole('status').filter({ hasText: /^Request completed$/ })).toBeVisible()
    await expect(send).toBeEnabled(); await expect(cancel).toBeDisabled()
    const events = await page.evaluate(() => Reflect.get(window, 'fixtureCompletions'))
    expect(events).toHaveLength(3)
    expect(events).toMatchObject([{ result: { code: 'CANCELLED' } }, { result: { code: 'TIMEOUT' } }, { result: { statusCode: 200 } }])
    const saved = await page.evaluate(w => window.offlineApi.requests.list(w), workspace)
    expect(saved).toMatchObject({ ok: true, data: { requests: [], editor: null } })
    expect(urls).toEqual(['/hold', '/hold', '/echo']); expect(browserRequests).toEqual([])
    await expect(page.getByLabel('Response body text')).toContainText('bodyLength')
  } finally { await shutdown(application); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})
