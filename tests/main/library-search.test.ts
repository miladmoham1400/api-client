import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { RequestService } from '../../src/main/services/requests'
import { createRequestHandlers } from '../../src/main/ipc/requests'
import { createDefaultRequestConfig } from '../../src/shared/request-config'
import { normalizeSearch, searchPageSchema } from '../../src/shared/library-search'
const stored=()=>({...createDefaultRequestConfig(),auth:{mode:'none' as const}})
const cleanup:(()=>void)[]=[]
afterEach(()=>{vi.restoreAllMocks();cleanup.splice(0).forEach(fn=>fn())})
function fixture() {
  const directory=mkdtempSync(join(tmpdir(),'library-search-')),db=openDatabase(join(directory,'synthetic.sqlite'))
  cleanup.push(()=>{db.close();rmSync(directory,{recursive:true,force:true})})
  const r=new Repositories(db),w=r.createWorkspace('Search').id,other=r.createWorkspace('Other').id,c=r.createCollection(w,'Café Users').id,f=r.createFolder(w,c,null,'Auth').id,foreign=r.createCollection(other,'Foreign').id
  r.selectWorkspace(w)
  const frame={url:'file:///app/index.html'},contents={mainFrame:frame},service=new RequestService(db),handlers=createRequestHandlers(()=>({isDestroyed:()=>false,webContents:contents}),frame.url,()=>service)
  return {db,r,w,other,c,f,foreign,service,handlers,event:{sender:contents,senderFrame:frame},frame,contents}
}
it('searches literal NFC Latin-folded metadata/path only, retaining duplicates and stable complete pages',()=>{
  const f=fixture()
  const config={...stored(),method:'POST' as const,body:{kind:'json' as const,text:'{"privateMarker":"payloadOnly"}'},urlTemplate:'http://urlOnly.invalid',headerRows:[{id:randomUUID(),key:'X-Test',value:'headerOnly',enabled:true}]}
  // Seed in one transaction so fixture disk commits do not dominate this search test.
  f.db.transaction(()=>{
    for(let i=0;i<205;i++) f.r.createRequest(f.w,i<2 ? 'Duplicate' : `Item ${String(i).padStart(3,'0')}`,f.c,config,f.f)
    f.r.createRequest(f.w,'Literal %_*[x]',null,stored())
    f.r.createRequest(f.other,'Item foreign',f.foreign,stored())
  })()
  const read=vi.spyOn(Repositories.prototype,'getRequest').mockImplementation(()=>{throw new Error('No configs')})
  const args={query:' cafe\u0301 USERS / AUTH ',offset:0,limit:100}
  const first=f.service.search(f.w,args),second=f.service.search(f.w,{...args,offset:first.nextOffset!,revision:first.revision}),third=f.service.search(f.w,{...args,offset:second.nextOffset!,revision:second.revision})
  expect([first.rows.length,second.rows.length,third.rows.length]).toEqual([100,100,5]);expect(third.nextOffset).toBeNull()
  const ids=[...first.rows,...second.rows,...third.rows].map(r=>r.id)
  expect(new Set(ids).size).toBe(205);expect(first.rows.filter(r=>r.name==='Duplicate')).toHaveLength(2)
  expect(f.service.search(f.w,{query:'post',collectionId:f.c,offset:0,limit:1}).total).toBe(205)
  for(const query of ['payloadOnly','urlOnly','headerOnly','Item foreign','.*']) expect(f.service.search(f.w,{query,offset:0,limit:100}).total).toBe(0)
  expect(f.service.search(f.w,{query:'%_*[x]',offset:0,limit:100}).total).toBe(1)
  expect(read).not.toHaveBeenCalled();expect(Object.keys(first.rows[0]!)).not.toContain('config')
  expect(normalizeSearch(' É A Ω ')).toBe('é a Ω')
  expect(searchPageSchema.safeParse({...first,nextOffset:null}).success).toBe(false)
})
it('rejects foreign/stale scopes, malformed and stale/query-switched pagination; mutations require restart',()=>{
  const f=fixture();f.r.createRequest(f.w,'Item',f.c,stored(),f.f)
  const args={query:'Item',offset:0,limit:1},first=f.service.search(f.w,args)
  for(const input of [{...args,query:'x'.repeat(201)},{...args,limit:101},{...args,offset:-1},{...args,offset:1},{...args,offset:0.5},{...args,revision:'unsafe'},{...args,body:'forbidden'}]) expect(f.handlers.search(f.event,f.w,input)).toMatchObject({ok:false,error:{code:'VALIDATION'}})
  for(const collectionId of [f.foreign,randomUUID()]) expect(f.handlers.search(f.event,f.w,{...args,collectionId})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
  expect(f.handlers.search(f.event,f.other,args)).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
  expect(f.handlers.search({sender:{},senderFrame:f.frame},f.w,args)).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
  expect(f.handlers.search({sender:f.contents,senderFrame:{url:f.frame.url}},f.w,args)).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
  expect(f.handlers.search(f.event,f.w,{...args,query:'different',revision:first.revision})).toMatchObject({ok:false,error:{code:'VALIDATION'}})
  expect(f.handlers.search(f.event,f.w,{...args,offset:2,revision:first.revision})).toMatchObject({ok:false,error:{code:'VALIDATION'}})
  f.r.renameFolder(f.w,f.f,'New Auth')
  expect(f.handlers.search(f.event,f.w,{...args,revision:first.revision})).toMatchObject({ok:false,error:{code:'VALIDATION'}})
  expect(f.service.search(f.w,args).rows[0]!.path).toContain('New Auth')
})
