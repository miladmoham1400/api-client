import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'
test('late search replies cannot replace newer queries or cross workspace changes',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'api-client-search-race-')),env={...Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined&&!['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(e[0]))),XDG_CONFIG_HOME:directory,APPDATA:directory},app=await launchDesktop({args:['.'],chromiumSandbox:true,env})
  try {
    const page=await app.firstWindow()
    const seed=await page.evaluate(async()=>{
      const api=window.offlineApi,w=await api.workspaces.create('First');if(!w.ok||!w.data.selectedWorkspaceId) throw new Error('Missing workspace');const id=w.data.selectedWorkspaceId
      await api.requests.create(id,{name:'Old',method:'GET',urlTemplate:'http://127.0.0.1/old',collectionId:null});await api.requests.create(id,{name:'New',method:'GET',urlTemplate:'http://127.0.0.1/new',collectionId:null})
      const old=await api.requests.search(id,{query:'Old',offset:0,limit:100}),next=await api.requests.search(id,{query:'New',offset:0,limit:100})
      const second=await api.workspaces.create('Second');if(!second.ok||!second.data.selectedWorkspaceId) throw new Error('Missing second workspace');const other=second.data.selectedWorkspaceId
      await api.requests.create(other,{name:'Other',method:'GET',urlTemplate:'http://127.0.0.1/other',collectionId:null});const foreign=await api.requests.search(other,{query:'Other',offset:0,limit:100});await api.workspaces.select(id)
      return {id,other,old,next,foreign}
    })
    await page.reload();await expect(page.getByLabel('Search requests')).toBeEnabled()
    await app.evaluate(({ipcMain,app},data)=>{
      ipcMain.removeHandler('requests:search')
      const held:(()=>void)[]=[]
      Reflect.set(app,'releaseSyntheticSearch',()=>{held.splice(0).forEach(resolve=>resolve())})
      ipcMain.handle('requests:search',(_event,w:string,input:{query:string})=>{
        if(w===data.id && input.query==='Old') return new Promise(resolve=>held.push(()=>resolve(data.old)))
        return w===data.other ? data.foreign : data.next
      })
    },seed)
    await page.getByLabel('Search requests').fill('Old');await expect(page.getByRole('status').filter({hasText:'Searching…'})).toBeVisible()
    await page.getByLabel('Search requests').fill('New');await expect(page.locator('[data-search-ready]')).toHaveAttribute('data-search-ready','New')
    await app.evaluate(({app})=>Reflect.get(app,'releaseSyntheticSearch')())
    await page.evaluate(()=>window.offlineApi.app.getTheme());await expect(page.locator('[data-search-ready]')).toHaveAttribute('data-search-ready','New');await expect(page.locator('[data-search-id]')).toContainText('New')
    await page.getByLabel('Search requests').fill('Old');await expect(page.getByRole('status').filter({hasText:'Searching…'})).toBeVisible()
    await page.getByLabel('Workspace',{exact:true}).selectOption(seed.other);await expect(page.getByLabel('Search requests')).toHaveValue('')
    await page.getByLabel('Search requests').fill('Other');await expect(page.locator('[data-search-ready]')).toHaveAttribute('data-search-ready','Other')
    await app.evaluate(({app})=>Reflect.get(app,'releaseSyntheticSearch')());await page.evaluate(()=>window.offlineApi.app.getTheme())
    await expect(page.locator('[data-search-id]')).toContainText('Other');await expect(page.getByRole('button',{name:'Clear search',exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Clear search',exact:true}).click();await expect(page.getByRole('treeitem')).toContainText('Other')
  }finally{await shutdown(app);rmSync(directory,{recursive:true,force:true})}
})
test('search result selection respects active Stay/Cancel and dirty Save decisions without sending another request',async()=>{
  const received:string[]=[]
  const fixture=await startFixture(false,(req,res)=>{received.push(req.url??'');res.writeHead(200);res.write('holding')}),directory=mkdtempSync(join(tmpdir(),'api-client-search-guards-')),env={...Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined&&!['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(e[0]))),XDG_CONFIG_HOME:directory,APPDATA:directory},app=await launchDesktop({args:['.'],chromiumSandbox:true,env})
  try {
    const page=await app.firstWindow()
    const seed=await page.evaluate(async url=>{
      const api=window.offlineApi,w=await api.workspaces.create('Search guards');if(!w.ok||!w.data.selectedWorkspaceId) throw new Error('Missing workspace');const id=w.data.selectedWorkspaceId
      const first=await api.requests.create(id,{name:'API Hold',method:'GET',urlTemplate:url+'/hold',collectionId:null});if(!first.ok||!first.data.editor) throw new Error('Missing request')
      const second=await api.requests.create(id,{name:'API Other',method:'GET',urlTemplate:url+'/echo',collectionId:null});if(!second.ok||!second.data.editor) throw new Error('Missing other request')
      await api.requests.get(id,first.data.editor.id);return {w:id,first:first.data.editor.id,second:second.data.editor.id}
    },fixture.url)
    await page.reload();await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('API Hold')
    await page.getByLabel('Search requests').fill('API');await expect(page.locator('[data-search-id]')).toHaveCount(2)
    await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('status').filter({hasText:/^Sending request/})).toBeVisible()
    await page.locator(`[data-search-id="${seed.second}"]`).click()
    const active=page.getByRole('dialog',{name:'Request in progress',exact:true});await active.getByRole('button',{name:'Stay',exact:true}).click();await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('API Hold')
    await page.getByLabel('Request name',{exact:true}).fill('API Saved before selection')
    await page.locator(`[data-search-id="${seed.second}"]`).click();await active.getByRole('button',{name:'Cancel request',exact:true}).click()
    await page.getByRole('dialog',{name:'Unsaved request changes',exact:true}).getByRole('button',{name:'Save',exact:true}).click()
    await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('API Other');await expect(page.getByRole('status').filter({hasText:/^Request cancelled$/})).toBeVisible()
    expect(received).toEqual(['/hold'])
    expect(await page.evaluate(async data=>{const requests=await window.offlineApi.requests.list(data.w);return requests.ok && requests.data.requests.find(r=>r.id===data.first)?.name},seed)).toBe('API Saved before selection')
  }finally{await shutdown(app);await fixture.close();rmSync(directory,{recursive:true,force:true})}
})
