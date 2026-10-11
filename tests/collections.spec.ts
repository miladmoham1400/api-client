import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

async function action(page:Page,id:string,verb:string) {
  await page.locator(`[data-library-id="${id}"]`).getByRole('button',{name:/Actions for/}).click()
  await page.getByRole('menuitem',{name:verb,exact:true}).click()
}
test('collection tree CRUD, contextual moves, failure rollback and workspace isolation preserve saved requests after reopen', async () => {
  const directory=mkdtempSync(join(tmpdir(),'api-client-collection-tree-'))
  const env={...Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string] => e[1]!==undefined && !['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(e[0]))),XDG_CONFIG_HOME:directory,APPDATA:directory}
  let app=await launchDesktop({args:['.'],chromiumSandbox:true,env})
  try {
    let page=await app.firstWindow()
    await expect(page.getByRole('heading',{name:'No request selected'})).toBeVisible()
    const seed=await page.evaluate(async () => {
      const api=window.offlineApi, ws=await api.workspaces.create('Collection workspace')
      if(!ws.ok) throw new Error('Missing workspace')
      const w=ws.data.workspaces[0]!.id; await api.workspaces.select(w)
      const q=await api.requests.create(w,{name:'Root fixture',method:'GET',urlTemplate:'',collectionId:null})
      if(!q.ok) throw new Error('Missing request')
      return {w,q:q.data.editor!.id}
    })
    await page.reload()
    for(let n=0;n<2;n++) {
      await page.getByRole('button',{name:'Create Collection',exact:true}).click()
      const dialog=page.getByRole('dialog',{name:'Create collection',exact:true})
      await expect(dialog.getByLabel('Collection name')).toBeFocused()
      await dialog.getByLabel('Collection name').fill(' '); await dialog.getByRole('button',{name:'Create collection',exact:true}).click()
      await expect(dialog.getByRole('alert')).toContainText('1–100')
      await dialog.getByLabel('Collection name').fill(' Same '); await dialog.getByRole('button',{name:'Create collection',exact:true}).click()
      await expect(dialog).not.toBeVisible()
    }
    const groups=await page.evaluate(w => window.offlineApi.collections.list(w),seed.w)
    if(!groups.ok) throw new Error('Missing collections')
    const [c,d]=groups.data.collections
    if(!c||!d) throw new Error('Missing duplicates')
    expect(await page.getByRole('treeitem',{name:/collection: Same/}).count()).toBe(2)
    await action(page,seed.q,'Move request')
    const move=page.getByRole('dialog',{name:'Move request',exact:true})
    await move.getByLabel('Destination').selectOption(c.id); await move.getByRole('button',{name:'Move',exact:true}).click(); await expect(move).not.toBeVisible()
    await expect(page.locator(`[data-library-id="${seed.q}"]`)).toBeVisible()
    await action(page,c.id,'Rename collection')
    let dialog=page.getByRole('dialog',{name:'Rename collection',exact:true})
    await dialog.getByLabel('Collection name').fill('Renamed'); await dialog.getByRole('button',{name:'Save name',exact:true}).click(); await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('button',{name:'Actions for collection: Renamed',exact:true})).toBeFocused()
    await action(page,c.id,'Delete collection'); dialog=page.getByRole('dialog',{name:'Delete collection',exact:true})
    await expect(dialog).toContainText('0 folders will be removed; 1 saved requests will move to workspace root')
    await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeFocused(); await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
    await app.evaluate(({app},data) => {
      if(!app.getPath('userData').startsWith(data.directory)) throw new Error('Synthetic profile required')
      const load=process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`), Driver:typeof import('better-sqlite3')=load('better-sqlite3'), db=new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try { db.exec('CREATE TRIGGER fail_collection_delete BEFORE DELETE ON collections BEGIN SELECT RAISE(ABORT,\'synthetic\'); END;') } finally { db.close() }
    },{directory})
    await action(page,c.id,'Delete collection'); await dialog.getByRole('button',{name:'Delete collection',exact:true}).click()
    await expect(dialog.getByRole('alert')).toContainText('could not be loaded or saved'); await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
    await app.evaluate(({app}) => { const load=process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`), Driver:typeof import('better-sqlite3')=load('better-sqlite3'), db=new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`); try {db.exec('DROP TRIGGER fail_collection_delete')} finally {db.close()} })
    await action(page,c.id,'Delete collection'); await dialog.getByRole('button',{name:'Delete collection',exact:true}).click(); await expect(dialog).not.toBeVisible()
    expect(await page.evaluate(w => window.offlineApi.requests.list(w),seed.w)).toMatchObject({ok:true,data:{editor:{id:seed.q,collectionId:null,folderId:null}}})
    const other=await page.evaluate(() => window.offlineApi.workspaces.create('Other workspace'))
    if(!other.ok) throw new Error('Missing other workspace')
    const foreign=other.data.selectedWorkspaceId!
    await page.reload()
    await page.getByLabel('Workspace',{exact:true}).selectOption(foreign)
    await expect(page.getByText('Root fixture',{exact:true})).toHaveCount(0)
    await page.getByLabel('Workspace',{exact:true}).selectOption(seed.w)
    await expect(page.locator(`[data-library-id="${seed.q}"]`)).toBeVisible()
    await app.close(); app=await launchDesktop({args:['.'],chromiumSandbox:true,env}); page=await app.firstWindow()
    await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Root fixture')
    expect(await page.evaluate(w => window.offlineApi.collections.list(w),seed.w)).toMatchObject({ok:true,data:{collections:[expect.objectContaining({id:d.id})],requests:[expect.objectContaining({id:seed.q,collectionId:null})]}})
  } finally {await shutdown(app);rmSync(directory,{recursive:true,force:true})}
})
