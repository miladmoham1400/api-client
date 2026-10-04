import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../src/main/db/database'
import { Repositories, RepositoryError } from '../../src/main/db/repositories'
import { createDefaultRequestConfig, type StoredRequestConfig } from '../../src/shared/request-config'

const resources: {db:Database.Database;path:string}[]=[]
afterEach(()=>{const list=resources.splice(0);for(const resource of list)if(resource.db.open)resource.db.close();for(const path of new Set(list.map(resource=>resource.path)))rmSync(path,{recursive:true,force:true})})
function setup(){const path=mkdtempSync(join(tmpdir(),'api-client-repositories-')),db=openDatabase(join(path,'test.sqlite'));resources.push({db,path});const r=new Repositories(db),a=r.createWorkspace('A'),b=r.createWorkspace('B');return {db,path,r,a:a.id,b:b.id}}
const config=():StoredRequestConfig=>({...createDefaultRequestConfig(),auth:{mode:'none'}})
const plain=(value='')=>({isSensitive:false as const,plainValue:value,secretId:null})
function rejected(operation:()=>unknown,code='NOT_FOUND'){try{operation();throw new Error('Expected failure')}catch(error){expect(error).toBeInstanceOf(RepositoryError);expect(error instanceof RepositoryError&&error.code).toBe(code)}}
it('creates validated entities, preserves ordinary configuration and parameterizes names',()=>{
 const {r,a}=setup(),name="Workspace'; DROP TABLE requests; --"
 expect(r.renameWorkspace(a,` ${name} `).name).toBe(name)
 const c=r.createCollection(a,'Group'),e=r.createEnvironment(a,'Env'),req=r.createRequest(a,'Request',c.id,config())
 expect(r.listWorkspaces()).toHaveLength(2);expect(r.getCollection(a,c.id).sortOrder).toBe(0);expect(r.getEnvironment(a,e.id).name).toBe('Env');expect(r.getRequest(a,req.id).config).toEqual(config())
 expect(r.renameCollection(a,c.id,'Renamed').name).toBe('Renamed');expect(r.renameEnvironment(a,e.id,'Renamed env').name).toBe('Renamed env')
 rejected(()=>r.createWorkspace(' '),'VALIDATION')
})
it('rejects foreign workspace IDs on all descendant reads and mutations without changing either workspace',()=>{
 const {r,a,b}=setup(),c=r.createCollection(a,'Group'),e=r.createEnvironment(a,'Env'),q=r.createRequest(a,'Request',c.id,config()),s=r.createSecret(a,'session',null),v=r.upsertVariable(a,null,'key',plain('saved'))
 const operations=[()=>r.getCollection(b,c.id),()=>r.renameCollection(b,c.id,'bad'),()=>r.deleteCollection(b,c.id),()=>r.getEnvironment(b,e.id),()=>r.renameEnvironment(b,e.id,'bad'),()=>r.deleteEnvironment(b,e.id),()=>r.getRequest(b,q.id),()=>r.saveRequest(b,q.id,'bad',config()),()=>r.deleteRequest(b,q.id),()=>r.duplicateRequest(b,q.id),()=>r.moveRequest(b,q.id,null),()=>r.getVariable(b,v.id),()=>r.deleteVariable(b,v.id),()=>r.getSecret(b,s.id),()=>r.updateSecret(b,s.id,'session',null),()=>r.deleteSecret(b,s.id),()=>r.listVariables(b,e.id),()=>r.setState(b,e.id,null),()=>r.setState(b,null,q.id),()=>r.createRequest(b,'bad',c.id,config()),()=>r.moveRequest(a,q.id,r.createCollection(b,'B group').id),()=>r.upsertVariable(b,null,'secret',{isSensitive:true,plainValue:null,secretId:s.id})]
 for(const operation of operations)rejected(operation)
 expect(r.getRequest(a,q.id).name).toBe('Request');expect(r.getVariable(a,v.id).plainValue).toBe('saved');expect(r.listRequests(b)).toEqual([]);expect(r.getState(b).selectedRequestId).toBeNull()
})
it('moves requests and deletes collections transactionally without deleting saved requests or selections',()=>{
 const {r,a}=setup(),c=r.createCollection(a,'Group'),d=r.createCollection(a,'Second'),q=r.createRequest(a,'Request',c.id,config())
 r.setState(a,null,q.id);expect(r.moveRequest(a,q.id,d.id).collectionId).toBe(d.id)
 r.deleteCollection(a,d.id);expect(r.getRequest(a,q.id).collectionId).toBeNull();expect(r.getState(a).selectedRequestId).toBe(q.id)
})
it('persists per-workspace selections across reopen and clears selected IDs before deletion',()=>{
 const fixture=setup(),{db,a,b,path}=fixture
 let r=fixture.r
 const e=r.createEnvironment(a,'Env'),q=r.createRequest(a,'Request',null,config())
 r.setState(a,e.id,q.id);r.selectWorkspace(a)
 db.close()
 const next=openDatabase(join(path,'test.sqlite'));resources.push({db:next,path});r=new Repositories(next)
 expect(r.getState(a)).toMatchObject({activeEnvironmentId:e.id,selectedRequestId:q.id});expect(r.getSelectedWorkspace()).toBe(a);expect(r.getState(b).selectedRequestId).toBeNull()
 r.deleteRequest(a,q.id);expect(r.getState(a).selectedRequestId).toBeNull();r.deleteEnvironment(a,e.id);expect(r.getState(a).activeEnvironmentId).toBeNull()
 r.deleteWorkspace(a);expect(r.getSelectedWorkspace()).toBeNull();expect(r.getWorkspace(b).name).toBe('B')
})
it('handles stale or foreign persisted selection metadata without returning another workspace selection',()=>{
 const {db,r,a,b}=setup(),e=r.createEnvironment(b,'Other'),q=r.createRequest(b,'Other request',null,config())
 db.pragma('foreign_keys = OFF');db.prepare('UPDATE workspace_state SET active_environment_id=?,selected_request_id=? WHERE workspace_id=?').run(e.id,q.id,a);db.pragma('foreign_keys = ON')
 expect(r.getState(a)).toEqual({workspaceId:a,activeEnvironmentId:null,selectedRequestId:null})
})
it('upserts variables by case-sensitive scope, bounds entries and removes orphan secrets on conversion',()=>{
 const {r,a,b}=setup(),e=r.createEnvironment(a,'Env'),s=r.createSecret(a,'session',null)
 const first=r.upsertVariable(a,null,'key',plain('one'));expect(r.upsertVariable(a,null,'key',plain('two')).id).toBe(first.id)
 r.upsertVariable(a,null,'KEY',plain());r.upsertVariable(a,e.id,'key',plain());r.upsertVariable(b,null,'key',plain())
 const sensitive=r.upsertVariable(a,e.id,'sensitive',{isSensitive:true,plainValue:null,secretId:s.id})
 expect(sensitive.isSensitive).toBe(true);r.upsertVariable(a,e.id,'sensitive',plain('ordinary'));rejected(()=>r.getSecret(a,s.id))
 expect(r.listVariables(a,null)).toHaveLength(2);expect(r.listVariables(a,e.id)).toHaveLength(2)
 for(let i=2;i<100;i++)r.upsertVariable(a,null,`key_${i}`,plain())
 rejected(()=>r.upsertVariable(a,null,'overflow',plain()),'VALIDATION')
 expect(r.upsertVariable(a,null,'key',plain('updated')).plainValue).toBe('updated')
})
it('deletes environment variables and owned secrets while preserving other scopes',()=>{
 const {r,a}=setup(),e=r.createEnvironment(a,'Env'),s=r.createSecret(a,'secure',Buffer.from('synthetic ciphertext'))
 r.upsertVariable(a,e.id,'sensitive',{isSensitive:true,plainValue:null,secretId:s.id});r.upsertVariable(a,null,'key',plain('workspace'));r.setState(a,e.id,null)
 r.deleteEnvironment(a,e.id);expect(r.listVariables(a,null)).toHaveLength(1);rejected(()=>r.getSecret(a,s.id));expect(r.getState(a).activeEnvironmentId).toBeNull()
})
it('duplicates saved requests and independently owned auth secret records, honoring Unicode name length',()=>{
 const {r,a}=setup(),secret=r.createSecret(a,'secure',Buffer.from('synthetic ciphertext')),input:StoredRequestConfig={...config(),auth:{mode:'bearer',token:{kind:'secret',secretId:secret.id}}}
 const original=r.createRequest(a,'😀'.repeat(100),null,input),copy=r.duplicateRequest(a,original.id)
 expect(copy.request.id).not.toBe(original.id);expect(Array.from(copy.request.name)).toHaveLength(100);expect(copy.request.name.endsWith(' (copy)')).toBe(true)
 expect(copy.secretCopies).toHaveLength(1)
 const cloned=copy.secretCopies[0];if(!cloned)throw new Error('Missing copy')
 expect(cloned.id).not.toBe(secret.id);expect(r.getSecret(a,cloned.id).encryptedValue).toEqual(Buffer.from('synthetic ciphertext'))
 r.deleteRequest(a,original.id);rejected(()=>r.getSecret(a,secret.id));expect(r.getRequest(a,copy.request.id).config).toEqual({...input,auth:{mode:'bearer',token:{kind:'secret',secretId:cloned.id}}})
 r.deleteRequest(a,copy.request.id);rejected(()=>r.getSecret(a,cloned.id))
})
it('duplicates unresolved session metadata with explicit mappings and prevents sharing secret owners',()=>{
 const {r,a,b}=setup(),s=r.createSecret(a,'session',null),input:StoredRequestConfig={...config(),auth:{mode:'basic',username:{kind:'secret',secretId:s.id},password:{kind:'secret',secretId:s.id}}},q=r.createRequest(a,'Request',null,input)
 rejected(()=>r.upsertVariable(a,null,'shared',{isSensitive:true,plainValue:null,secretId:s.id}),'VALIDATION')
 rejected(()=>r.createRequest(b,'Foreign',null,input))
 rejected(()=>r.deleteSecret(a,s.id),'VALIDATION')
 const copy=r.duplicateRequest(a,q.id);expect(copy.secretCopies).toHaveLength(1)
 const copied=copy.secretCopies[0];if(!copied)throw new Error('Missing mapping');expect(r.getSecret(a,copied.id)).toMatchObject({storageMode:'session',encryptedValue:null})
})
it('saving a new auth configuration removes only superseded independently owned secrets',()=>{
 const {r,a}=setup(),s=r.createSecret(a,'session',null),q=r.createRequest(a,'Request',null,{...config(),auth:{mode:'bearer',token:{kind:'secret',secretId:s.id}}})
 r.saveRequest(a,q.id,'Changed',config());rejected(()=>r.getSecret(a,s.id));expect(r.getRequest(a,q.id).config.auth.mode).toBe('none')
})
it('rolls back collection moves, selection clearing and environment cleanup on injected failures',()=>{
 const {db,r,a}=setup(),c=r.createCollection(a,'Group'),e=r.createEnvironment(a,'Env'),s=r.createSecret(a,'session',null),q=r.createRequest(a,'Request',c.id,config()),v=r.upsertVariable(a,e.id,'secret',{isSensitive:true,plainValue:null,secretId:s.id})
 r.setState(a,e.id,q.id)
 db.exec("CREATE TEMP TRIGGER fail_collection BEFORE DELETE ON collections BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END;")
 rejected(()=>r.deleteCollection(a,c.id),'DATABASE_WRITE_FAILED');expect(r.getRequest(a,q.id).collectionId).toBe(c.id)
 db.exec("CREATE TEMP TRIGGER fail_environment BEFORE DELETE ON environments BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END;")
 rejected(()=>r.deleteEnvironment(a,e.id),'DATABASE_WRITE_FAILED');expect(r.getVariable(a,v.id).secretId).toBe(s.id);expect(r.getSecret(a,s.id).storageMode).toBe('session');expect(r.getState(a).activeEnvironmentId).toBe(e.id)
 db.exec("CREATE TEMP TRIGGER fail_request BEFORE DELETE ON requests BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END;")
 rejected(()=>r.deleteRequest(a,q.id),'DATABASE_WRITE_FAILED');expect(r.getState(a).selectedRequestId).toBe(q.id)
})
it('rolls back secret creation on failed duplication and workspace deletion cascades atomically',()=>{
 const {db,r,a,b}=setup(),s=r.createSecret(a,'session',null),q=r.createRequest(a,'Request',null,{...config(),auth:{mode:'bearer',token:{kind:'secret',secretId:s.id}}})
 db.exec("CREATE TEMP TRIGGER fail_copy BEFORE INSERT ON requests BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;")
 rejected(()=>r.duplicateRequest(a,q.id),'DATABASE_WRITE_FAILED');expect(db.prepare('SELECT id FROM secrets').all()).toEqual([{id:s.id}]);expect(r.listRequests(a)).toHaveLength(1)
 db.exec('DROP TRIGGER fail_copy');r.selectWorkspace(a);r.setState(a,null,q.id)
 db.exec("CREATE TEMP TRIGGER fail_workspace BEFORE DELETE ON workspaces BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;")
 rejected(()=>r.deleteWorkspace(a),'DATABASE_WRITE_FAILED');expect(r.getSelectedWorkspace()).toBe(a);expect(r.getState(a).selectedRequestId).toBe(q.id)
 db.exec('DROP TRIGGER fail_workspace');let aborted=false;r.deleteWorkspace(a,()=>{aborted=true;expect(r.getWorkspace(a).id).toBe(a)});expect(aborted).toBe(true)
 expect(r.listRequests(b)).toEqual([]);expect(db.prepare('SELECT * FROM secrets').all()).toEqual([])
})
it('rejects missing IDs and plaintext credential/capability payloads without persisting them',()=>{
 const {r,a}=setup();rejected(()=>r.getRequest(a,randomUUID()));rejected(()=>r.createSecret(a,'session',Buffer.from('synthetic')),'VALIDATION')
 const unsafe={...config(),auth:{mode:'bearer',token:{kind:'template',template:'synthetic literal'}}}
 // Runtime schema validation rejects unsupported persisted data without a type assertion.
 rejected(()=>Reflect.apply(r.createRequest,r,[a,'Bad',null,unsafe]),'VALIDATION');expect(r.listRequests(a)).toEqual([])
})
