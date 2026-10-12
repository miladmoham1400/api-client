import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchDesktop } from '../tests/fixtures/desktop'
import { shutdown } from '../tests/fixtures/shutdown'
import { startFixture } from '../tests/fixtures/http'

// TASK-037 diagnostic (not acceptance evidence): repeats library-tree.spec.ts:105 up to the failing step, then records
// whether the folder rename reached the database while the Rename dialog stayed open.
const envFor = (directory: string) => ({ ...Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(e[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory })
async function action(page: Page, id: string, name: string) {
  await page.locator(`[data-library-id="${id}"]`).getByRole('button', { name: /Actions for/ }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}
test('diagnose rename after dirty Save', async () => {
  const fixture = await startFixture(), directory = mkdtempSync(join(tmpdir(), 'api-client-diag-')), app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env: envFor(directory) })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Create Workspace', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'Create workspace', exact: true })
    await form.getByLabel('Workspace name').fill('Diag'); await form.getByRole('button', { name: 'Create workspace', exact: true }).click(); await expect(form).not.toBeVisible()
    const ws = await page.evaluate(() => window.offlineApi.workspaces.list()); if (!ws.ok || !ws.data.selectedWorkspaceId) throw new Error('Missing workspace'); const w = ws.data.selectedWorkspaceId
    const seed = await page.evaluate(async w => { const api = window.offlineApi, c = await api.collections.create(w, 'API'); if (!c.ok) throw new Error('c'); const id = c.data.collections[0]!.id, f = await api.folders.create(w, id, null, 'Folder'); if (!f.ok) throw new Error('f'); return { c: id, f: f.data.folders[0]!.id } }, w)
    await page.reload()
    const node = page.locator(`[data-library-id="${seed.c}"]`); if (await node.getAttribute('aria-expanded') === 'false') await node.getByRole('button').first().click()
    await action(page, seed.f, 'New request')
    await page.getByLabel('Request name', { exact: true }).fill('Hold'); await page.getByLabel('Request URL', { exact: true }).fill(fixture.url + '/echo')
    await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible()
    await page.getByLabel('Request name', { exact: true }).fill('Dirty name')
    await action(page, seed.f, 'Rename folder')
    const rename = page.getByRole('dialog', { name: 'Rename folder', exact: true }), dirty = page.getByRole('dialog', { name: 'Unsaved request changes', exact: true })
    await rename.getByLabel('Folder name').fill('Renamed'); await rename.getByRole('button', { name: 'Save name', exact: true }).click()
    await dirty.getByRole('button', { name: 'Save', exact: true }).click()
    const started = Date.now(), samples: string[] = []
    for (let i = 0; i < 12; i++) {
      const visible = await rename.isVisible()
      const lib = await page.evaluate(w => window.offlineApi.library.list(w), w)
      const req = await page.evaluate(w => window.offlineApi.requests.list(w), w)
      const folderName = lib.ok ? lib.data.folders.find(f => f.id === seed.f)?.name : 'list-failed'
      const saved = req.ok ? req.data.requests.map(r => r.name).join('|') : 'list-failed'
      const alert = await rename.getByRole('alert').allTextContents().catch(() => [])
      samples.push(`+${Date.now() - started}ms renameDialogVisible=${visible} dbFolderName=${folderName} savedRequests=${saved} dialogAlert=${JSON.stringify(alert)} saveNameEnabled=${visible ? await rename.getByRole('button', { name: /Save name|Saving/ }).isEnabled() : 'n/a'}`)
      await page.waitForTimeout(250)
    }
    console.log('TASK037-DIAG\n' + samples.join('\n'))
  } finally { await shutdown(app); await fixture.close(); rmSync(directory, { recursive: true, force: true }) }
})
