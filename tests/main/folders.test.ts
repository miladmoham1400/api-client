import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { FolderService } from '../../src/main/services/folders'
import { RequestService } from '../../src/main/services/requests'
import { createFolderHandlers } from '../../src/main/ipc/folders'
import { createCollectionHandlers } from '../../src/main/ipc/collections'
import { CollectionService } from '../../src/main/services/collections'
import { WorkspaceExportService } from '../../src/main/services/workspace-export'
import { createExportHandler } from '../../src/main/ipc/export'
import { createDefaultRequestConfig } from '../../src/shared/request-config'
import { folderSnapshotSchema } from '../../src/shared/folders'
import { requestCreateSchema } from '../../src/shared/requests'
import { collectionInputs } from '../../src/shared/collections'

const resources: { db: Database.Database; directory: string }[] = []
afterEach(() => { vi.restoreAllMocks(); for (const { db, directory } of resources.splice(0)) { if (db.open) db.close(); rmSync(directory,{recursive:true,force:true}) } })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(),'api-client-folder-')), path = join(directory,'synthetic.sqlite'), db = openDatabase(path)
  resources.push({ db,directory })
  const r = new Repositories(db), w = r.createWorkspace('Local').id, foreign = r.createWorkspace('Other').id
  const c = r.createCollection(w,'Users').id, d = r.createCollection(w,'Other').id, fc = r.createCollection(foreign,'Foreign').id
  r.selectWorkspace(w)
  const service = new FolderService(db), frame = { url:'file:///app/index.html' }, contents = { mainFrame:frame }, window = { isDestroyed:() => false, webContents:contents }
  const handlers = createFolderHandlers(() => window,frame.url,() => service), event = {sender:contents,senderFrame:frame}
  return {db,path,directory,r,w,foreign,c,d,fc,service,handlers,event,frame,contents,window}
}
const config = () => ({ ...createDefaultRequestConfig(), auth: { mode: 'none' as const } })
function before(db: Database.Database) { return db.serialize() }
it('creates, lists, renames and reopens nested duplicate-name folders through depth 16; rejects depth 17 atomically', () => {
  const f=fixture(); let parent:string|null=null
  for (let depth=1;depth<=16;depth++) parent=f.r.createFolder(f.w,f.c,parent,'  پوشه  ').id
  const bytes=before(f.db)
  expect(() => f.r.createFolder(f.w,f.c,parent,'Too deep')).toThrow('Invalid input')
  expect(before(f.db)).toEqual(bytes)
  expect(f.r.listFolders(f.w)).toHaveLength(16)
  expect(f.r.renameFolder(f.w,parent!,' Auth ').name).toBe('Auth')
  const request=f.r.createRequest(f.w,'API',f.c,config(),parent)
  const snapshot=f.service.list(f.w)
  expect(snapshot.folders.some(row => row.name==='پوشه')).toBe(true)
  f.db.close(); const reopened=openDatabase(f.path)
  try { expect(new FolderService(reopened).list(f.w)).toEqual(snapshot); expect(new Repositories(reopened).getRequest(f.w,request.id).folderId).toBe(parent); expect(reopened.pragma('foreign_key_check')).toEqual([]) } finally { reopened.close() }
})
it('moves an entire subtree across collections atomically without changing IDs, config, credentials or selection', () => {
  const f=fixture(), root=f.r.createFolder(f.w,f.c,null,'Users'), child=f.r.createFolder(f.w,f.c,root.id,'Admin'), leaf=f.r.createFolder(f.w,f.c,child.id,'Auth')
  const secret=f.r.createSecret(f.w,'session',null), stored={...config(),method:'POST' as const,body:{kind:'json' as const,text:'{"example":true}'},auth:{mode:'bearer' as const,token:{kind:'secret' as const,secretId:secret.id}}}
  const q=f.r.createRequest(f.w,'Login',f.c,stored,leaf.id), direct=f.r.createRequest(f.w,'Users',f.c,config(),root.id), unaffected=f.r.createRequest(f.w,'Root',f.c,config())
  f.r.setState(f.w,null,q.id)
  const dest=f.r.createFolder(f.w,f.d,null,'Destination')
  f.r.moveFolder(f.w,root.id,f.d,dest.id)
  for (const folder of [root,child,leaf]) expect(f.r.getFolder(f.w,folder.id).collectionId).toBe(f.d)
  expect(f.r.getFolder(f.w,root.id).parentFolderId).toBe(dest.id)
  expect(f.r.getRequest(f.w,q.id)).toMatchObject({id:q.id,collectionId:f.d,folderId:leaf.id,config:stored})
  expect(f.r.getRequest(f.w,direct.id).collectionId).toBe(f.d)
  expect(f.r.getRequest(f.w,unaffected.id)).toEqual(unaffected)
  expect(f.r.getSecret(f.w,secret.id)).toEqual(secret)
  expect(f.r.getState(f.w).selectedRequestId).toBe(q.id)
  expect(f.db.pragma('foreign_key_check')).toEqual([])
})
it('rejects cycles, descendant depth overflow and all foreign/inconsistent destinations without changing any data', () => {
  const f=fixture(), root=f.r.createFolder(f.w,f.c,null,'Root'), child=f.r.createFolder(f.w,f.c,root.id,'Child'), foreignFolder=f.r.createFolder(f.foreign,f.fc,null,'Foreign'), q=f.r.createRequest(f.w,'API',f.c,config(),child.id)
  let deep=f.r.createFolder(f.w,f.d,null,'Deep').id
  for(let depth=2;depth<=15;depth++) deep=f.r.createFolder(f.w,f.d,deep,'Deep').id
  const bytes=before(f.db)
  for (const operation of [
    () => f.r.moveFolder(f.w,root.id,f.c,root.id), () => f.r.moveFolder(f.w,root.id,f.c,child.id),
    () => f.r.moveFolder(f.w,root.id,f.d,deep), () => f.r.moveFolder(f.w,root.id,f.fc,null),
    () => f.r.moveFolder(f.w,foreignFolder.id,f.c,null), () => f.r.moveFolder(f.w,root.id,f.c,foreignFolder.id),
    () => f.r.createFolder(f.w,f.d,child.id,'Wrong collection'), () => f.r.renameFolder(f.w,foreignFolder.id,'Wrong'),
    () => f.r.deleteFolder(f.w,foreignFolder.id), () => f.r.getFolder(f.w,foreignFolder.id),
    () => f.r.moveRequest(f.w,q.id,f.d,child.id), () => f.r.moveRequest(f.w,q.id,null,child.id),
    () => f.r.createRequest(f.w,'Wrong',f.fc,config(),foreignFolder.id), () => f.r.moveFolder(f.w,randomUUID(),f.c,null)
  ]) { expect(operation).toThrow(); expect(before(f.db)).toEqual(bytes) }
}, 15_000)
it('promotes direct children/requests on folder deletion and all nested requests on collection deletion, retaining config and selection', () => {
  const f=fixture(), parent=f.r.createFolder(f.w,f.c,null,'Parent'), target=f.r.createFolder(f.w,f.c,parent.id,'Target'), child=f.r.createFolder(f.w,f.c,target.id,'Child'), leaf=f.r.createFolder(f.w,f.c,child.id,'Leaf')
  const direct=f.r.createRequest(f.w,'Direct',f.c,config(),target.id), nested=f.r.createRequest(f.w,'Nested',f.c,config(),leaf.id)
  f.r.setState(f.w,null,nested.id); f.r.deleteFolder(f.w,target.id)
  expect(f.r.getFolder(f.w,child.id).parentFolderId).toBe(parent.id)
  expect(f.r.getFolder(f.w,leaf.id).parentFolderId).toBe(child.id)
  expect(f.r.getRequest(f.w,direct.id).folderId).toBe(parent.id)
  expect(f.r.getRequest(f.w,nested.id).folderId).toBe(leaf.id)
  f.r.deleteFolder(f.w,parent.id)
  expect(f.r.getFolder(f.w,child.id).parentFolderId).toBeNull()
  expect(f.r.getRequest(f.w,direct.id)).toMatchObject({collectionId:f.c,folderId:null})
  f.r.deleteCollection(f.w,f.c)
  for(const request of [direct,nested]) expect(f.r.getRequest(f.w,request.id)).toMatchObject({collectionId:null,folderId:null,config:request.config})
  expect(f.r.getState(f.w).selectedRequestId).toBe(nested.id)
  expect(f.r.listFolders(f.w)).toEqual([]); expect(f.db.pragma('foreign_key_check')).toEqual([])
})
it('rolls back descendant move, promotion and collection removal if any write fails; sanitizes trigger errors', () => {
  const f=fixture(), root=f.r.createFolder(f.w,f.c,null,'Root'), child=f.r.createFolder(f.w,f.c,root.id,'Child')
  f.r.createRequest(f.w,'API',f.c,config(),child.id)
  for (const [sql,operation] of [
    ["CREATE TRIGGER failure BEFORE UPDATE ON requests BEGIN SELECT RAISE(ABORT,'synthetic private failure'); END;",() => f.handlers.move(f.event,f.w,root.id,f.d,null)],
    ["CREATE TRIGGER failure BEFORE DELETE ON folders BEGIN SELECT RAISE(ABORT,'synthetic private failure'); END;",() => f.handlers.delete(f.event,f.w,root.id)],
    ["CREATE TRIGGER failure BEFORE DELETE ON collections BEGIN SELECT RAISE(ABORT,'synthetic private failure'); END;",() => createCollectionHandlers(() => f.window,f.frame.url,() => new CollectionService(f.db)).delete(f.event,f.w,f.c)]
  ] as const) {
    f.db.exec(sql); const bytes=before(f.db), result=operation()
    expect(result).toMatchObject({ok:false,error:{code:'DATABASE_WRITE_FAILED'}})
    expect(JSON.stringify(result)).not.toContain('private'); expect(before(f.db)).toEqual(bytes)
    f.db.exec('DROP TRIGGER failure')
  }
})
it('caps creation at 1000 folders without truncating existing larger libraries; rename/move/delete remain available', () => {
  const f=fixture(), now=new Date().toISOString(), insert=f.db.prepare('INSERT INTO folders VALUES (?,?,?,?,?,?,?,?)')
  f.db.transaction(() => { for(let n=0;n<1000;n++) insert.run(randomUUID(),f.w,f.c,null,'Folder',n,now,now) })()
  const bytes=before(f.db)
  expect(() => f.r.createFolder(f.w,f.c,null,'Overflow')).toThrow('Invalid input'); expect(before(f.db)).toEqual(bytes)
  const extra=randomUUID(); insert.run(extra,f.w,f.c,null,'Legacy',1000,now,now)
  expect(f.service.list(f.w).folders).toHaveLength(1001)
  f.r.renameFolder(f.w,extra,'Renamed'); f.r.moveFolder(f.w,extra,f.d,null); f.r.deleteFolder(f.w,extra)
  expect(f.r.listFolders(f.w)).toHaveLength(1000)
})
it('partial saves and duplicates retain placement and independent secret copies; old create/move normalize only omitted folder IDs', () => {
  const f=fixture(), folder=f.r.createFolder(f.w,f.c,null,'Auth'), secret=f.r.createSecret(f.w,'secure',Buffer.from('synthetic encrypted fixture'))
  const q=f.r.createRequest(f.w,'API',f.c,{...config(),auth:{mode:'bearer',token:{kind:'secret',secretId:secret.id}}},folder.id), service=new RequestService(f.db)
  const saved=service.save(f.w,q.id,{name:'Renamed',method:'GET',urlTemplate:'http://example.invalid/'})
  expect(saved.editor?.folderId).toBe(folder.id)
  const copy=service.duplicate(f.w,q.id).editor!
  expect(copy.folderId).toBe(folder.id)
  const auth=f.r.getRequest(f.w,copy.id).config.auth
  if(auth.mode!=='bearer'||auth.token.kind!=='secret') throw new Error('Missing independent secret')
  expect(auth.token.secretId).not.toBe(secret.id)
  expect(f.r.getSecret(f.w,auth.token.secretId).encryptedValue).toEqual(secret.encryptedValue)
  f.r.deleteRequest(f.w,q.id); expect(f.r.getSecret(f.w,auth.token.secretId).id).toBe(auth.token.secretId)
  const legacy={name:'Legacy',method:'GET',urlTemplate:'',collectionId:f.c}
  expect(requestCreateSchema.parse(legacy).folderId).toBeNull()
  expect(requestCreateSchema.parse({...legacy,folderId:folder.id}).folderId).toBe(folder.id)
  expect(requestCreateSchema.safeParse({...legacy,collectionId:null,folderId:folder.id}).success).toBe(false)
  expect(collectionInputs.move.parse([f.w,copy.id,f.c])).toEqual([f.w,copy.id,f.c,null])
  new CollectionService(f.db).move(f.w,copy.id,f.c)
  expect(f.r.getRequest(f.w,copy.id).folderId).toBeNull()
  expect(new CollectionService(f.db).move(f.w,copy.id,f.c,folder.id).requests.find(r => r.id === copy.id)?.folderId).toBe(folder.id)
  f.r.moveRequest(f.w,copy.id,null)
  expect(f.r.getRequest(f.w,copy.id)).toMatchObject({collectionId:null,folderId:null,config:expect.objectContaining({auth})})
  expect(service.create(f.w,{...legacy,folderId:folder.id}).editor?.folderId).toBe(folder.id)
})
it('validates owned sender, active workspace, exact inputs, outgoing metadata and unavailable database', () => {
  const f=fixture(), foreignFolder=f.r.createFolder(f.foreign,f.fc,null,'Foreign'), bytes=before(f.db)
  for(const event of [{sender:{},senderFrame:f.frame},{sender:f.contents,senderFrame:null},{sender:f.contents,senderFrame:{url:f.frame.url}}]) {
    expect(f.handlers.list(event,f.w)).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
    expect(f.handlers.create(event,f.w,f.c,null,'Denied')).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
  }
  for(const args of [[f.w,f.c,null,' '],[f.w,f.c,null,'x'.repeat(101)],[f.w,f.c,null,'Name','extra'],['bad',f.c,null,'Name']]) expect(f.handlers.create(f.event,...args)).toMatchObject({ok:false,error:{code:'VALIDATION'}})
  expect(f.handlers.list(f.event,f.foreign)).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
  expect(f.handlers.rename(f.event,f.w,foreignFolder.id,'Denied')).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
  expect(before(f.db)).toEqual(bytes)
  const folder=f.r.createFolder(f.w,f.c,null,'Folder'), snapshot=f.service.list(f.w)
  for(const folders of [[folder,folder],[{...folder,workspaceId:f.foreign}],[{...folder,collectionId:f.fc}],[{...folder,parentFolderId:randomUUID()}],[{...folder,config:{}}]]) expect(folderSnapshotSchema.safeParse({...snapshot,folders}).success).toBe(false)
  const original=Repositories.prototype.listCollections
  vi.spyOn(Repositories.prototype,'listCollections').mockImplementation(function(this:Repositories,w) { return original.call(this,w).map(c => ({...c,workspaceId:f.foreign})) })
  expect(f.handlers.create(f.event,f.w,f.c,null,'Must roll back')).toMatchObject({ok:false})
  vi.restoreAllMocks(); expect(f.r.listFolders(f.w)).toEqual([folder])
  f.db.close(); expect(f.handlers.list(f.event,f.w)).toMatchObject({ok:false,error:{code:'DATABASE_UNAVAILABLE'}})
})
it('exports empty folders as v2, keeping one snapshot when folders change during the native chooser', async () => {
  const f=fixture(), exportService=new WorkspaceExportService(f.db,[]), target=join(f.directory,'export.json'), choose=vi.fn(async () => target)
  const handler=createExportHandler(() => f.window,f.frame.url,() => exportService,choose)
  const folder=f.r.createFolder(f.w,f.c,null,'Empty'), bytes=before(f.db)
  expect(await handler(f.event,f.w)).toEqual({ok:true,data:{status:'saved'}})
  expect(choose).toHaveBeenCalledOnce(); expect(before(f.db)).toEqual(bytes)
  expect(JSON.parse(readFileSync(target,'utf8'))).toMatchObject({version:2,workspace:{folders:[{id:folder.id,name:'Empty'}]}})
  expect(await exportService.export(f.w,async () => { f.r.createFolder(f.w,f.c,null,'During dialog'); return target },() => true)).toEqual({status:'saved'})
  expect(JSON.parse(readFileSync(target,'utf8')).workspace.folders).toHaveLength(1)
  expect(exportService.snapshot(f.w).workspace.folders).toHaveLength(2)
  expect(readdirSync(f.directory).filter(n => n.endsWith('.tmp'))).toEqual([])
})
