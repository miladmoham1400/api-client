import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'

test('registered folder bridge preserves nested requests through move, duplicate, deletion and restart without sending', async () => {
  const directory = mkdtempSync(join(tmpdir(),'api-client-folder-desktop-'))
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string,string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(entry[0])))
  env.XDG_CONFIG_HOME=directory; env.APPDATA=directory
  let hits=0
  const server=createServer((_request,response) => { hits++; response.end('{"fixture":true}') })
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve))
  const endpoint=`http://127.0.0.1:${(server.address() as AddressInfo).port}/never-send`
  let app=await launchDesktop({args:['.'],chromiumSandbox:true,env})
  try {
    const page=await app.firstWindow()
    await expect(page.getByRole('heading',{name:'No request selected'})).toBeVisible()
    const saved=await page.evaluate(async endpoint => {
      const api=window.offlineApi
      const ws=await api.workspaces.create('Nested synthetic library')
      if(!ws.ok) throw new Error('Workspace create failed')
      const w=ws.data.workspaces[0]!.id
      await api.workspaces.select(w)
      const collection=await api.collections.create(w,'Users')
      if(!collection.ok) throw new Error('Collection create failed')
      const c=collection.data.collections[0]!.id
      const root=await api.folders.create(w,c,null,'Users')
      if(!root.ok) throw new Error('Folder create failed')
      const parent=root.data.folders[0]!.id
      const nested=await api.folders.create(w,c,parent,'Auth')
      if(!nested.ok) throw new Error('Nested folder create failed')
      const folder=nested.data.folders.find(f => f.parentFolderId===parent)!.id
      const request=await api.requests.create(w,{name:'Login',method:'POST',urlTemplate:endpoint,collectionId:c,folderId:folder,body:{kind:'json',text:'{"fixture":true}'}})
      if(!request.ok||!request.data.editor) throw new Error('Request create failed')
      const q=request.data.editor.id
      const copy=await api.requests.duplicate(w,q)
      if(!copy.ok||!copy.data.editor) throw new Error('Duplicate failed')
      const copyId=copy.data.editor.id
      const renamed=await api.folders.rename(w,folder,'Authentication')
      const promoted=await api.folders.delete(w,parent)
      const other=await api.collections.create(w,'Other')
      if(!other.ok) throw new Error('Other collection failed')
      const d=other.data.collections.find(item => item.id!==c)!.id
      const moved=await api.folders.move(w,folder,d,null)
      const editor=await api.requests.get(w,q)
      return {w,q,copyId,folder,d,renamed,promoted,moved,editor}
    },endpoint)
    expect(saved.renamed.ok).toBe(true); expect(saved.promoted.ok).toBe(true); expect(saved.moved.ok).toBe(true)
    expect(saved.editor).toMatchObject({ok:true,data:{editor:{id:saved.q,folderId:saved.folder,collectionId:saved.d},requests:expect.arrayContaining([expect.objectContaining({id:saved.copyId,folderId:saved.folder,collectionId:saved.d})])}})
    await app.close()
    app=await launchDesktop({args:['.'],chromiumSandbox:true,env})
    const reopened=await app.firstWindow()
    await expect(reopened.getByRole('textbox',{name:'Request name'})).toHaveValue('Login')
    expect(await reopened.evaluate(w => window.offlineApi.folders.list(w),saved.w)).toMatchObject({ok:true,data:{folders:[expect.objectContaining({id:saved.folder,parentFolderId:null,collectionId:saved.d,name:'Authentication'})]}})
    expect(await reopened.evaluate(w => window.offlineApi.requests.list(w),saved.w)).toMatchObject({ok:true,data:{editor:{id:saved.q,folderId:saved.folder,body:{kind:'json',text:'{"fixture":true}'}}}})
    await expect(reopened.getByText('Request completed',{exact:true})).toHaveCount(0)
    const removed=await reopened.evaluate(async ({w,d,q}) => { const result=await window.offlineApi.collections.delete(w,d); const editor=await window.offlineApi.requests.get(w,q); return {result,editor} },saved)
    expect(removed.result).toMatchObject({ok:true,data:{requests:expect.arrayContaining([expect.objectContaining({id:saved.q,collectionId:null,folderId:null}),expect.objectContaining({id:saved.copyId,collectionId:null,folderId:null})])}})
    expect(removed.editor).toMatchObject({ok:true,data:{editor:{id:saved.q,folderId:null}}})
    expect(hits).toBe(0)
  } finally { await shutdown(app); await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve())); rmSync(directory,{recursive:true,force:true}) }
})
