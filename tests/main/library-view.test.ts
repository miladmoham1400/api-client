import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { LibraryService } from '../../src/main/services/library-view'
import { createLibraryHandlers } from '../../src/main/ipc/library-view'
import { createDefaultRequestConfig } from '../../src/shared/request-config'
const cleanup:(() => void)[]=[]
afterEach(() => {vi.restoreAllMocks();cleanup.splice(0).forEach(f => f())})
function fixture() {
  const directory=mkdtempSync(join(tmpdir(),'library-view-')),path=join(directory,'synthetic.sqlite'),db=openDatabase(path)
  cleanup.push(() => {if(db.open) db.close();rmSync(directory,{recursive:true,force:true})})
  const r=new Repositories(db),w=r.createWorkspace('A').id,foreign=r.createWorkspace('B').id,c=r.createCollection(w,'Users').id,fc=r.createCollection(foreign,'Foreign').id
  const f=r.createFolder(w,c,null,'Auth').id,ff=r.createFolder(foreign,fc,null,'Other').id
  r.selectWorkspace(w)
  const frame={url:'file:///app/index.html'},contents={mainFrame:frame},window={isDestroyed:() => false,webContents:contents},service=new LibraryService(db)
  return {directory,path,db,r,w,foreign,c,fc,f,ff,service,frame,contents,event:{sender:contents,senderFrame:frame},handlers:createLibraryHandlers(() => window,frame.url,() => service)}
}
it('persists versioned owned expansion, reopens it, prunes deleted nodes and never loads full request configs to browse', () => {
  const f=fixture();f.r.createRequest(f.w,'API',f.c,{...createDefaultRequestConfig(),auth:{mode:'none'}},f.f)
  const get=vi.spyOn(Repositories.prototype,'getRequest').mockImplementation(() => {throw new Error('Config must not be read')})
  const state={expandedCollectionIds:[f.c],expandedFolderIds:[f.f]}
  expect(f.service.setExpansion(f.w,state)).toMatchObject({...state,version:1,workspaceId:f.w})
  const snapshot=f.service.list(f.w)
  expect(snapshot.requests[0]).toMatchObject({method:'GET',destination:{folderId:f.f}})
  expect(Object.keys(snapshot.requests[0]!)).not.toContain('config');expect(get).not.toHaveBeenCalled()
  f.db.close();const reopened=openDatabase(f.path)
  try {
    const r=new Repositories(reopened)
    expect(new LibraryService(reopened).list(f.w).treeState).toMatchObject(state)
    r.deleteFolder(f.w,f.f)
    expect(r.getTreeState(f.w).expandedFolderIds).toEqual([])
  } finally {reopened.close()}
})
it('rejects foreign sender/workspace/expansion IDs, duplicates and unbounded input without writing; rolls back failed persistence', () => {
  const f=fixture(),state={expandedCollectionIds:[f.c],expandedFolderIds:[f.f]},before=f.db.serialize()
  for(const event of [{sender:{},senderFrame:f.frame},{sender:f.contents,senderFrame:null},{sender:f.contents,senderFrame:{url:f.frame.url}}]) expect(f.handlers.setExpansion(event,f.w,state)).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
  for(const input of [{...state,expandedFolderIds:[f.ff]},{...state,expandedCollectionIds:[f.fc]}]) expect(f.handlers.setExpansion(f.event,f.w,input)).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
  for(const input of [{...state,expandedFolderIds:[f.f,f.f]},{...state,expandedFolderIds:Array.from({length:1001},() => randomUUID())},{...state,draft:'forbidden'}]) expect(f.handlers.setExpansion(f.event,f.w,input)).toMatchObject({ok:false,error:{code:'VALIDATION'}})
  expect(f.handlers.list(f.event,f.foreign)).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});expect(f.db.serialize()).toEqual(before)
  f.db.exec("CREATE TRIGGER fail_expansion BEFORE INSERT ON workspace_tree_state BEGIN SELECT RAISE(ABORT,'synthetic'); END;")
  expect(f.handlers.setExpansion(f.event,f.w,state)).toMatchObject({ok:false,error:{code:'DATABASE_WRITE_FAILED'}})
  expect(f.r.getTreeState(f.w)).toMatchObject({expandedCollectionIds:[],expandedFolderIds:[]})
})
