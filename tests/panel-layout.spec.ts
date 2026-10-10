import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'

test('layout toggle and pointer/keyboard resizing preserve drafts, inactive body modes and Pretty response', async () => {
  let sends = 0
  const fixture = await startFixture(false, (request, response) => {
    sends++
    request.resume()
    request.on('end', () => {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      if (request.url === '/hold') { response.write('waiting'); return }
      response.end('{"message":"سلام","active":true}')
    })
  })
  const directory = mkdtempSync(join(tmpdir(), 'api-client-panels-ui-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  const app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Create Workspace', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Create workspace', exact: true })
    await dialog.getByLabel('Workspace name').fill('Layout fixture')
    await dialog.getByRole('button', { name: 'Create workspace', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    await page.getByLabel('Request name', { exact: true }).fill('Unsaved layout draft')
    await page.getByLabel('HTTP method', { exact: true }).selectOption('POST')
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url)
    await page.getByRole('tab', { name: 'Body', exact: true }).first().click()
    await page.getByLabel('Body mode', { exact: true }).selectOption('raw')
    await page.getByLabel('Raw body text', { exact: true }).fill('Inactive raw draft')
    await page.getByLabel('Body mode', { exact: true }).selectOption('json')
    const source = '{\n  "message": "سلام 🌍",\n  "active": true\n}'
    await page.getByLabel('JSON source text', { exact: true }).fill(source)
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    const response = page.getByRole('region', { name: 'Response', exact: true })
    await expect(response).toContainText('Status 200')
    await response.getByRole('button', { name: 'Pretty', exact: true }).click()
    const pretty = await page.getByLabel('Response body text', { exact: true }).textContent()
    const toggle = page.getByRole('button', { name: 'Side-by-side layout', exact: true })
    const separator = page.getByRole('separator', { name: 'Resize request and response panels', exact: true })
    const editor = page.getByRole('region', { name: 'Request editor', exact: true })
    const bounds = async () => ({ request: (await editor.boundingBox())!, response: (await response.boundingBox())! })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    const stacked = await bounds()
    expect(stacked.response.y).toBeGreaterThan(stacked.request.y + stacked.request.height)
    await separator.focus()
    await page.keyboard.press('ArrowUp')
    await expect(separator).toHaveAttribute('aria-valuenow', '53')
    await expect.poll(async () => (await bounds()).response.height).toBeGreaterThan(stacked.response.height)
    let grip = (await separator.boundingBox())!
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down(); await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + 35, { steps: 5 }); await page.mouse.up()
    expect(Number(await separator.getAttribute('aria-valuenow'))).toBeGreaterThan(53)
    const stackedRatio = await separator.getAttribute('aria-valuenow')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(separator).toHaveAttribute('aria-orientation', 'vertical')
    const side = await bounds()
    expect(side.response.x).toBeGreaterThan(side.request.x + side.request.width)
    expect(Math.abs(side.response.y - side.request.y)).toBeLessThan(2)
    await separator.focus(); await page.keyboard.press('ArrowLeft')
    await expect(separator).toHaveAttribute('aria-valuenow', '48')
    await expect.poll(async () => (await bounds()).response.width).toBeGreaterThan(side.response.width)
    grip = (await separator.boundingBox())!
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down(); await page.mouse.move(grip.x + grip.width / 2 + 60, grip.y + grip.height / 2, { steps: 5 }); await page.mouse.up()
    expect(Number(await separator.getAttribute('aria-valuenow'))).toBeGreaterThan(48)
    const before = (await bounds()).response.width
    await response.getByRole('button', { name: 'Increase response panel width', exact: true }).click()
    await expect.poll(async () => (await bounds()).response.width).toBeGreaterThan(before)
    for (const theme of ['light', 'dark']) {
      await page.getByLabel('Theme', { exact: true }).selectOption(theme)
      await expect(page.locator('html')).toHaveClass(theme)
      await expect(page.getByLabel('JSON source text', { exact: true })).toHaveValue(source)
      await expect(response.getByRole('button', { name: 'Pretty', exact: true })).toHaveAttribute('aria-pressed', 'true')
      expect(await page.getByLabel('Response body text', { exact: true }).textContent()).toBe(pretty)
      await page.getByLabel('JSON source text', { exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: `/tmp/api-client-panels-side-${theme}.png`, animations: 'disabled' })
    }
    await separator.focus(); await page.keyboard.press('Home')
    await expect(separator).toHaveAttribute('aria-valuenow', '20')
    await expect(response.getByRole('button', { name: 'Increase response panel width', exact: true })).toBeDisabled()
    await page.keyboard.press('End')
    await expect(separator).toHaveAttribute('aria-valuenow', '80')
    await expect(response.getByRole('button', { name: 'Decrease response panel width', exact: true })).toBeDisabled()
    await toggle.click()
    await expect(separator).toHaveAttribute('aria-valuenow', stackedRatio!)
    await expect(separator).toHaveAttribute('aria-orientation', 'horizontal')
    await page.getByLabel('JSON source text', { exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '/tmp/api-client-panels-stacked.png', animations: 'disabled' })
    await page.getByLabel('Body mode', { exact: true }).selectOption('raw')
    await expect(page.getByLabel('Raw body text', { exact: true })).toHaveValue('Inactive raw draft')
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Unsaved layout draft')
    const workspace = await page.getByLabel('Workspace', { exact: true }).inputValue()
    expect(await page.evaluate(id => window.offlineApi.requests.list(id), workspace)).toMatchObject({ ok: true, data: { requests: [] } })
    await page.setViewportSize({ width: 1000, height: 700 })
    for (let i = 0; i < 2; i++) {
      await toggle.click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const panes = await bounds()
      expect(panes.request.width).toBeGreaterThan(0); expect(panes.response.width).toBeGreaterThan(0)
      expect(panes.request.height).toBeGreaterThan(0); expect(panes.response.height).toBeGreaterThan(0)
    }
    expect(sends).toBe(1)
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + '/hold')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect.poll(() => sends).toBe(2)
    await toggle.click(); await toggle.click()
    await expect(editor.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled()
    await expect(page.getByLabel('Raw body text', { exact: true })).toHaveValue('Inactive raw draft')
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(response).toContainText('Cancelled. No HTTP response.')
    expect(sends).toBe(2)
  } finally { await shutdown(app); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})
