import { expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { RequestService } from '../../src/main/services/requests'
import { WorkspaceExportService } from '../../src/main/services/workspace-export'
import { randomUUID } from 'node:crypto'
it('persists variants across duplicate/native transfer/reopen and strips every upload capability', () => {
 const dir = mkdtempSync(join(tmpdir(), 'variants-')), path = join(dir, 'test.sqlite'), db = openDatabase(path)
 try {
  const r = new Repositories(db), w = r.createWorkspace('Variants'); r.selectWorkspace(w.id)
  const service = new RequestService(db), first = randomUUID(), second = randomUUID(), file = randomUUID(), row = randomUUID()
  const body = { kind: 'json' as const, text: '{"one":1}' }
  const result = service.create(w.id, { name: 'Example', method: 'POST', urlTemplate: 'http://127.0.0.1/', collectionId: null, body, bodyVariants: [{ id:first,name:'JSON',body },{ id:second,name:'Upload',body:{kind:'multipart',rows:[{id:row,key:'upload',kind:'file',enabled:true,fileId:file,fileName:'fixture.bin'}]} }], selectedBodyVariantId:first })
  expect(JSON.stringify(result)).not.toContain(file)
  const id = result.editor!.id
  const changed = service.save(w.id,id,{name:'Example',method:'POST',urlTemplate:'http://127.0.0.1/',body:{kind:'json',text:'{"one":2}'}})
  expect(changed.editor!.bodyVariants![0]!.body).toEqual({kind:'json',text:'{"one":2}'})
  expect(changed.editor!.bodyVariants![1]!.body.kind).toBe('multipart')
  expect(service.duplicate(w.id,id).editor!.bodyVariants).toHaveLength(2)
  const dto = new WorkspaceExportService(db,[]).snapshot(w.id)
  expect(JSON.stringify(dto)).not.toContain(file)
  const imported = r.importWorkspace(dto.workspace), requests = r.listStoredRequests(imported.id)
  expect(requests[0]!.config.bodyVariants).toHaveLength(2)
  expect(requests[0]!.config.bodyVariants![0]!.id).not.toBe(first)
  expect(requests[0]!.config.selectedBodyVariantId).toBe(requests[0]!.config.bodyVariants![0]!.id)
  const reopened = openDatabase(path)
  try { expect(new Repositories(reopened).getRequest(w.id,id).config.bodyVariants).toHaveLength(2) } finally { reopened.close() }
 } finally { db.close(); rmSync(dir,{recursive:true,force:true}) }
})
