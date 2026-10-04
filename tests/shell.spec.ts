import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron, expect, test } from '@playwright/test'

test('shell fits desktop sizes, traps/restores dialog focus and recovers from bootstrap failure', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-shell-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  const application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveClass('light')
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Create Workspace', exact: true })).toBeDisabled()
    await page.screenshot({ path: '/tmp/api-client-shell-light.png' })
    const about = page.getByRole('button', { name: 'About this shell' })
    await about.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Local desktop shell' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(about).toBeFocused()
    await page.getByRole('tab', { name: 'Params', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Headers', exact: true }).first()).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('tab', { name: 'Headers', exact: true }).first()).toHaveAttribute('aria-selected', 'true')
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveClass('dark')
    await page.screenshot({ path: '/tmp/api-client-shell-dark.png' })
    for (const size of [{ width: 1280, height: 720 }, { width: 1000, height: 700 }]) {
      await page.setViewportSize(size)
      const regions = page.getByRole('region')
      for (const region of await regions.all()) {
        const bounds = await region.boundingBox()
        expect(bounds).not.toBeNull()
        if (!bounds) throw new Error('Missing region bounds')
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width)
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    await page.screenshot({ path: '/tmp/api-client-shell-minimum.png' })
    // Exercise real bridge failure and loading, without adding renderer test APIs.
    await application.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('app:get-bootstrap')
      ipcMain.handle('app:get-bootstrap', async () => {
        await new Promise(resolve => setTimeout(resolve, 1_000))
        throw new Error('Synthetic bootstrap failure')
      })
    })
    await page.reload()
    await expect(page.getByRole('status')).toContainText('Opening local workspace storage')
    await expect(page.getByRole('alert')).toContainText('Local startup information could not be loaded')
    await application.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('app:get-bootstrap')
      ipcMain.handle('app:get-bootstrap', () => ({ ok: true, data: { stage: 'foundation', database: { status: 'ready' }, capabilities: { database: true, requests: false } } }))
    })
    await page.getByRole('button', { name: 'Retry startup' }).click()
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
  } finally { await application.close(); rmSync(directory, { recursive: true, force: true }) }
})
