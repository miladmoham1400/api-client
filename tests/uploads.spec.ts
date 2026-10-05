import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { uploadResultSchema } from '../src/shared/files'
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

const execute = promisify(execFile)
test('Linux native selection/cancel, workspace isolation, reload and restart require reselection', async () => {
  test.skip(process.platform !== 'linux' || !process.env.DISPLAY, 'Requires Linux X11 native-dialog automation; Windows is untested')
  const directory = mkdtempSync(join(tmpdir(), 'upload-native-'))
  const path = join(directory, 'fixture.txt'); writeFileSync(path, 'native upload fixture')
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[0] !== 'ELECTRON_RUN_AS_NODE' && entry[0] !== 'ELECTRON_RENDERER_URL'))
  env.XDG_CONFIG_HOME = directory; env.APPDATA = directory
  let application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
  try {
    let page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
    const first = await page.evaluate(() => window.offlineApi.workspaces.create('Upload fixture'))
    const second = await page.evaluate(() => window.offlineApi.workspaces.create('Other fixture'))
    if (!first.ok || !second.ok || !first.data.selectedWorkspaceId || !second.data.selectedWorkspaceId) throw new Error('Workspaces missing')
    const workspace = first.data.selectedWorkspaceId, other = second.data.selectedWorkspaceId
    async function select() {
      await page.evaluate(w => {
        Reflect.deleteProperty(window, 'uploadResult')
        void window.offlineApi.files.chooseUpload(w).then(value => Reflect.set(window, 'uploadResult', value))
      }, workspace)
      await execute('python3', ['tests/fixtures/native-upload-dialog.py', path], { timeout: 15_000 })
      await expect.poll(() => page.evaluate(() => Reflect.get(window, 'uploadResult'))).toMatchObject({ ok: true, data: { name: 'fixture.txt', size: 21 } })
      const result = uploadResultSchema.parse(await page.evaluate(() => Reflect.get(window, 'uploadResult')))
      if (!result.ok || !result.data) throw new Error('Selection failed')
      expect(Object.keys(result.data).sort()).toEqual(['fileId', 'name', 'size'])
      expect(JSON.stringify(result)).not.toContain(directory)
      return result.data.fileId
    }
    const fileId = await select()
    expect(await page.evaluate(([w, id]) => window.offlineApi.files.releaseUpload(w!, id!), [other, fileId])).toMatchObject({ ok: false, error: { code: 'FILE_REQUIRED' } })
    expect(await page.evaluate(([w, id]) => window.offlineApi.files.releaseUpload(w!, id!), [workspace, randomUUID()])).toMatchObject({ ok: false, error: { code: 'FILE_REQUIRED' } })
    await page.evaluate(w => { void window.offlineApi.files.chooseUpload(w).then(value => Reflect.set(window, 'cancelResult', value)) }, workspace)
    await execute('python3', ['tests/fixtures/native-upload-dialog.py', 'cancel'], { timeout: 15_000 })
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'cancelResult'))).toEqual({ ok: true, data: null })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
    expect(await page.evaluate(([w, id]) => window.offlineApi.files.releaseUpload(w!, id!), [workspace, fileId])).toMatchObject({ ok: false, error: { code: 'FILE_REQUIRED' } })
    const restartId = await select()
    await application.close()
    application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
    page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
    expect(await page.evaluate(([w, id]) => window.offlineApi.files.releaseUpload(w!, id!), [workspace, restartId])).toMatchObject({ ok: false, error: { code: 'FILE_REQUIRED' } })
    const deletionId = await select()
    expect((await page.evaluate(w => window.offlineApi.workspaces.delete(w), workspace)).ok).toBe(true)
    expect(await page.evaluate(([w, id]) => window.offlineApi.files.releaseUpload(w!, id!), [workspace, deletionId])).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  } finally { await shutdown(application); rmSync(directory, { recursive: true, force: true }) }
})
