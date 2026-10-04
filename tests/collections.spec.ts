import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { _electron, expect, test } from '@playwright/test'
import { createDefaultRequestConfig } from '../src/shared/request-config'

test('sidebar collection CRUD and grouping preserve temporary saved requests and workspace isolation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-collection-ui-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  let application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
  try {
    let page = await application.firstWindow()
    await page.getByRole('button', { name: 'Create Workspace', exact: true }).click()
    let dialog = page.getByRole('dialog', { name: 'Create workspace', exact: true })
    await dialog.getByLabel('Workspace name').fill('Collection workspace')
    await dialog.getByRole('button', { name: 'Create workspace', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    const workspace = await page.evaluate(() => window.offlineApi.workspaces.list())
    if (!workspace.ok || !workspace.data.selectedWorkspaceId) throw new Error('Missing workspace')
    const a = workspace.data.selectedWorkspaceId, b = randomUUID(), foreignCollection = randomUUID(), root = randomUUID(), grouped = randomUUID(), foreignRequest = randomUUID()
    const create = async () => {
      await page.getByRole('button', { name: 'Create Collection', exact: true }).click()
      const form = page.getByRole('dialog', { name: 'Create collection', exact: true })
      await expect(form.getByLabel('Collection name')).toBeFocused()
      await form.getByLabel('Collection name').fill('   ')
      await form.getByRole('button', { name: 'Create collection', exact: true }).click()
      await expect(form.getByRole('alert')).toContainText('1–100')
      await form.getByLabel('Collection name').fill('  Same  ')
      await form.getByRole('button', { name: 'Create collection', exact: true }).click()
      await expect(form).not.toBeVisible()
    }
    await create(); await create()
    const grouping = await page.evaluate(id => window.offlineApi.collections.list(id), a)
    if (!grouping.ok) throw new Error('Failed to list grouping')
    const c = grouping.data.collections[0]?.id, d = grouping.data.collections[1]?.id
    if (!c || !d || c === d) throw new Error('Missing distinct duplicate IDs')
    const storedConfig = { ...createDefaultRequestConfig(), auth: { mode: 'none' } }
    // Test-only temporary fixtures, not application defaults or renderer CRUD.
    await application.evaluate(({ app }, data) => {
      const path = `${app.getPath('userData')}/offline-api-client.sqlite`
      if (!path.startsWith(data.directory)) throw new Error('Fixture database must be temporary')
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`)
      const Driver: typeof import('better-sqlite3') = load('better-sqlite3'), db = new Driver(path)
      try {
        db.pragma('foreign_keys = ON')
        db.transaction(() => {
          const stamp = new Date().toISOString()
          db.prepare('INSERT INTO workspaces VALUES (?,?,?,?)').run(data.b, 'Other workspace', stamp, stamp)
          db.prepare('INSERT INTO workspace_state VALUES (?,NULL,NULL)').run(data.b)
          db.prepare('INSERT INTO collections VALUES (?,?,?,?,?,?)').run(data.foreignCollection, data.b, 'Foreign collection', 0, stamp, stamp)
          const insert = db.prepare('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)')
          insert.run(data.root, data.a, null, 'Root fixture', 1, JSON.stringify(data.storedConfig), stamp, stamp)
          insert.run(data.grouped, data.a, data.c, 'Grouped fixture', 1, JSON.stringify(data.storedConfig), stamp, stamp)
          insert.run(data.foreignRequest, data.b, data.foreignCollection, 'Foreign fixture', 1, JSON.stringify(data.storedConfig), stamp, stamp)
        })()
      } finally { db.close() }
    }, { directory, a, b, c, foreignCollection, root, grouped, foreignRequest, storedConfig })
    await page.reload()
    await expect(page.getByRole('group', { name: 'Request: Root fixture', exact: true })).toBeVisible()
    await expect(page.getByText('Foreign fixture', { exact: true })).toHaveCount(0)
    const move = page.getByLabel('Collection for Root fixture', { exact: true })
    await move.selectOption(d)
    await expect(page.getByRole('group', { name: 'Collection 2: Same', exact: true }).getByRole('group', { name: 'Request: Root fixture', exact: true })).toBeVisible()
    await move.selectOption(c)
    await expect(page.getByRole('group', { name: 'Collection 1: Same', exact: true }).getByRole('group', { name: 'Request: Root fixture', exact: true })).toBeVisible()
    await move.selectOption('')
    await expect(move).toHaveValue('')
    const menu = async (label: string, action: string) => {
      await page.getByRole('button', { name: label, exact: true }).click()
      await page.getByRole('menuitem', { name: action, exact: true }).click()
    }
    await menu('Actions for collection 1: Same', 'Rename collection')
    dialog = page.getByRole('dialog', { name: 'Rename collection', exact: true })
    await dialog.getByLabel('Collection name').fill('Renamed')
    await dialog.getByRole('button', { name: 'Save name', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Actions for collection 1: Renamed', exact: true })).toBeFocused()
    await menu('Actions for collection 1: Renamed', 'Delete collection')
    dialog = page.getByRole('dialog', { name: 'Delete collection', exact: true })
    await expect(dialog).toContainText('saved requests will move to workspace root')
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByLabel('Collection for Grouped fixture', { exact: true })).toHaveValue(c)
    await application.evaluate(({ app }, id) => {
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`)
      const Driver: typeof import('better-sqlite3') = load('better-sqlite3'), db = new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try { db.exec(`CREATE TRIGGER fail_collection_delete BEFORE DELETE ON collections WHEN OLD.id='${id}' BEGIN SELECT RAISE(ABORT,'synthetic private detail'); END;`) } finally { db.close() }
    }, c)
    await menu('Actions for collection 1: Renamed', 'Delete collection')
    await dialog.getByRole('button', { name: 'Delete collection', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('could not be loaded or saved')
    const failed = await page.evaluate(id => window.offlineApi.collections.list(id), a)
    expect(failed.ok && failed.data.requests.find(request => request.id === grouped)?.collectionId).toBe(c)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await application.evaluate(({ app }) => {
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`)
      const Driver: typeof import('better-sqlite3') = load('better-sqlite3'), db = new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try { db.exec('DROP TRIGGER fail_collection_delete') } finally { db.close() }
    })
    await menu('Actions for collection 1: Renamed', 'Delete collection')
    await dialog.getByRole('button', { name: 'Delete collection', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByLabel('Collection for Grouped fixture', { exact: true })).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Create Collection', exact: true })).toBeFocused()
    await page.getByLabel('Workspace', { exact: true }).selectOption(b)
    await expect(page.getByText('Foreign fixture', { exact: true })).toBeVisible()
    await expect(page.getByText('Root fixture', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Grouped fixture', { exact: true })).toHaveCount(0)
    expect(await page.evaluate(data => window.offlineApi.requests.move(data.b, data.foreignRequest, data.d), { b, foreignRequest, d })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    await page.getByLabel('Workspace', { exact: true }).selectOption(a)
    await expect(page.getByLabel('Collection for Root fixture', { exact: true })).toHaveValue('')
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.screenshot({ path: '/tmp/api-client-collections.png' })
    await application.close()
    application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
    page = await application.firstWindow()
    await expect(page.getByLabel('Collection for Grouped fixture', { exact: true })).toHaveValue('')
    const restored = await page.evaluate(id => window.offlineApi.collections.list(id), a)
    expect(restored.ok && restored.data.collections.map(collection => collection.id)).toEqual([d])
    expect(restored.ok && restored.data.requests.map(request => request.id).sort()).toEqual([root, grouped].sort())
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  } finally { await application.close(); rmSync(directory, { recursive: true, force: true }) }
})
