import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { startFixture } from './fixtures/http'

test('form editor sends unsaved ordered snapshots, validates before I/O and reopens saved forms', async () => {
  const fixture = await startFixture(), requests: string[] = [], directory = mkdtempSync(join(tmpdir(), 'api-client-form-ui-'))
  fixture.server.on('request', request => requests.push(request.url ?? ''))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  let application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
  try {
    let page = await application.firstWindow()
    await page.getByRole('button', { name: 'Create Workspace', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Create workspace', exact: true })
    await dialog.getByLabel('Workspace name').fill('Form fixture')
    await dialog.getByRole('button', { name: 'Create workspace', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    const workspace = await page.getByLabel('Workspace', { exact: true }).inputValue()
    await page.evaluate(async w => {
      await window.offlineApi.variables.upsert(w, null, 'key', 'same', false)
      await window.offlineApi.variables.upsert(w, null, 'word', 'سلام 🌍', false)
    }, workspace)
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    await page.getByLabel('Request name', { exact: true }).fill('Form')
    await page.getByLabel('HTTP method', { exact: true }).selectOption('POST')
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + '/echo')
    const editor = page.getByRole('region', { name: 'Request editor', exact: true })
    await editor.getByRole('tab', { name: 'Body', exact: true }).click()
    await page.getByLabel('Body mode', { exact: true }).selectOption('urlencoded')
    for (const [index, [key, value]] of [['empty', ''], ['{{key}}', '%2F'], ['same', '{{word}}'], ['{{missing}}', '{{missing}}']].entries()) {
      await editor.getByRole('button', { name: 'Add form', exact: true }).click()
      await page.getByLabel(`Form ${index + 1} key`, { exact: true }).fill(key!)
      await page.getByLabel(`Form ${index + 1} value`, { exact: true }).fill(value!)
    }
    await page.getByLabel('Form 4 enabled', { exact: true }).uncheck()
    await page.getByRole('button', { name: 'Move form 2 up', exact: true }).click()
    await expect(page.getByLabel('Form 1 key', { exact: true })).toHaveValue('{{key}}')
    await page.getByRole('button', { name: 'Move form 1 down', exact: true }).click()
    await editor.getByRole('button', { name: 'Add form', exact: true }).click()
    await page.getByRole('button', { name: 'Remove form 5', exact: true }).click()
    await expect(page.getByRole('group', { name: 'Form row 5', exact: true })).toHaveCount(0)
    const send = async () => {
      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled()
    }
    await send()
    const expected = 'empty=&same=%252F&same=%D8%B3%D9%84%D8%A7%D9%85+%F0%9F%8C%8D'
    const echo = JSON.parse(await page.getByLabel('Response body text').textContent() ?? '') as unknown
    expect(echo).toMatchObject({ bodyBase64: Buffer.from(expected).toString('base64'), bodyLength: Buffer.byteLength(expected), rawHeaders: expect.arrayContaining(['application/x-www-form-urlencoded']) })
    expect(requests).toHaveLength(1)
    expect(await page.evaluate(w => window.offlineApi.requests.list(w), workspace)).toMatchObject({ ok: true, data: { requests: [], editor: null } })
    await page.getByLabel('Form 4 enabled', { exact: true }).check()
    await send()
    await expect(page.getByRole('alert')).toContainText('VARIABLE_MISSING:')
    await expect(page.getByRole('alert')).toContainText('body.rows[3].key')
    expect(requests).toHaveLength(1)
    await page.getByLabel('Form 4 enabled', { exact: true }).uncheck()
    await editor.getByRole('tab', { name: 'Headers', exact: true }).click()
    await editor.getByRole('button', { name: 'Add header', exact: true }).click()
    await page.getByLabel('Header 1 key', { exact: true }).fill('Content-Type')
    await page.getByLabel('Header 1 value', { exact: true }).fill('application/json')
    await send()
    await expect(page.getByRole('alert')).toContainText('CONTENT_TYPE_CONFLICT:')
    expect(requests).toHaveLength(1)
    await page.getByLabel('Header 1 value', { exact: true }).fill('application/x-www-form-urlencoded; charset=utf-8')
    await send()
    await expect(page.getByLabel('Response body text')).toContainText('bodyBase64')
    expect(requests).toHaveLength(2)
    await editor.getByRole('tab', { name: 'Body', exact: true }).click()
    await page.getByLabel('Body mode', { exact: true }).selectOption('json')
    await page.getByLabel('JSON source text', { exact: true }).fill('{"inactive":true}')
    await page.getByLabel('Body mode', { exact: true }).selectOption('urlencoded')
    await expect(page.getByLabel('Form 2 value', { exact: true })).toHaveValue('%2F')
    await page.keyboard.press('Control+s')
    await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()
    const saved = await page.evaluate(w => window.offlineApi.requests.list(w), workspace)
    expect(saved).toMatchObject({ ok: true, data: { editor: { body: { kind: 'urlencoded', rows: [{ key: 'empty', value: '' }, { key: '{{key}}', value: '%2F' }, { key: 'same', value: '{{word}}' }, { key: '{{missing}}', value: '{{missing}}', enabled: false }] } } } })
    await page.screenshot({ path: '/tmp/api-client-urlencoded.png', animations: 'disabled' })
    await application.close()
    application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
    page = await application.firstWindow()
    await page.getByRole('region', { name: 'Request editor', exact: true }).getByRole('tab', { name: 'Body', exact: true }).click()
    await expect(page.getByLabel('Body mode', { exact: true })).toHaveValue('urlencoded')
    await expect(page.getByLabel('Form 2 value', { exact: true })).toHaveValue('%2F')
    await expect(page.getByLabel('Form 4 enabled', { exact: true })).not.toBeChecked()
    expect(await page.evaluate(w => window.offlineApi.requests.list(w), workspace)).toEqual(saved)
    expect(requests).toHaveLength(2)
    await send()
    expect(JSON.parse(await page.getByLabel('Response body text').textContent() ?? '')).toMatchObject({ bodyBase64: Buffer.from(expected).toString('base64') })
    expect(requests).toHaveLength(3)
    await page.getByLabel('Body mode', { exact: true }).selectOption('json')
    await expect(page.getByLabel('JSON source text', { exact: true })).toHaveValue('')
  } finally { await shutdown(application); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})
