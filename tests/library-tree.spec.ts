import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'

const envFor=(directory:string) => ({...Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string] => e[1]!==undefined && !['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(e[0]))),XDG_CONFIG_HOME:directory,APPDATA:directory})
async function workspace(page:Page,name:string) {
  await page.getByRole('button',{name:'Create Workspace',exact:true}).click()
  const form=page.getByRole('dialog',{name:'Create workspace',exact:true})
  await form.getByLabel('Workspace name').fill(name);await form.getByRole('button',{name:'Create workspace',exact:true}).click();await expect(form).not.toBeVisible()
  const ws=await page.evaluate(() => window.offlineApi.workspaces.list());if(!ws.ok||!ws.data.selectedWorkspaceId) throw new Error('Missing workspace');return ws.data.selectedWorkspaceId
}
async function action(page:Page,id:string,name:string) {
  await page.locator(`[data-library-id="${id}"]`).getByRole('button',{name:/Actions for/}).click()
  await page.getByRole('menuitem',{name,exact:true}).click()
}
async function expand(page:Page,id:string) { const node=page.locator(`[data-library-id="${id}"]`);if(await node.getAttribute('aria-expanded')==='false') await node.getByRole('button').first().click() }
async function folder(page:Page,w:string,parent:string,name:string) {
  await action(page,parent,'New folder')
  const form=page.getByRole('dialog',{name:'Create folder',exact:true})
  await form.getByLabel('Folder name').fill(name);await form.getByRole('button',{name:'Create folder',exact:true}).click();await expect(form).not.toBeVisible()
  const list=await page.evaluate(w => window.offlineApi.library.list(w),w);if(!list.ok) throw new Error('Missing library')
  const created=list.data.folders.filter(f => f.name===name && (f.parentFolderId===parent || f.collectionId===parent)).at(-1)
  if(!created) throw new Error('Missing folder');await expand(page,parent);return created.id
}
async function savedRequest(page:Page,container:string,name:string,url:string,post=false) {
  await action(page,container,'New request')
  await page.getByLabel('Request name',{exact:true}).fill(name);await page.getByLabel('Request URL',{exact:true}).fill(url)
  if(post) {await page.getByLabel('HTTP method',{exact:true}).selectOption('POST');await page.getByRole('region',{name:'Request editor',exact:true}).getByRole('tab',{name:'Body',exact:true}).click();await page.getByLabel('Body mode',{exact:true}).selectOption('json');await page.getByLabel('JSON source text',{exact:true}).fill('{"auth":true}')}
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('status').filter({hasText:/^Saved$/})).toBeVisible()
}
test('Users/Admin and Users/Auth contextual tree works, sends only selected request, preserves paths/deletion and expansion on normal restart', async () => {
  test.setTimeout(120_000)
  const received:{method:string|undefined;url:string|undefined;body:string}[]=[]
  const fixture=await startFixture(false,(request,response) => {let body='';request.setEncoding('utf8');request.on('data',(chunk:string) => body+=chunk);request.on('end',() => {received.push({method:request.method,url:request.url,body});response.writeHead(200,{'Content-Type':'application/json'});response.end('{"ok":true}')})})
  const directory=mkdtempSync(join(tmpdir(),'api-client-tree-ui-')),env=envFor(directory)
  let app=await launchDesktop({args:['.'],chromiumSandbox:true,env})
  try {
    let page=await app.firstWindow()
    const w=await workspace(page,'Tree example')
    await page.getByRole('button',{name:'Create Collection',exact:true}).click()
    const form=page.getByRole('dialog',{name:'Create collection',exact:true})
    await form.getByLabel('Collection name').fill('API');await form.getByRole('button',{name:'Create collection',exact:true}).click();await expect(form).not.toBeVisible()
    const initial=await page.evaluate(w => window.offlineApi.library.list(w),w);if(!initial.ok) throw new Error('Missing library')
    const c=initial.data.collections[0]!.id,users=await folder(page,w,c,'Users'),admin=await folder(page,w,users,'Admin'),auth=await folder(page,w,users,'Auth')
    await savedRequest(page,admin,'Admins',fixture.url+'/admin')
    await savedRequest(page,auth,'Login',fixture.url+'/login',true)
    const library=await page.evaluate(w => window.offlineApi.library.list(w),w);if(!library.ok) throw new Error('Missing library')
    const adminRequest=library.data.requests.find(r => r.name==='Admins')!.id,login=library.data.requests.find(r => r.name==='Login')!.id
    await expect(page.getByLabel('Request location')).toHaveText('Workspace root / API / Users / Auth')
    expect(received).toEqual([])
    await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('status').filter({hasText:/^Request completed$/})).toBeVisible()
    expect(received).toEqual([{method:'POST',url:'/login',body:'{"auth":true}'}])
    await page.locator(`[data-library-id="${adminRequest}"]`).getByRole('button').first().click()
    await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Admins');await expect(page.getByLabel('Request location')).toContainText('/ Admin')
    expect(received).toHaveLength(1)
    await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('status').filter({hasText:/^Request completed$/})).toBeVisible()
    expect(received.at(-1)).toEqual({method:'GET',url:'/admin',body:''})
    await action(page,admin,'Move folder')
    let dialog=page.getByRole('dialog',{name:'Move folder',exact:true})
    await dialog.getByLabel('Destination').selectOption(auth);await dialog.getByRole('button',{name:'Move',exact:true}).click();await expect(dialog).not.toBeVisible()
    await expect(page.getByLabel('Request location')).toHaveText('Workspace root / API / Users / Auth / Admin')
    await action(page,auth,'Rename folder');dialog=page.getByRole('dialog',{name:'Rename folder',exact:true})
    await dialog.getByLabel('Folder name').fill('Authentication');await dialog.getByRole('button',{name:'Save name',exact:true}).click();await expect(dialog).not.toBeVisible()
    await action(page,users,'Delete folder');dialog=page.getByRole('dialog',{name:'Delete folder',exact:true})
    await expect(dialog).toContainText('2 descendant folders and 2 requests will be retained')
    await dialog.getByRole('button',{name:'Delete folder',exact:true}).click();await expect(dialog).not.toBeVisible()
    await expect(page.getByLabel('Request location')).toHaveText('Workspace root / API / Authentication / Admin')
    await expect(page.getByLabel('Destination',{exact:true})).toHaveCount(0)
    // Keyboard focus/tree semantics and empty duplicate names, with no request selection/send.
    const empty=await folder(page,w,c,'Empty');await folder(page,w,c,'Empty')
    await expect(page.getByRole('treeitem',{name:/folder: Empty \(/})).toHaveCount(2)
    const row=page.locator(`[data-library-id="${empty}"]`);await row.focus();await row.press('ArrowLeft');await expect(page.locator(`[data-library-id="${c}"]`)).toBeFocused()
    await page.locator(`[data-library-id="${c}"]`).press('ArrowRight');await expect(page.getByRole('treeitem').filter({has:page.getByRole('button',{name:'Authentication',exact:true})})).toBeFocused()
    await page.setViewportSize({width:1000,height:700})
    for(const theme of ['light','dark'] as const) {
      await page.getByLabel('Theme',{exact:true}).selectOption(theme);await expect(page.locator('html')).toHaveClass(theme);await expect(page.getByLabel('Theme',{exact:true})).toBeEnabled()
      await expect.poll(() => page.locator(`[data-library-id="${auth}"]`).getByRole('button').first().evaluate(element => {
        const luminance=(color:string) => {const values=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v => {const n=v/255;return n<=0.04045 ? n/12.92 : ((n+0.055)/1.055)**2.4});return values[0]!*0.2126+values[1]!*0.7152+values[2]!*0.0722}
        let parent:Element|null=element,bg=''
        while(parent) {bg=getComputedStyle(parent).backgroundColor;if(bg!=='transparent'&&bg!=='rgba(0, 0, 0, 0)') break;parent=parent.parentElement}
        const a=luminance(getComputedStyle(element).color),b=luminance(bg);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)
      })).toBeGreaterThanOrEqual(4.5)
      expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      await page.screenshot({path:`/tmp/api-client-tree-${theme}.png`,animations:'disabled'})
    }
    await page.locator(`[data-library-id="${adminRequest}"]`).getByRole('button').first().click()
    await expect.poll(async () => {const state=await page.evaluate(w => window.offlineApi.library.list(w),w);return state.ok && state.data.treeState.expandedFolderIds.includes(admin)}).toBe(true)
    await app.close();app=await launchDesktop({args:['.'],chromiumSandbox:true,env});page=await app.firstWindow()
    await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Admins');await expect(page.locator(`[data-library-id="${adminRequest}"]`)).toBeVisible()
    await expect(page.getByLabel('Request location')).toHaveText('Workspace root / API / Authentication / Admin')
    const restored=await page.evaluate(w => window.offlineApi.library.list(w),w)
    expect(restored).toMatchObject({ok:true,data:{treeState:{expandedCollectionIds:[c],expandedFolderIds:expect.arrayContaining([auth,admin])}}})
    await action(page,c,'Delete collection');dialog=page.getByRole('dialog',{name:'Delete collection',exact:true})
    await expect(dialog).toContainText('4 folders will be removed; 2 saved requests will move to workspace root')
    await dialog.getByRole('button',{name:'Delete collection',exact:true}).click();await expect(dialog).not.toBeVisible()
    expect(await page.evaluate(w => window.offlineApi.requests.list(w),w)).toMatchObject({ok:true,data:{editor:{id:adminRequest,folderId:null,collectionId:null},requests:expect.arrayContaining([expect.objectContaining({id:login,folderId:null})])}})
    expect(received).toHaveLength(2)
  } finally {await shutdown(app);await fixture.close();rmSync(directory,{recursive:true,force:true})}
})

test('folder actions use dirty and active-send guards; cancelled contextual drafts never create a blank saved row', async () => {
  test.setTimeout(90_000)
  const fixture=await startFixture(),directory=mkdtempSync(join(tmpdir(),'api-client-tree-guards-')),app=await launchDesktop({args:['.'],chromiumSandbox:true,env:envFor(directory)})
  try {
    const page=await app.firstWindow(),w=await workspace(page,'Tree guards')
    const seed=await page.evaluate(async w => {const api=window.offlineApi,c=await api.collections.create(w,'API');if(!c.ok) throw new Error('Missing collection');const id=c.data.collections[0]!.id,f=await api.folders.create(w,id,null,'Folder');if(!f.ok) throw new Error('Missing folder');return {c:id,f:f.data.folders[0]!.id}},w)
    await page.reload();await expand(page,seed.c)
    await savedRequest(page,seed.f,'Hold',fixture.url+'/hold')
    await page.getByLabel('Request name',{exact:true}).fill('Dirty name')
    await page.getByRole('group',{name:'Request: Hold',exact:true}).getByRole('button').first().click()
    await expect(page.getByRole('dialog',{name:'Unsaved request changes',exact:true})).toHaveCount(0)
    await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Dirty name')
    await action(page,seed.f,'Rename folder')
    const rename=page.getByRole('dialog',{name:'Rename folder',exact:true});await rename.getByLabel('Folder name').fill('Renamed');await rename.getByRole('button',{name:'Save name',exact:true}).click()
    const dirty=page.getByRole('dialog',{name:'Unsaved request changes',exact:true});await dirty.getByRole('button',{name:'Cancel',exact:true}).click();await expect(rename).toBeVisible();await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Dirty name')
    await rename.getByRole('button',{name:'Save name',exact:true}).click();await dirty.getByRole('button',{name:'Save',exact:true}).click();await expect(rename).not.toBeVisible();await expect(page.getByLabel('Request location')).toContainText('/ Renamed')
    await action(page,seed.f,'New request');await page.getByLabel('Request name',{exact:true}).fill('Scratch')
    await page.getByRole('button',{name:'Create Request',exact:true}).click();await dirty.getByRole('button',{name:'Cancel',exact:true}).click()
    const saved=await page.evaluate(w => window.offlineApi.requests.list(w),w);expect(saved).toMatchObject({ok:true,data:{requests:[expect.objectContaining({name:'Dirty name'})]}})
    await page.getByRole('button',{name:'Discard edits',exact:true}).click()
    await page.getByRole('group',{name:'Request: Dirty name',exact:true}).getByRole('button').first().click()
    await page.getByLabel('Request name',{exact:true}).fill('Discard folder edits')
    await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('status').filter({hasText:/^Sending request/})).toBeVisible()
    await action(page,seed.f,'Delete folder')
    const remove=page.getByRole('dialog',{name:'Delete folder',exact:true});await remove.getByRole('button',{name:'Delete folder',exact:true}).click()
    const active=page.getByRole('dialog',{name:'Request in progress',exact:true});await active.getByRole('button',{name:'Stay',exact:true}).click();await expect(remove).toBeVisible()
    expect(await page.evaluate(w => window.offlineApi.folders.list(w),w)).toMatchObject({ok:true,data:{folders:[expect.objectContaining({id:seed.f})]}})
    await remove.getByRole('button',{name:'Delete folder',exact:true}).click();await active.getByRole('button',{name:'Cancel request',exact:true}).click();await dirty.getByRole('button',{name:'Discard',exact:true}).click();await expect(remove).not.toBeVisible()
    await expect(page.getByRole('status').filter({hasText:/^Request cancelled$/})).toBeVisible()
    expect(await page.evaluate(w => window.offlineApi.requests.list(w),w)).toMatchObject({ok:true,data:{editor:{name:'Dirty name',collectionId:seed.c,folderId:null}}})
    const remaining=await page.evaluate(w => window.offlineApi.requests.list(w),w)
    if(!remaining.ok) throw new Error('Missing surviving request')
    const q=remaining.data.editor!.id
    await action(page,q,'Rename request');await expect(page.getByLabel('Request name',{exact:true})).toBeFocused()
    await page.getByLabel('Request name',{exact:true}).fill('Discard before delete')
    await action(page,q,'Delete request')
    const removeRequest=page.getByRole('dialog',{name:'Delete request',exact:true})
    await expect(removeRequest).toContainText('1 saved request will be permanently deleted')
    await removeRequest.getByRole('button',{name:'Delete request',exact:true}).click();await dirty.getByRole('button',{name:'Discard',exact:true}).click();await expect(removeRequest).not.toBeVisible()
    await expect(page.getByRole('heading',{name:'No request selected',exact:true})).toBeVisible()
    expect(await page.evaluate(w => window.offlineApi.requests.list(w),w)).toMatchObject({ok:true,data:{requests:[],editor:null}})
  } finally {await shutdown(app);await fixture.close();rmSync(directory,{recursive:true,force:true})}
})
