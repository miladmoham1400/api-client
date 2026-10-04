import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ServerResponse } from 'node:http'
import { _electron, expect, test } from '@playwright/test'
import { startFixture } from './fixtures/http'

test('response viewer safely presents HTTP/error/binary states, snapshots, stale events and restart emptiness', async () => {
  let delayed: ServerResponse | undefined
  const html = '<script>window.syntheticResponseExecuted=true</script><img src="http://127.0.0.1:1/untrusted" onerror="window.syntheticResponseExecuted=true">'
  const fixture = await startFixture(false, (request, response) => {
    const path = request.url
    if (path === '/hold') { delayed = response; response.writeHead(200, { 'Content-Type': 'application/json' }); return }
    if (path === '/reset') { request.socket.destroy(); return }
    if (path === '/redirect') { response.writeHead(302, { Location: '/json' }); response.end(); return }
    if (path === '/binary') { response.writeHead(200, { 'Content-Type': 'application/octet-stream' }); response.end(Buffer.from([0, 255, 1])); return }
    response.writeHead(path === '/401' ? 401 : path === '/500' ? 500 : 200, { 'Content-Type': path === '/html' ? 'text/html' : 'application/json', 'Set-Cookie': ['synthetic=a', 'synthetic=b'] })
    response.end(path === '/html' ? html : path === '/invalid' ? '{"broken":' : path === '/large' ? JSON.stringify({ text: 'x'.repeat(65536) }) : '{"message":"سلام","items":[1,2]}')
  })
  const directory = mkdtempSync(join(tmpdir(), 'api-client-response-ui-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  let application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await application.firstWindow(), rendererRequests: string[] = []
    page.on('request', request => { if (/^https?:/.test(request.url())) rendererRequests.push(request.url()) })
    await page.evaluate(() => { window.offlineApi.execution.onCompleted(event => Reflect.set(window, 'fixtureLastResponse', event)) })
    await page.getByRole('button', { name: 'Create Workspace', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Create workspace', exact: true })
    await dialog.getByLabel('Workspace name').fill('Response fixture')
    await dialog.getByRole('button', { name: 'Create workspace', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    await page.getByLabel('Request name', { exact: true }).fill('Sent fixture')
    const region = page.getByRole('region', { name: 'Response', exact: true })
    const send = page.getByRole('button', { name: 'Send', exact: true })
    const run = async (path: string) => {
      await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + path)
      await send.click()
      await expect(send).toBeEnabled()
    }
    for (const status of [401, 500]) {
      await run('/' + status)
      await expect(region).toContainText('Status ' + status)
      await expect(region).toContainText('bytes (decoded)')
      await expect(page.getByRole('alert')).toHaveCount(0)
      await region.getByRole('tab', { name: 'Headers', exact: true }).click()
      await expect(region.getByLabel('Raw response headers')).toContainText('Set-Cookie: synthetic=a\nSet-Cookie: synthetic=b')
    }
    await run('/json')
    const body = region.getByLabel('Response body text')
    await expect(body).toHaveText('{"message":"سلام","items":[1,2]}')
    await region.getByRole('button', { name: 'Pretty', exact: true }).click()
    await expect(body).toContainText('\n  "message"')
    await region.evaluate(element => { element.scrollTop = element.scrollHeight })
    await page.screenshot({ path: '/tmp/api-client-response-pretty.png', animations: 'disabled' })
    await region.getByRole('button', { name: 'Raw', exact: true }).click()
    await expect(body).toHaveText('{"message":"سلام","items":[1,2]}')
    await page.screenshot({ path: '/tmp/api-client-response-raw.png' })
    await run('/invalid')
    await region.getByRole('button', { name: 'Pretty', exact: true }).click()
    await expect(body).toHaveText('{"broken":')
    await expect(region).toContainText('Raw remains available')
    await run('/large')
    await region.getByRole('button', { name: 'Pretty', exact: true }).click()
    await expect(region).toContainText('Pretty is limited to 64 Ki characters')
    expect((await body.textContent())?.length).toBeGreaterThan(65536)
    await run('/html')
    await expect(body).toHaveText(html)
    await expect(region.locator('script,img,iframe')).toHaveCount(0)
    expect(await page.evaluate(() => Reflect.get(window, 'syntheticResponseExecuted'))).toBeUndefined()
    expect(rendererRequests).toEqual([])
    await run('/binary')
    await expect(region).toContainText('Binary response · 3 bytes')
    await expect(region).toContainText('Content-Type: application/octet-stream')
    await expect(region.getByRole('button', { name: 'Pretty', exact: true })).toHaveCount(0)
    await run('/reset')
    await expect(page.getByRole('alert')).toContainText('NETWORK_FAILURE:')
    await expect(region).toContainText('Transport failed. No HTTP response.')
    await expect(region).not.toContainText('Status 200')
    await page.screenshot({ path: '/tmp/api-client-response-error.png' })
    await page.getByRole('tab', { name: 'Settings', exact: true }).click()
    await page.getByLabel('Follow redirects', { exact: true }).check()
    await run('/redirect')
    await expect(region).toContainText('Final URL: ' + fixture.url + '/json · Redirect hops: 1')
    // Replay a real earlier completion through the validated preload boundary.
    const old = await page.evaluate(() => Reflect.get(window, 'fixtureLastResponse') as import('../src/shared/results').ExecutionCompleted)
    expect(old.result).toMatchObject({ statusCode: 200 })
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + '/hold')
    await send.click()
    await expect.poll(() => !!delayed).toBe(true)
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + '/changed')
    await expect(region).toContainText('GET ' + fixture.url + '/hold')
    await expect(region).toContainText('current draft differs')
    await application.evaluate(({ BrowserWindow }, event) => BrowserWindow.getAllWindows()[0]?.webContents.send('execution:completed', event), old)
    await expect(region).toContainText('Waiting for response')
    delayed?.end('{"captured":true}')
    await expect(body).toHaveText('{"captured":true}')
    await application.evaluate(({ BrowserWindow }, event) => BrowserWindow.getAllWindows()[0]?.webContents.send('execution:completed', event), old)
    await expect(body).toHaveText('{"captured":true}')
    await expect.poll(() => page.evaluate(() => (Reflect.get(window, 'fixtureLastResponse') as import('../src/shared/results').ExecutionCompleted).executionId)).toBe(old.executionId)
    await expect(body).toHaveText('{"captured":true}')
    delayed = undefined
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + '/hold')
    await send.click()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(region).toContainText('Cancelled. No HTTP response.')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.screenshot({ path: '/tmp/api-client-response-cancel.png' })
    await run('/json')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()
    await application.close()
    application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
    const restarted = await application.firstWindow()
    await expect(restarted.getByRole('region', { name: 'Response', exact: true })).toContainText('No response yet.')
    await expect(restarted.getByLabel('Response body text')).toHaveCount(0)
  } finally { await application.close(); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})
