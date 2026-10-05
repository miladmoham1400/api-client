import { shutdown } from './fixtures/shutdown'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { _electron, expect, test } from '@playwright/test'
import { startMultipartFixture } from './fixtures/multipart'

const execute = promisify(execFile)
test('multipart editor selects native files, sends unsaved rows, preserves selection on Save and requires reselection after restart', async () => {
  test.skip(process.platform !== 'linux' || !process.env.DISPLAY, 'Actual native chooser automation requires Linux/X11; no Windows acceptance is claimed')
  const fixture = await startMultipartFixture(), directory = mkdtempSync(join(tmpdir(), 'multipart-native-'))
  const path = join(directory, 'fixture.bin'), bytes = Buffer.from([0, 255, 1, 13, 10, 128]); writeFileSync(path, bytes)
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  let application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
  try {
    let page = await application.firstWindow()
    await page.getByRole('button', { name: 'Create Workspace', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Create workspace', exact: true })
    await dialog.getByLabel('Workspace name').fill('Multipart fixture')
    await dialog.getByRole('button', { name: 'Create workspace', exact: true }).click(); await expect(dialog).not.toBeVisible()
    const workspace = await page.getByLabel('Workspace', { exact: true }).inputValue()
    await page.evaluate(w => window.offlineApi.variables.upsert(w, null, 'word', 'سلام 🌍', false), workspace)
    await page.getByRole('button', { name: 'Create Request', exact: true }).click()
    await page.getByLabel('Request name', { exact: true }).fill('Multipart')
    await page.getByLabel('HTTP method', { exact: true }).selectOption('POST')
    await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + '/redirect-307')
    let editor = page.getByRole('region', { name: 'Request editor', exact: true })
    await editor.getByRole('tab', { name: 'Settings', exact: true }).click(); await page.getByLabel('Follow redirects', { exact: true }).check()
    await editor.getByRole('tab', { name: 'Body', exact: true }).click()
    await page.getByLabel('Body mode', { exact: true }).selectOption('multipart')
    await page.getByRole('button', { name: 'Add multipart text', exact: true }).click()
    await page.getByLabel('Multipart 1 key', { exact: true }).fill('same')
    await page.getByLabel('Multipart 1 value', { exact: true }).fill('{{word}}')
    await page.getByRole('button', { name: 'Add multipart file', exact: true }).click()
    await page.getByLabel('Multipart 2 key', { exact: true }).fill('نام 🌍')
    const choose = async (index: number, cancel = false) => {
      await page.getByRole('button', { name: `Choose multipart ${index} file`, exact: true }).click()
      await execute('python3', ['tests/fixtures/native-upload-dialog.py', cancel ? 'cancel' : path], { timeout: 15_000 })
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
      if (!cancel) await expect(page.getByRole('group', { name: `Multipart row ${index}`, exact: true })).toContainText('fixture.bin (6 bytes)')
    }
    await choose(2); await choose(2, true)
    await page.getByRole('button', { name: 'Add multipart text', exact: true }).click()
    await page.getByLabel('Multipart 3 key', { exact: true }).fill('same'); await page.getByLabel('Multipart 3 value', { exact: true }).fill('last')
    await page.getByRole('button', { name: 'Add multipart file', exact: true }).click()
    await page.getByLabel('Multipart 4 key', { exact: true }).fill('{{missing}}'); await page.getByLabel('Multipart 4 enabled', { exact: true }).uncheck()
    await page.getByRole('button', { name: 'Move multipart 2 up', exact: true }).click()
    await expect(page.getByLabel('Multipart 1 type', { exact: true })).toHaveValue('file')
    await page.getByRole('button', { name: 'Move multipart 1 down', exact: true }).click()
    const send = async () => { await page.getByRole('button', { name: 'Send', exact: true }).click(); await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled() }
    await send(); await expect(page.getByLabel('Response body text')).toContainText('filename')
    expect(fixture.captures).toHaveLength(2)
    expect(fixture.captures[0]?.parts).toEqual([{ name: 'same', value: 'سلام 🌍' }, { name: 'نام 🌍', filename: 'fixture.bin', bytes: bytes.toString('base64') }, { name: 'same', value: 'last' }])
    expect(fixture.captures[1]?.parts).toEqual(fixture.captures[0]?.parts)
    await page.screenshot({ path: '/tmp/api-client-multipart.png' })
    expect(await page.evaluate(w => window.offlineApi.requests.list(w), workspace)).toMatchObject({ ok: true, data: { requests: [], editor: null } })
    await page.getByLabel('Body mode', { exact: true }).selectOption('json'); await page.getByLabel('JSON source text', { exact: true }).fill('{"inactive":true}')
    await page.getByLabel('Body mode', { exact: true }).selectOption('multipart')
    await expect(page.getByRole('button', { name: 'Choose multipart 2 file', exact: true })).toHaveText('Replace file')
    await page.keyboard.press('Control+s'); await expect(editor.getByText('Saved', { exact: true })).toBeVisible()
    await send(); expect(fixture.captures).toHaveLength(4) // Save kept the live selection but stored no handle.
    await application.close(); application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env }); page = await application.firstWindow()
    editor = page.getByRole('region', { name: 'Request editor', exact: true })
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Multipart')
    await editor.getByRole('tab', { name: 'Body', exact: true }).click()
    await expect(page.getByLabel('Body mode', { exact: true })).toHaveValue('multipart')
    await expect(page.getByRole('group', { name: 'Multipart row 2', exact: true })).toContainText('select again')
    await send(); await expect(editor.getByRole('alert').first()).toContainText('FILE_REQUIRED')
    expect(fixture.captures).toHaveLength(4)
    await choose(2)
    await send(); expect(fixture.captures).toHaveLength(6)
    await page.getByRole('button', { name: 'Add multipart text', exact: true }).click(); await page.getByLabel('Multipart 5 type', { exact: true }).selectOption('file')
    await choose(5)
    await page.getByRole('button', { name: 'Remove multipart 5', exact: true }).click(); await expect(page.getByRole('group', { name: 'Multipart row 5', exact: true })).toHaveCount(0)
    await editor.getByRole('tab', { name: 'Headers', exact: true }).click(); await page.getByRole('button', { name: 'Add header', exact: true }).click()
    await page.getByLabel('Header 1 key', { exact: true }).fill('Content-Type'); await page.getByLabel('Header 1 value', { exact: true }).fill('multipart/form-data; boundary=forged')
    await send(); await expect(editor.getByRole('alert').first()).toContainText('CONTENT_TYPE_CONFLICT'); expect(fixture.captures).toHaveLength(6)
  } finally { await shutdown(application); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})
