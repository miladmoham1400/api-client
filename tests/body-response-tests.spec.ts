import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'

const environment = (directory: string) => ({ ...Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(e[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory })

test('per-body JSON expectations persist, automatically compare exact responses and show safe differences', async () => {
  test.setTimeout(60000)
  const directory = mkdtempSync(join(tmpdir(), 'body-response-tests-')), received: string[] = []
  let raw = '{"ok":true,"data":{"count":1}}', hold = false
  let release = () => {}
  const fixture = await startFixture(false, (req, res) => {
    let body = ''; req.setEncoding('utf8'); req.on('data', (chunk: string) => { body += chunk })
    req.on('end', () => { received.push(body); const captured = raw; const finish = () => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(captured) }; if (hold) release = finish; else finish() })
  })
  let app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env: environment(directory) })
  try {
    let page = await app.firstWindow()
    await page.evaluate(async url => {
      const api = window.offlineApi, w = await api.workspaces.create('Response tests')
      if (!w.ok || !w.data.selectedWorkspaceId) throw Error('Missing workspace')
      const id = w.data.selectedWorkspaceId
      await api.requests.create(id, { name: 'Other', method: 'GET', urlTemplate: url, collectionId: null })
      await api.requests.create(id, { name: 'Cases', method: 'POST', urlTemplate: url, collectionId: null, body: { kind: 'json', text: '{"case":1}' } })
    }, fixture.url)
    await page.reload()
    let editor = page.getByRole('region', { name: 'Request editor', exact: true })
    await expect(page.getByLabel('Response test guidance')).toContainText('Save expected response JSON')
    await expect(page.getByText('expectation captured at send time', { exact: false })).not.toBeVisible()
    await editor.getByRole('tab', { name: 'Body', exact: true }).click()
    await editor.locator('summary').filter({ hasText: /^Response test/ }).click()
    let expected = page.getByLabel('Expected response JSON', { exact: true })
    await expected.fill('{"bad":}')
    await page.getByRole('button', { name: 'Save expected JSON', exact: true }).click()
    await expect(editor.getByRole('alert')).toContainText('Line 1')
    await expected.fill('{"data":{"count":1}, "ok": true}')
    await page.getByRole('button', { name: 'Save expected JSON', exact: true }).click()
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    let result = page.getByRole('region', { name: 'Response test result', exact: true })
    await expect(result).toContainText('Test passed')
    await page.getByRole('button', { name: '+ Body variant', exact: true }).click()
    await page.getByLabel('Body variant name', { exact: true }).fill('Second')
    await expect(expected).toHaveValue('')
    await expect(result).not.toBeVisible()
    await expect(page.getByLabel('Response test guidance')).toBeVisible()
    await page.getByLabel('JSON source text', { exact: true }).fill('{"case":2}')
    await expected.fill('{"ok":true,"data":{"count":2},"removed":true}')
    await page.getByRole('button', { name: 'Save expected JSON', exact: true }).click()
    raw = '{"ok":true,"data":{"count":3},"added":"<img src=x onerror=alert(1)>"}'
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(result).toContainText('Response changed')
    await expect(page.getByLabel('Response test guidance')).not.toBeVisible()
    await expect(result).toContainText('data.count · changed')
    await expect(result.getByRole('region', { name: 'Expected JSON', exact: true })).not.toBeVisible()
    await result.locator('summary').filter({ hasText: 'data.count · changed' }).click()
    await expect(result.getByRole('region', { name: 'Expected JSON', exact: true })).toContainText('2')
    await expect(result.getByRole('region', { name: 'Received JSON', exact: true })).toContainText('3')
    await expect(result).toContainText('removed · removed'); await expect(result).toContainText('added · added')
    await result.locator('summary').filter({ hasText: 'added · added' }).click()
    expect(await result.locator('img').count()).toBe(0)
    await page.screenshot({ path: '/tmp/api-client-response-test-diff.png', animations: 'disabled' })
    // The pending send uses Second's saved expectation even after switching/editing Body 1.
    raw = '{"ok":true,"data":{"count":2},"removed":true}'; hold = true
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect.poll(() => received.length).toBe(3)
    await page.getByLabel('Body variant', { exact: true }).selectOption({ label: 'Body 1' })
    await expected.fill('{"editedAfterSend":true}')
    await page.getByRole('button', { name: 'Save expected JSON', exact: true }).click()
    release(); release = () => {}; hold = false
    await expect(result).toContainText('Test passed'); await expect(result).toContainText('Second')
    // Cached results remain owned by their request tab.
    await page.getByRole('button', { name: 'Other', exact: true }).click()
    await expect(result).not.toBeVisible()
    await page.getByRole('tablist', { name: 'Open requests' }).getByRole('tab', { name: 'POST Cases', exact: true }).click()
    await expect(result).toContainText('Test passed')
    await page.getByLabel('Body variant', { exact: true }).selectOption({ label: 'Second' })
    raw = '<html>Server error</html>'
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(result).toContainText('Test unavailable'); await expect(result).toContainText('Response JSON')
    expect(received.map(text => JSON.parse(text) as unknown)).toEqual([{ case: 1 }, { case: 2 }, { case: 2 }, { case: 2 }])
    await page.keyboard.press('Control+s'); await app.close()
    app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env: environment(directory) }); page = await app.firstWindow()
    editor = page.getByRole('region', { name: 'Request editor', exact: true })
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Cases')
    await editor.getByRole('tab', { name: 'Body', exact: true }).click()
    await editor.locator('summary').filter({ hasText: /^Response test/ }).click()
    expected = page.getByLabel('Expected response JSON', { exact: true })
    await expect(expected).toHaveValue('{"ok":true,"data":{"count":2},"removed":true}')
    result = page.getByRole('region', { name: 'Response test result', exact: true })
    await expect(result).not.toBeVisible(); expect(received).toHaveLength(4)
    await page.getByRole('button', { name: 'Remove test', exact: true }).click()
    await expect(page.getByLabel('Response test guidance')).toBeVisible()
    await expect(result).not.toBeVisible()
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect.poll(() => received.length).toBe(5)
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled()
    await expect(result).not.toBeVisible()
  } finally { release(); await shutdown(app); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('binary, oversized JSON, cancellation, connection and preflight failures cannot pass a response test', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'response-test-errors-'))
  const fixture = await startFixture(false, (req, res) => {
    if (req.url === '/delay') return
    if (req.url === '/large') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ large: 'a'.repeat(256 * 1024) })); return }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); res.end(Buffer.from([0xff, 0xfe, 0x00, 0x01]))
  })
  const app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env: environment(directory) })
  let closed = false
  try {
    const page = await app.firstWindow()
    await page.evaluate(async url => {
      const api = window.offlineApi, w = await api.workspaces.create('Unavailable tests')
      if (!w.ok || !w.data.selectedWorkspaceId) throw Error('Missing workspace')
      await api.requests.create(w.data.selectedWorkspaceId, { name: 'Errors', method: 'GET', urlTemplate: url + '/binary', collectionId: null, expectedResponse: '{}' })
    }, fixture.url)
    await page.reload()
    const result = page.getByRole('region', { name: 'Response test result', exact: true })
    const send = page.getByRole('button', { name: 'Send', exact: true })
    const url = page.getByLabel('Request URL', { exact: true })
    await send.click(); await expect(result).toContainText('Test unavailable')
    await url.fill(fixture.url + '/large'); await send.click()
    await expect(result).toContainText('256 KiB')
    await url.fill(fixture.url + '/delay'); await send.click()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(result).toContainText('Test unavailable'); await expect(send).toBeEnabled()
    await fixture.close(); closed = true
    await url.fill(fixture.url + '/closed'); await send.click()
    await expect(result).toContainText('Test unavailable'); await expect(send).toBeEnabled()
    await url.fill('ftp://127.0.0.1/invalid'); await send.click()
    await expect(result).toContainText('Test unavailable'); await expect(send).toBeEnabled()
  } finally { await shutdown(app); if (!closed) await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('removed JSON starts collapsed and expands as complete pretty JSON with readable Persian', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'readable-response-diff-'))
  const fixture = await startFixture(false, (_req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"data":{}}') })
  const app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env: environment(directory) })
  const values = Array.from({ length: 20 }, (_, index) => ({ id: 14 + index, name: index === 0 ? 'پاییز 1404' : 'تابستان 1404' }))
  const escaped = JSON.stringify({ data: { scores_headers: values } }).replace(/[\u0600-\u06ff]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'))
  try {
    const page = await app.firstWindow()
    await page.evaluate(async input => {
      const api = window.offlineApi, w = await api.workspaces.create('Readable differences')
      if (!w.ok || !w.data.selectedWorkspaceId) throw Error('Missing workspace')
      await api.requests.create(w.data.selectedWorkspaceId, { name: 'Scores', method: 'GET', urlTemplate: input.url, collectionId: null, expectedResponse: input.expected })
    }, { url: fixture.url, expected: escaped })
    await page.reload()
    const send = page.getByRole('button', { name: 'Send', exact: true })
    await send.click()
    const result = page.getByRole('region', { name: 'Response test result', exact: true })
    const summary = result.locator('summary').filter({ hasText: /^data.scores_headers · removed$/ })
    const expected = result.getByRole('region', { name: 'Expected JSON', exact: true })
    await expect(summary).toBeVisible()
    await expect(expected).not.toBeVisible()
    await summary.click()
    await expect(expected.locator('pre')).toHaveText(JSON.stringify(values, null, 2))
    await page.screenshot({ path: '/tmp/api-client-readable-json-difference.png', animations: 'disabled' })
    await summary.click(); await expect(expected).not.toBeVisible()
    await summary.click(); await expect(expected).toBeVisible()
    await send.click()
    await expect(summary).toBeVisible(); await expect(expected).not.toBeVisible()
  } finally { await shutdown(app); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})
