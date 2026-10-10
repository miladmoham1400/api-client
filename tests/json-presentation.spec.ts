import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'

test('JSON colors preserve editing, wire bytes and safe raw/pretty text across themes', async () => {
  let received = ''
  const fixture = await startFixture(false, (request, response) => {
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => { received += chunk })
    request.on('end', () => { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(received) })
  })
  const directory = mkdtempSync(join(tmpdir(), 'api-client-json-ui-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  const application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await application.firstWindow()
    const requests: string[] = []
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()) })
    await page.getByRole('button', { name: 'Create Workspace', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Create workspace', exact: true })
    await dialog.getByLabel('Workspace name').fill('JSON presentation fixture')
    await dialog.getByRole('button', { name: 'Create workspace', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    await page.getByLabel('HTTP method', { exact: true }).selectOption('POST')
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url)
    await page.getByRole('tab', { name: 'Body', exact: true }).first().click()
    await page.getByLabel('Body mode', { exact: true }).selectOption('json')
    const editor = page.getByLabel('JSON source text', { exact: true })
    const source = ' {\n  "message": "سلام 🌍",\n  "count": 9007199254740993,\n  "active": true,\n  "empty": null,\n  "html": "<script>window.syntheticExecuted=true</script><img src=http://127.0.0.1:1/untrusted>"\n}  '
    await editor.fill(source)
    await editor.press('End')
    await editor.press('Space')
    const edited = source + ' '
    await expect(editor).toHaveValue(edited)
    for (const theme of ['light', 'dark']) {
      await page.getByLabel('Theme', { exact: true }).selectOption(theme)
      await expect(page.locator('html')).toHaveClass(theme)
      await expect(editor).toHaveValue(edited)
      const colors = await page.locator('.json-editor-backdrop').evaluate(element => ['key', 'string', 'number', 'boolean', 'null'].map(kind => {
        const token = element.querySelector('.json-' + kind)
        if (!token) throw new Error('Missing token')
        return getComputedStyle(token).color
      }))
      expect(new Set(colors).size).toBe(5)
      await page.screenshot({ path: `/tmp/api-client-json-${theme}.png`, animations: 'disabled' })
    }
    const send = page.getByRole('button', { name: 'Send', exact: true })
    await send.click()
    await expect(send).toBeEnabled()
    expect(received).toBe(edited)
    const response = page.getByLabel('Response body text', { exact: true })
    expect(await response.textContent()).toBe(edited)
    await page.getByRole('button', { name: 'Pretty', exact: true }).click()
    await expect(response).toContainText('\n  "message"')
    await page.getByRole('button', { name: 'Raw', exact: true }).click()
    expect(await response.textContent()).toBe(edited)
    await expect(response.locator('script,img,iframe')).toHaveCount(0)
    expect(await page.evaluate(() => Reflect.get(window, 'syntheticExecuted'))).toBeUndefined()
    expect(requests).toEqual([])
    // Wrapped lines, native resizing and scrolling use identical text metrics.
    await editor.fill(JSON.stringify({ text: 'word '.repeat(2000) }, null, 2))
    await editor.evaluate(element => { element.style.height = '160px'; element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll', { bubbles: true })) })
    const metrics = await page.locator('.json-editor').evaluate(element => {
      const input = element.querySelector('textarea'), pre = element.querySelector('pre')
      if (!input || !pre) throw new Error('Missing editor layers')
      return { inputScroll: input.scrollTop, preScroll: pre.scrollTop, inputHeight: input.scrollHeight, preHeight: pre.scrollHeight }
    })
    expect(metrics.inputScroll).toBeGreaterThan(0)
    expect(metrics.preScroll).toBe(metrics.inputScroll)
    expect(Math.abs(metrics.inputHeight - metrics.preHeight)).toBeLessThan(25)
    await editor.fill('x'.repeat(65537))
    await expect(editor).not.toHaveClass(/json-editor-highlighted/)
    await expect(editor).toHaveValue('x'.repeat(65537))
  } finally { await shutdown(application); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})
