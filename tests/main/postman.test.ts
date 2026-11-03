import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { importPostman, exportPostman, POSTMAN_SCHEMA } from '../../src/main/services/postman'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { WorkspaceImportService } from '../../src/main/services/workspace-import'
import { WorkspaceExportService } from '../../src/main/services/workspace-export'
import { createPostmanExportHandler } from '../../src/main/ipc/export'
import { createDefaultRequestConfig } from '../../src/shared/request-config'
const cleanups:(()=>void)[]=[]
afterEach(()=>cleanups.splice(0).forEach(f=>f()))
function fixture() {
 const dir=mkdtempSync(join(tmpdir(),'postman-')),db=openDatabase(join(dir,'db.sqlite')),r=new Repositories(db),w=r.createWorkspace('Kept')
 r.selectWorkspace(w.id);cleanups.push(()=>{db.close();rmSync(dir,{recursive:true,force:true})})
 return {dir,db,r,w}
}
function collection() { return { info:{name:'Imported API',schema:POSTMAN_SCHEMA}, variable:[{key:'base_url',value:'http://127.0.0.1:1234'},{key:'token',value:'synthetic-hidden-secret',type:'secret'}], auth:{type:'bearer',bearer:[{key:'token',value:'{{token}}'}]}, event:[{listen:'prerequest',script:{exec:['window.syntheticNeverExecute=true']}}], item:[
 {name:'Users',item:[{name:'Create user',request:{method:'POST',url:{raw:'{{base_url}}/users?tag=one',query:[{key:'tag',value:'one'},{key:'tag',value:'two',disabled:true}]},header:[{key:'Cookie',value:'synthetic-cookie'},{key:'X-Request',value:'{{base_url}}'}],body:{mode:'raw',raw:'{"name":"one"}',options:{raw:{language:'json'}}}},response:[{name:'Alternate',originalRequest:{body:{mode:'raw',raw:'{"name":"two"}',options:{raw:{language:'json'}}}},body:'synthetic-response-not-persisted'}]}]},
 {name:'Upload',request:{method:'POST',url:'{{base_url}}/upload',body:{mode:'formdata',formdata:[{key:'same',value:'one',type:'text'},{key:'same',src:'/synthetic/private/path.bin',type:'file'}]}}}
 ]} }
it('preserves nested request config and Body examples while omitting scripts, response payloads, credentials and paths',()=>{
 const dto=importPostman(collection()),w=dto.workspace,config=w.requests[0]!.config,serialized=JSON.stringify(dto)
 expect(w.folders.map(f=>f.name)).toEqual(['Users'])
 expect(config.auth).toMatchObject({mode:'bearer',tokenTemplate:'{{token}}'})
 expect(config.queryRows.map(r=>({key:r.key,value:r.value,enabled:r.enabled}))).toEqual([{key:'tag',value:'one',enabled:true},{key:'tag',value:'two',enabled:false}])
 expect(config.headerRows[0]).toMatchObject({key:'Cookie',value:'',enabled:false})
 expect(config.bodyVariants).toHaveLength(2)
 for(const forbidden of ['synthetic-hidden-secret','synthetic-cookie','/synthetic/private','syntheticNeverExecute','synthetic-response-not-persisted'])expect(serialized).not.toContain(forbidden)
 expect(w.variables.find(v=>v.key==='token')).toMatchObject({isSensitive:true,requiresValue:true})
})
it('previews before transactional new-workspace import, keeps selection, and exports only the owned chosen collection',async()=>{
 const f=fixture(),path=join(f.dir,'postman.json');writeFileSync(path,JSON.stringify(collection()))
 const service=new WorkspaceImportService(f.r),preview=await service.choose(async()=>path,()=>true)
 expect(preview.status).toBe('preview');if(preview.status!=='preview')return
 expect(preview.preview.source).toBe('postman');expect(preview.preview.warnings?.join('')).toContain('Scripts')
 expect(f.r.listWorkspaces()).toHaveLength(1)
 const created=service.confirm(preview.preview.token);expect(f.r.getSelectedWorkspace()).toBe(f.w.id)
 const c=f.r.listCollections(created.workspaceId)[0]!,extra=f.r.createCollection(created.workspaceId,'Do not export')
 f.r.createRequest(created.workspaceId,'Foreign collection request',extra.id,{...createDefaultRequestConfig(),auth:{mode:'none'}})
 const exporter=new WorkspaceExportService(f.db,[]),out=join(f.dir,'export.postman_collection.json')
 expect(await exporter.export(created.workspaceId,async()=>out,()=>true,c.id)).toEqual({status:'saved'})
 const content=readFileSync(out,'utf8'),output:unknown=JSON.parse(content),roundtrip=importPostman(output)
 expect(content).not.toContain('Do not export');expect(content).not.toContain('Foreign collection request')
 expect(roundtrip.workspace.requests).toHaveLength(2);expect(roundtrip.workspace.folders).toHaveLength(1)
 expect(roundtrip.workspace.requests[0]!.config.bodyVariants).toHaveLength(2)
 writeFileSync(join(tmpdir(),'api-client-postman-export.json'),content)
 expect(await exporter.export(created.workspaceId,async()=>null,()=>true,c.id)).toEqual({status:'cancelled'})
 await expect(exporter.export(f.w.id,async()=>out,()=>true,c.id)).rejects.toThrow()
})
it('keeps embedded query and appended duplicate/disabled rows through a Postman round trip',()=>{
 const dto=importPostman(collection()),config=dto.workspace.requests[0]!.config
 config.urlTemplate='{{base_url}}/users?existing=a%26b'
 config.queryRows=[{id:crypto.randomUUID(),key:'tag',value:'{{token}}',enabled:true},{id:crypto.randomUUID(),key:'tag',value:'off',enabled:false}]
 const output=exportPostman(dto,dto.workspace.collections[0]!.id),again=importPostman(output).workspace.requests[0]!.config
 expect(again.urlTemplate).toBe('{{base_url}}/users')
 expect(again.queryRows.map(r=>[r.key,r.value,r.enabled])).toEqual([['existing','a&b',true],['tag','{{token}}',true],['tag','off',false]])
})
it.each(['oauth2','digest'])('rejects unsupported auth %s before any writes',type=>{
 const f=fixture(),input=collection();input.auth.type=type
 const before=f.db.serialize();expect(()=>importPostman(input)).toThrow('Unsupported Postman authentication');expect(f.db.serialize()).toEqual(before)
})
it('rolls back the entire import and keeps the preview retryable when insertion fails',async()=>{
 const f=fixture(),path=join(f.dir,'collection.json');writeFileSync(path,JSON.stringify(collection()))
 const service=new WorkspaceImportService(f.r),choice=await service.choose(async()=>path,()=>true);if(choice.status!=='preview')throw new Error('Missing preview')
 f.db.exec("CREATE TRIGGER fail_postman BEFORE INSERT ON requests BEGIN SELECT RAISE(ABORT,'fixture failure'); END")
 const before=f.db.serialize();expect(()=>service.confirm(choice.preview.token)).toThrow();expect(f.db.serialize()).toEqual(before)
 f.db.exec('DROP TRIGGER fail_postman');expect(service.confirm(choice.preview.token).name).toContain('(imported)')
})
it('does not open a save dialog for a foreign sender or foreign workspace collection',async()=>{
 const f=fixture(),c=f.r.createCollection(f.w.id,'Owned'),other=f.r.createWorkspace('Other'),frame={url:'file:///app'},contents={mainFrame:frame},window={isDestroyed:()=>false,webContents:contents}
 const service=new WorkspaceExportService(f.db,[]);let dialogs=0
 const handler=createPostmanExportHandler(()=>window,frame.url,()=>service,async()=>{dialogs++;return null})
 expect(await handler({sender:{},senderFrame:frame},f.w.id,c.id)).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
 expect(await handler({sender:contents,senderFrame:frame},other.id,c.id)).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
 expect(dialogs).toBe(0)
})
