import { expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { RequestService } from '../../src/main/services/requests'
import { WorkspaceExportService } from '../../src/main/services/workspace-export'
import { exportPostman } from '../../src/main/services/postman'

it('retains per-body expectations through save/duplicate/reopen, excludes exports and enforces ownership', () => {
  const directory=mkdtempSync(join(tmpdir(),'response-tests-')),path=join(directory,'test.sqlite'),db=openDatabase(path)
  try {
    const r=new Repositories(db),w=r.createWorkspace('Tests'),other=r.createWorkspace('Other');r.selectWorkspace(w.id)
    const collection=r.createCollection(w.id,'Examples'),service=new RequestService(db),a=randomUUID(),b=randomUUID()
    const input={name:'Test',method:'POST' as const,urlTemplate:'http://127.0.0.1/',body:{kind:'json' as const,text:'{}'},expectedResponse:'{"syntheticExpected":"root"}',bodyVariants:[{id:a,name:'A',body:{kind:'json' as const,text:'{}'},expectedResponse:'{"syntheticExpected":"A"}'},{id:b,name:'B',body:{kind:'json' as const,text:'{"b":2}'},expectedResponse:'{"syntheticExpected":"B"}'}],selectedBodyVariantId:a}
    const created=service.create(w.id,{...input,collectionId:collection.id}),id=created.editor!.id
    expect(created.editor).toMatchObject({expectedResponse:input.expectedResponse,bodyVariants:input.bodyVariants})
    service.save(w.id,id,{name:input.name,method:input.method,urlTemplate:input.urlTemplate,body:{kind:'json',text:'{"edit":1}'}})
    expect(service.list(w.id).editor!.bodyVariants![0]!.expectedResponse).toBe(input.bodyVariants[0]!.expectedResponse)
    const copy=service.duplicate(w.id,id).editor!
    expect(copy.id).not.toBe(id);expect(copy.bodyVariants!.map(v=>v.expectedResponse)).toEqual(input.bodyVariants.map(v=>v.expectedResponse))
    const snapshot=new WorkspaceExportService(db,[]).snapshot(w.id)
    expect(JSON.stringify(snapshot)).not.toContain('syntheticExpected')
    expect(JSON.stringify(exportPostman(snapshot,collection.id))).not.toContain('syntheticExpected')
    expect(()=>service.get(other.id,id)).toThrow()
    const reopened=openDatabase(path)
    try {expect(new Repositories(reopened).getRequest(w.id,id).config.bodyVariants![1]!.expectedResponse).toBe(input.bodyVariants[1]!.expectedResponse)} finally {reopened.close()}
    service.save(w.id,id,{...input,expectedResponse:null,bodyVariants:input.bodyVariants.map(v=>({...v,expectedResponse:null}))})
    expect(r.getRequest(w.id,id).config.bodyVariants!.every(v=>v.expectedResponse===null)).toBe(true)
    expect(()=>service.save(w.id,id,{...input,expectedResponse:'{'})).toThrow()
    expect(r.getRequest(w.id,id).config.expectedResponse).toBeNull()
  } finally {db.close();rmSync(directory,{recursive:true,force:true})}
})
