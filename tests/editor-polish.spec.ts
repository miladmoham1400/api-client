import { expect, test, type Page, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'

async function setup(page: Page) {
  await page.getByRole('button', { name: 'Create Workspace', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create workspace', exact: true })
  await dialog.getByLabel('Workspace name').fill('Polish fixture')
  await dialog.getByRole('button', { name: 'Create workspace', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button', { name: 'Create Request', exact: true }).click()
  const workspace = await page.getByLabel('Workspace', { exact: true }).inputValue()
  return workspace
}
function environment(directory: string) {
  return { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
}
async function saved(page: Page, workspace: string) {
  const result = await page.evaluate(id => window.offlineApi.requests.list(id), workspace)
  if (!result.ok) throw new Error('Fixture read failed')
  return result.data
}
async function delaySaves(app: ElectronApplication, fail = false) {
  await app.evaluate(({ ipcMain }, fail) => {
    const handlers: unknown = Reflect.get(ipcMain, '_invokeHandlers')
    if (!(handlers instanceof Map)) throw new Error('Missing fixture IPC map')
    const original: unknown = handlers.get('requests:save')
    if (typeof original !== 'function') throw new Error('Missing save handler')
    ipcMain.removeHandler('requests:save')
    ipcMain.handle('requests:save', async (event, ...args: unknown[]) => {
      Reflect.set(globalThis, 'fixtureSaving', true)
      await new Promise(resolve => setTimeout(resolve, 900))
      if (fail) return { ok: false, error: { code: 'DATABASE_WRITE_FAILED', message: 'Fixture failure', retryable: true } }
      return Reflect.apply(original, undefined, [event, ...args]) as unknown
    })
  }, fail)
}

test('automatic saving preserves edits during delayed writes, flushes navigation/close and guards invalid edits', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-autosave-'))
  const env = environment(directory)
  let app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
  try {
    let page = await app.firstWindow()
    const workspace = await setup(page)
    const name = page.getByLabel('Request name', { exact: true })
    await name.fill('Original')
    await expect.poll(async () => (await saved(page, workspace)).editor?.name).toBe('Original')
    await delaySaves(app)
    await name.fill('Slow save')
    await expect.poll(() => app.evaluate(() => Reflect.get(globalThis, 'fixtureSaving'))).toBe(true)
    await name.fill('Latest text')
    await expect(name).toBeFocused()
    await expect.poll(async () => (await saved(page, workspace)).editor?.name).toBe('Latest text')
    expect((await saved(page, workspace)).requests).toHaveLength(1)
    await expect(name).toHaveValue('Latest text')
    await name.fill('Flush on switch')
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    await expect(name).toHaveValue('New request')
    expect((await saved(page, workspace)).requests.map(r => r.name)).toContain('Flush on switch')
    await name.fill('Second')
    await expect.poll(async () => (await saved(page, workspace)).editor?.name).toBe('Second')
    await name.fill('')
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    const guard = page.getByRole('dialog', { name: 'Unsaved request changes' })
    await expect(guard).toBeVisible()
    await guard.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(name).toHaveValue('')
    await name.fill('Close flush')
    await app.close()
    app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
    page = await app.firstWindow()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Close flush')
    const state = await saved(page, workspace)
    expect(state.requests).toHaveLength(2)
    await delaySaves(app, true)
    await page.getByLabel('Request name', { exact: true }).fill('Keep failed edits')
    await expect(page.getByRole('alert')).toContainText('Automatic save failed')
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    const failedGuard = page.getByRole('dialog', { name: 'Unsaved request changes' })
    await expect(failedGuard).toBeVisible()
    await failedGuard.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Keep failed edits')
    expect((await saved(page, workspace)).editor?.name).toBe('Close flush')
  } finally { await shutdown(app); rmSync(directory, { recursive: true, force: true }) }
})

test('side-by-side default, divider, JSON Tab/collapse, raw fallback and static HTML isolation', async () => {
  let sends = 0, unexpected = 0
  const fixture = await startFixture(false, (req, res) => {
    if (req.url === '/unexpected') unexpected++
    sends++; req.resume()
    res.writeHead(500, { 'Content-Type': req.url === '/html' ? 'text/html' : 'application/json' })
    res.end(req.url === '/html' ? `<html><head><style>h1{color:rgb(180,20,30)}body{background-image:url('${fixture.url}/unexpected')}</style><link rel="stylesheet" href="${fixture.url}/unexpected"></head><body><h1>Laravel exception</h1><pre>Readable stack trace</pre><script>window.previewExecuted=true;fetch('${fixture.url}/unexpected')</script><img src="${fixture.url}/unexpected" onerror="window.previewExecuted=true"><a href="${fixture.url}/unexpected">Navigate</a><iframe src="${fixture.url}/unexpected"></iframe><form action="${fixture.url}/unexpected"><input autofocus></form></body></html>` : req.url === '/invalid' ? '{broken' : req.url === '/large' ? JSON.stringify({ data: 'x'.repeat(66000) }) : '{"message":"سلام","items":[{"nested":"first"},{"nested":"second"}]}')
  })
  const directory = mkdtempSync(join(tmpdir(), 'api-client-presentation-'))
  const app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env: environment(directory) })
  try {
    const page = await app.firstWindow()
    await setup(page)
    const editor = page.getByRole('region', { name: 'Request editor', exact: true }), response = page.getByRole('region', { name: 'Response', exact: true })
    const toggle = page.getByRole('button', { name: 'Side-by-side layout', exact: true }), divider = page.getByRole('separator')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const eb = (await editor.boundingBox())!, rb = (await response.boundingBox())!
    expect(rb.x).toBeGreaterThan(eb.x + eb.width)
    await divider.focus(); await page.keyboard.press('ArrowRight')
    await expect(divider).toHaveAttribute('aria-valuenow', '52')
    const db = (await divider.boundingBox())!
    await page.mouse.move(db.x + db.width / 2, db.y + 50); await page.mouse.down(); await page.mouse.move(db.x - 45, db.y + 50); await page.mouse.up()
    expect(Number(await divider.getAttribute('aria-valuenow'))).toBeLessThan(52)
    await toggle.click(); await expect(divider).toHaveAttribute('aria-orientation', 'horizontal'); await toggle.click()
    await page.getByLabel('HTTP method', { exact: true }).selectOption('POST')
    await editor.getByRole('tab', { name: 'Body', exact: true }).click()
    await page.getByLabel('Body mode', { exact: true }).selectOption('json')
    const input = page.getByLabel('JSON source text', { exact: true })
    await input.fill('{}'); await input.press('Home'); await input.press('ArrowRight'); await input.press('Tab')
    await expect(input).toHaveValue('{  }'); await expect(input).toBeFocused()
    await input.press('Shift+Tab'); await expect(input).not.toBeFocused()
    await input.fill('{"hello":"world"}')
    expect(await editor.locator('details').filter({ has: page.getByText('Body details', { exact: true }) }).getAttribute('open')).toBeNull()
    const run = async (path: string) => {
      await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + path)
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(response.getByLabel('Response metrics')).toContainText('500')
      await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled()
    }
    await run('/json')
    await expect(response.getByRole('button', { name: 'Pretty', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const tree = response.getByLabel('Response body JSON')
    await page.screenshot({ path: '/tmp/api-client-polish-json.png', animations: 'disabled' })
    await expect(tree).toContainText('items')
    await expect(tree).toContainText('first')
    await tree.locator('label').filter({ hasText: /^0:/ }).click()
    await expect(tree).not.toContainText('first')
    await response.getByRole('button', { name: 'Raw', exact: true }).click()
    await expect(response.getByLabel('Response body text')).toContainText('"nested":"first"')
    await run('/invalid'); await expect(response.getByLabel('Response body text')).toHaveText('{broken')
    await run('/large'); await expect(response).toContainText('Pretty is limited')
    await run('/html')
    await response.getByRole('button', { name: 'HTML', exact: true }).click()
    const frame = page.frameLocator('iframe[title="HTML response preview"]')
    await expect(frame.getByRole('heading', { name: 'Laravel exception' })).toBeVisible()
    await expect(frame.getByRole('heading')).toHaveCSS('color', 'rgb(180, 20, 30)')
    expect(await frame.locator('body').evaluate(() => ({ api: typeof Reflect.get(window, 'offlineApi'), ran: Reflect.get(window, 'previewExecuted') }))).toEqual({ api: 'undefined', ran: undefined })
    await expect(frame.locator('script,iframe,form,input,link')).toHaveCount(0)
    await frame.getByText('Navigate', { exact: true }).click()
    await expect(frame.getByRole('heading')).toBeVisible()
    expect(unexpected).toBe(0); expect(sends).toBe(4)
    for (const theme of ['dark', 'light']) {
      await page.getByLabel('Theme', { exact: true }).selectOption(theme)
      await expect(page.locator('html')).toHaveClass(theme)
      await expect(frame.getByRole('heading', { name: 'Laravel exception' })).toBeVisible()
      await page.screenshot({ path: `/tmp/api-client-polish-${theme}.png`, animations: 'disabled' })
    }
  } finally { await shutdown(app); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('request menu duplicates and deletes the addressed request', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-menus-'))
  const app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env: environment(directory) })
  try {
    const page = await app.firstWindow(), workspace = await setup(page)
    await page.getByLabel('Request name', { exact: true }).fill('First')
    await expect.poll(async () => (await saved(page, workspace)).editor?.name).toBe('First')
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    await page.getByLabel('Request name', { exact: true }).fill('Second')
    await expect.poll(async () => (await saved(page, workspace)).editor?.name).toBe('Second')
    await page.getByRole('button', { name: 'Create Collection', exact: true }).click()
    const collection = page.getByRole('dialog', { name: 'Create collection', exact: true })
    await collection.getByLabel('Collection name').fill('Folder icons')
    await collection.getByRole('button', { name: 'Create collection', exact: true }).click()
    const row = page.getByRole('treeitem', { name: 'collection: Folder icons', exact: true })
    const closed = await row.locator('svg').innerHTML()
    await row.getByRole('button', { name: 'Folder icons', exact: true }).click()
    await expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(await row.locator('svg').innerHTML()).not.toBe(closed)
    await expect(row.getByRole('button', { name: 'Folder icons', exact: true })).toHaveCSS('font-size', '12px')
    await page.getByRole('button', { name: 'Actions for request: First', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Duplicate request', exact: true }).click()
    await expect.poll(async () => (await saved(page, workspace)).requests.map(r => r.name).sort()).toEqual(['First', 'First (copy)', 'Second'])
    await page.getByRole('button', { name: 'Actions for request: First (copy)', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Delete request', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete request', exact: true })
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect((await saved(page, workspace)).requests).toHaveLength(3)
    await page.getByRole('button', { name: 'Actions for request: First (copy)', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Delete request', exact: true }).click()
    await dialog.getByRole('button', { name: 'Delete request', exact: true }).click()
    await expect.poll(async () => (await saved(page, workspace)).requests.map(r => r.name).sort()).toEqual(['First', 'Second'])
  } finally { await shutdown(app); rmSync(directory, { recursive: true, force: true }) }
})
