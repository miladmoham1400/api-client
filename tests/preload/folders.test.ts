import { afterEach, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { DesktopApi } from '../../src/shared/desktop-api'
const mock = vi.hoisted(() => ({ invoke: vi.fn(), expose: vi.fn() }))
vi.mock('electron', () => ({ contextBridge: { exposeInMainWorld: mock.expose }, ipcRenderer: { invoke: mock.invoke } }))
afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); mock.invoke.mockReset(); mock.expose.mockReset() })
it('exposes immutable fixed folder methods, validates both directions and keeps explicit request destinations', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(process,'isMainFrame')
  Object.defineProperty(process,'isMainFrame',{value:true,configurable:true})
  try { await import('../../src/preload/index') }
  finally { if(descriptor) Object.defineProperty(process,'isMainFrame',descriptor); else Reflect.deleteProperty(process,'isMainFrame') }
  const api: DesktopApi = mock.expose.mock.calls[0]![1]
  const w=randomUUID(), c=randomUUID(), id=randomUUID(), q=randomUUID(), stamp=new Date().toISOString()
  const folder={id,workspaceId:w,collectionId:c,parentFolderId:null,name:'Auth',sortOrder:0,createdAt:stamp,updatedAt:stamp}
  const snapshot={workspaceId:w,collections:[{id:c,workspaceId:w,name:'Users',sortOrder:0,createdAt:stamp,updatedAt:stamp}],folders:[folder]}
  expect(Object.isFrozen(api.library)).toBe(true)
  expect(await api.library.setExpansion(w,{expandedCollectionIds:[c,c],expandedFolderIds:[]})).toMatchObject({ok:false,error:{code:'VALIDATION'}})
  expect(mock.invoke).not.toHaveBeenCalled()
  mock.invoke.mockResolvedValue({ok:true,data:{workspaceId:w,version:1,expandedCollectionIds:[c],expandedFolderIds:[id]}})
  expect((await api.library.setExpansion(w,{expandedCollectionIds:[c],expandedFolderIds:[id]})).ok).toBe(true)
  expect(mock.invoke).toHaveBeenLastCalledWith('library:set-expansion',w,{expandedCollectionIds:[c],expandedFolderIds:[id]})
  mock.invoke.mockClear()
  expect(Object.isFrozen(api.folders)).toBe(true)
  expect(Object.keys(api.folders)).toEqual(['list','create','rename','move','delete'])
  expect(await api.folders.create(w,c,null,' ')).toMatchObject({ok:false,error:{code:'VALIDATION'}})
  expect(await api.folders.move(w,id,c,'/arbitrary/path')).toMatchObject({ok:false,error:{code:'VALIDATION'}})
  expect(mock.invoke).not.toHaveBeenCalled()
  mock.invoke.mockResolvedValue({ok:true,data:snapshot})
  for(const [operation,channel,args] of [
    [() => api.folders.list(w),'folders:list',[w]], [() => api.folders.create(w,c,null,' Auth '),'folders:create',[w,c,null,'Auth']],
    [() => api.folders.rename(w,id,'New'),'folders:rename',[w,id,'New']], [() => api.folders.move(w,id,c,null),'folders:move',[w,id,c,null]],
    [() => api.folders.delete(w,id),'folders:delete',[w,id]]
  ] as const) { expect(await operation()).toEqual({ok:true,data:snapshot}); expect(mock.invoke).toHaveBeenLastCalledWith(channel,...args) }
  for(const invalid of [{...snapshot,folders:[{...folder,path:'/private'}]},{...snapshot,folders:[{...folder,workspaceId:randomUUID()}]},{...snapshot,folders:[{...folder,parentFolderId:randomUUID()}]}]) {
    mock.invoke.mockResolvedValue({ok:true,data:invalid})
    const result=await api.folders.list(w)
    expect(result).toMatchObject({ok:false,error:{code:'VALIDATION'}}); expect(JSON.stringify(result)).not.toContain('/private')
  }
  mock.invoke.mockResolvedValue({ok:true,data:{workspaceId:w,collections:snapshot.collections,requests:[]}})
  await api.requests.move(w,q,c,id); expect(mock.invoke).toHaveBeenLastCalledWith('requests:move',w,q,c,id)
  await api.requests.move(w,q,c); expect(mock.invoke).toHaveBeenLastCalledWith('requests:move',w,q,c,null)
  mock.invoke.mockResolvedValue({ok:true,data:{workspaceId:w,requests:[],editor:null}})
  const draft={name:'Login',method:'GET' as const,urlTemplate:'',collectionId:c}
  await api.requests.create(w,{...draft,folderId:id}); expect(mock.invoke).toHaveBeenLastCalledWith('requests:create',w,{...draft,folderId:id})
  await api.requests.create(w,draft); expect(mock.invoke).toHaveBeenLastCalledWith('requests:create',w,{...draft,folderId:null})
})
