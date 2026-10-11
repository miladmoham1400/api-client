import { launchDesktop } from './fixtures/desktop'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { workspaceExportV2Schema } from '../src/shared/transfer'
import { startFixture } from './fixtures/http'
import { shutdown } from './fixtures/shutdown'
const execute = promisify(execFile)
test('native export/import preview confirms only a new workspace, cancels neutrally, rejects invalid data and never sends', async () => {
  test.skip(process.platform !== 'linux' || !process.env.DISPLAY, 'Native chooser is Linux X11 only; other platforms unverified')
  test.setTimeout(60_000)
  const directory = mkdtempSync(join(tmpdir(), 'api-client-import-ui-')), path = join(directory,'workspace.json'), fixture = await startFixture(), captures: string[] = []
  fixture.server.on('request', request => captures.push(request.url ?? ''))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  const application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
    const workspace = await page.evaluate(async url => {
      const api = window.offlineApi, result = await api.workspaces.create('Import fixture')
      if (!result.ok || !result.data.selectedWorkspaceId) throw new Error('Missing workspace')
      const w = result.data.selectedWorkspaceId
      await api.variables.upsert(w,null,'token','synthetic-import-sensitive',true)
      await api.variables.upsert(w,null,'plain','سلام',false)
      const collection = await api.collections.create(w, 'Library')
      if (!collection.ok) throw new Error('Missing collection')
      const c = collection.data.collections[0]!.id
      const root = await api.folders.create(w, c, null, 'Users')
      if (!root.ok) throw new Error('Missing root folder')
      const parent = root.data.folders[0]!.id
      const nested = await api.folders.create(w, c, parent, 'Auth')
      if (!nested.ok) throw new Error('Missing nested folder')
      const folder = nested.data.folders.find(f => f.name === 'Auth')!.id
      const empty = await api.folders.create(w, c, parent, 'Empty')
      if (!empty.ok) throw new Error('Missing empty folder')
      const row = await api.requests.newRow(w)
      if (!row.ok) throw new Error('Missing row')
      const request = await api.requests.create(w,{ name: 'Saved fixture', method: 'POST', urlTemplate: url+'/echo', collectionId: c, folderId: folder,
        auth: { mode: 'bearer', token: { kind: 'value', value: 'synthetic-import-auth' } }, body: { kind: 'multipart', rows: [{ id: row.data.id, key: 'upload', kind: 'file', enabled: true, fileName: 'fixture.bin', fileSize: 6 }] } })
      if (!request.ok) throw new Error('Missing request')
      return w
    }, fixture.url)
    await page.reload()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Saved fixture')
    await page.getByLabel('Request name', { exact: true }).fill('Unsaved draft kept')
    await page.getByRole('button',{ name:'Workspace menu',exact:true }).click()
    await page.getByRole('menuitem',{ name:'Export workspace JSON',exact:true }).click()
    await page.getByRole('button',{ name:'Choose save location',exact:true }).click()
    await execute('python3',['tests/fixtures/native-upload-dialog.py',path,'Export workspace JSON'],{ timeout:15_000 })
    await expect(page.getByRole('dialog',{name:'Export workspace JSON',exact:true})).not.toBeVisible()
    const bytes = readFileSync(path,'utf8'), source = workspaceExportV2Schema.parse(JSON.parse(bytes)), saved = await page.evaluate(w => window.offlineApi.requests.list(w),workspace)
    const databaseBytes = () => application.evaluate(({ app }) => {
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`)
      const Driver: typeof import('better-sqlite3') = load('better-sqlite3'), db = new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try { return Array.from(db.serialize()) } finally { db.close() }
    })
    expect(source.version).toBe(2); expect(source.workspace.folders).toHaveLength(3)
    expect(source.workspace.requests[0]?.folderId).toBe(source.workspace.folders.find(f => f.name === 'Auth')?.id)
    const before = await databaseBytes()
    async function choose(cancel = false) {
      await page.getByRole('button',{name:'Import workspace JSON',exact:true}).click()
      const dialog = page.getByRole('dialog',{name:'Import workspace JSON',exact:true})
      await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeFocused()
      await dialog.getByRole('button',{name:'Choose JSON file',exact:true}).click()
      await execute('python3',['tests/fixtures/native-upload-dialog.py',cancel ? 'cancel' : path,'Import workspace JSON'],{timeout:15_000})
      return dialog
    }
    let dialog = await choose(true)
    await expect(dialog).not.toBeVisible()
    expect(await databaseBytes()).toEqual(before)
    dialog = await choose()
    await expect(dialog).toContainText('1 collections; 3 folders; 0 environments; 1 requests; 2 variables.')
    await expect(dialog).toContainText('Folders:')
    for (const name of ['Users', 'Auth', 'Empty']) await expect(dialog).toContainText(name)
    await expect(dialog).toContainText('1 sensitive variable values, 1 requests requiring credentials, 1 files requiring selection')
    await page.screenshot({path:'/tmp/api-client-import-preview.png',animations:'disabled'})
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('button',{name:'Import workspace JSON',exact:true})).toBeFocused()
    expect(await databaseBytes()).toEqual(before)
    dialog = await choose()
    await expect(dialog.getByRole('button',{name:'Import as new workspace',exact:true})).toBeVisible()
    writeFileSync(path,'{"script":"synthetic-untrusted"}') // Confirmation must use the already validated preview.
    await dialog.getByRole('button',{name:'Import as new workspace',exact:true}).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByLabel('Workspace',{exact:true}).getByRole('option',{name:'Import fixture (imported)',exact:true})).toHaveCount(1)
    await expect(page.getByLabel('Workspace',{exact:true})).toHaveValue(workspace)
    await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Unsaved draft kept')
    expect(await page.evaluate(w=>window.offlineApi.requests.list(w),workspace)).toEqual(saved)
    const imported = await page.evaluate(async () => {
      const list = await window.offlineApi.workspaces.list()
      if (!list.ok) throw new Error('Missing list')
      const w = list.data.workspaces.find(w=>w.name==='Import fixture (imported)')
      if (!w) throw new Error('Missing import')
      return { id:w.id }
    })
    expect(imported.id).not.toBe(workspace)
    expect(JSON.stringify(imported)).not.toContain('synthetic-import-sensitive')
    expect(JSON.stringify(imported)).not.toContain('synthetic-import-auth')
    const after = await databaseBytes()
    dialog = await choose()
    await expect(dialog.getByRole('alert')).toContainText('Invalid workspace import')
    expect(await databaseBytes()).toEqual(after)
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
    await page.getByLabel('Workspace',{exact:true}).selectOption(imported.id)
    await page.getByRole('dialog',{name:'Unsaved request changes',exact:true}).getByRole('button',{name:'Discard',exact:true}).click()
    await expect(page.getByRole('heading',{name:'No request selected',exact:true})).toBeVisible()
    const state = await page.evaluate(async w => ({ requests: await window.offlineApi.requests.list(w), variables: await window.offlineApi.variables.list(w,null), environments: await window.offlineApi.environments.list(w), folders: await window.offlineApi.folders.list(w) }),imported.id)
    if (!state.requests.ok || !state.variables.ok || !state.environments.ok || !state.folders.ok) throw new Error('Missing selected import')
    expect(state.requests.data.editor).toBeNull()
    expect(state.environments.data.activeEnvironmentId).toBeNull()
    expect(state.requests.data.requests[0]?.id).not.toBe(source.workspace.requests[0]?.id)
    expect(state.variables.data.items.find(v=>v.isSensitive)).toMatchObject({hasValue:false,storageMode:'session'})
    const folders = state.folders.data.folders, parent = folders.find(f => f.name === 'Users')!, nested = folders.find(f => f.name === 'Auth')!
    expect(folders).toHaveLength(3); expect(nested.parentFolderId).toBe(parent.id)
    expect(folders.find(f => f.name === 'Empty')?.parentFolderId).toBe(parent.id)
    expect(state.requests.data.requests[0]?.folderId).toBe(nested.id)
    for (const folder of folders) expect(source.workspace.folders.map(f => f.id)).not.toContain(folder.id)
    await page.locator(`[data-library-id="${nested.collectionId}"]`).press('ArrowRight')
    await page.locator(`[data-library-id="${parent.id}"]`).press('ArrowRight')
    await page.locator(`[data-library-id="${nested.id}"]`).press('ArrowRight')
    await page.getByRole('button',{name:'Saved fixture',exact:true}).click()
    const editor = page.getByRole('region',{name:'Request editor',exact:true})
    await editor.getByRole('tab',{name:'Body',exact:true}).click()
    await expect(page.getByRole('group',{name:'Multipart row 1',exact:true})).toContainText('select again')
    await editor.getByRole('tab',{name:'Auth',exact:true}).click()
    await expect(editor).toContainText('re-enter')
    expect(captures).toEqual([])
    writeFileSync(path,bytes)
  } finally { await shutdown(application); await fixture.close(); rmSync(directory,{recursive:true,force:true}) }
})
