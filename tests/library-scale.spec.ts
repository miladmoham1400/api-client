import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir, cpus, totalmem } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'

async function painted(page:Page) {await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))}
test('1000 requests/1000 folders remain bounded, paged, searchable, guarded and correct on the wire with measured readiness',async()=>{
  test.setTimeout(180_000)
  const received:{url:string|undefined;method:string|undefined;body:string}[]=[]
  const server=await startFixture(false,(req,res)=>{let body='';req.setEncoding('utf8');req.on('data',(chunk:string)=>body+=chunk);req.on('end',()=>{received.push({url:req.url,method:req.method,body});res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}')})})
  const directory=mkdtempSync(join(tmpdir(),'api-client-scale-')),env={...Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined && !['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(e[0]))),XDG_CONFIG_HOME:directory,APPDATA:directory}
  let app=await launchDesktop({args:['.'],chromiumSandbox:true,env})
  try {
    // Seed the isolated synthetic app DB directly in a transaction; never call repositories against user data.
    const seeded=await app.evaluate(({app},url)=>{
      const load=process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`),Driver:typeof import('better-sqlite3')=load('better-sqlite3'),db=new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`),stamp=new Date().toISOString()
      const uuid=()=>process.getBuiltinModule('crypto').randomUUID(),w=uuid(),other=uuid(),collections:string[]=[],folders:string[]=[],requests:string[]=[]
      try {db.pragma('foreign_keys=ON');db.transaction(()=>{
        const workspace=db.prepare('INSERT INTO workspaces VALUES (?,?,?,?)'),state=db.prepare('INSERT INTO workspace_state(workspace_id) VALUES (?)')
        workspace.run(w,'Scale fixture',stamp,stamp);workspace.run(other,'Separate fixture',stamp,stamp);state.run(w);state.run(other)
        const collection=db.prepare('INSERT INTO collections VALUES (?,?,?,?,?,?)'),folder=db.prepare('INSERT INTO folders VALUES (?,?,?,?,?,?,?,?)'),request=db.prepare('INSERT INTO requests(id,workspace_id,collection_id,folder_id,name,config_version,config_json,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?,?)')
        for(let i=0;i<100;i++) {const c=uuid();collections.push(c);collection.run(c,w,`Collection ${String(i).padStart(3,'0')}`,i,stamp,stamp)}
        for(let i=0;i<1000;i++) {const id=uuid();folders.push(id);const position=i%10;folder.run(id,w,collections[i>=10 && i<16 ? 0 : Math.floor(i/10)],(position===0 && i!==10) || i===16 ? null : folders[i-1],`Folder ${String(i).padStart(4,'0')}`,0,stamp,stamp)}
        const config=(index:number)=>({configVersion:1,method:'POST',urlTemplate:`${url}/api/${index}`,queryRows:[],headerRows:[],body:{kind:'json',text:JSON.stringify({index})},auth:{mode:'none'},timeoutMs:30000,followRedirects:false})
        for(let i=0;i<1000;i++) {const id=uuid();requests.push(id);request.run(id,w,collections[i>=10 && i<16 ? 0 : Math.floor(i/10)],folders[i],`API ${String(i).padStart(4,'0')}`,JSON.stringify(config(i)),stamp,stamp)}
        request.run(uuid(),other,null,null,'Other only',JSON.stringify(config(-1)),stamp,stamp)
        db.prepare('INSERT INTO workspace_tree_state VALUES (?,1,?)').run(w,JSON.stringify({expandedCollectionIds:collections,expandedFolderIds:folders}))
        db.prepare("INSERT INTO app_settings(key,value_json) VALUES ('lastWorkspaceId',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json").run(JSON.stringify(w))
      })();return {w,other,collections,requests}}
      finally {db.close()}
    },server.url)
    await app.close()
    const coldStart=performance.now()
    app=await launchDesktop({args:['.'],chromiumSandbox:true,env});const page=await app.firstWindow()
    await page.setViewportSize({width:1280,height:720})
    await expect(page.getByLabel('Search requests',{exact:true})).toBeEnabled()
    await expect(page.getByRole('treeitem').first()).toBeVisible();await painted(page)
    const coldMs=performance.now()-coldStart
    const treeCounts:number[]=[await page.getByRole('treeitem').count()],searchCounts:number[]=[],selections:number[]=[],searches:number[]=[]
    expect(treeCounts[0]).toBe(50)
    // Browse every page, proving continuation exposes first, middle, last without truncation.
    const seen=new Set<string>()
    for(let offset=0;offset<2100;offset+=50) {
      for(const id of await page.locator('[data-library-id]').evaluateAll(elements=>elements.map(e=>e.getAttribute('data-library-id')!))) seen.add(id)
      treeCounts.push(await page.getByRole('treeitem').count())
      if(offset+50<2100) await page.getByRole('button',{name:'Next nodes',exact:true}).click()
    }
    expect(seen.size).toBe(2100);for(const i of [0,500,999]) expect(seen.has(seeded.requests[i]!)).toBe(true)
    const search=page.getByLabel('Search requests',{exact:true})
    async function query(value:string) {await search.fill(value);await expect(page.locator('[data-search-ready]')).toHaveAttribute('data-search-ready',value);await painted(page)}
    async function select(index:number) {await page.locator(`[data-search-id="${seeded.requests[index]}"]`).click();await expect(page.getByLabel('Request name',{exact:true})).toHaveValue(`API ${String(index).padStart(4,'0')}`);await expect(page.getByRole('button',{name:'Save',exact:true})).toBeEnabled();await painted(page)}
    await query('API 0000');await select(0) // One warm-up before measuring.
    for(let i=1;i<=20;i++) {
      const index=i*47,name=`API ${String(index).padStart(4,'0')}`
      let start=performance.now();await query(name);searches.push(performance.now()-start);searchCounts.push(await page.locator('[data-search-id]').count())
      start=performance.now();await select(index);selections.push(performance.now()-start)
    }
    expect(received).toEqual([])
    for(const index of [0,500,999]) {await query(`API ${String(index).padStart(4,'0')}`);await select(index);await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('status').filter({hasText:/^Request completed$/})).toBeVisible()}
    expect(received).toEqual([0,500,999].map(index=>({url:`/api/${index}`,method:'POST',body:JSON.stringify({index})})))
    await query('API');expect(await page.locator('[data-search-id]').count()).toBe(100)
    const resultIds=new Set<string>()
    for(let i=0;i<10;i++) {for(const id of await page.locator('[data-search-id]').evaluateAll(es=>es.map(e=>e.getAttribute('data-search-id')!))) resultIds.add(id);if(i<9) await page.getByRole('button',{name:'Next results',exact:true}).click()}
    expect(resultIds.size).toBe(1000);await expect(page.getByRole('button',{name:'Next results',exact:true})).toHaveCount(0)
    await page.getByLabel('Request name',{exact:true}).fill('API 0999 revised')
    await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('status').filter({hasText:/^Saved$/})).toBeVisible()
    await expect(page.locator('[data-search-ready]')).toContainText('1–100 of 1000 requests')
    await page.getByLabel('Search collection').selectOption(seeded.collections[50]!);await expect(page.getByRole('region',{name:'Request search'})).toContainText('of 10 requests')
    // Guard result selection, clear/reveal selection, and preserve normal expansion.
    await page.getByLabel('Search collection').selectOption('');await query('API 0000')
    await page.getByLabel('Request name',{exact:true}).fill('Unsaved scale draft')
    await page.locator(`[data-search-id="${seeded.requests[0]}"]`).click()
    const guard=page.getByRole('dialog',{name:'Unsaved request changes',exact:true});await guard.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Unsaved scale draft')
    await page.locator(`[data-search-id="${seeded.requests[0]}"]`).click();await guard.getByRole('button',{name:'Discard',exact:true}).click();await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('API 0000')
    await page.getByRole('button',{name:'Clear search',exact:true}).click();await expect(page.locator(`[data-library-id="${seeded.requests[0]}"]`)).toBeVisible()
    const library=await page.evaluate(w=>window.offlineApi.library.list(w),seeded.w);expect(library).toMatchObject({ok:true,data:{treeState:{expandedCollectionIds:seeded.collections,expandedFolderIds:expect.arrayContaining([])}}})
    if(!library.ok) throw new Error('Missing library');expect(library.data.treeState.expandedFolderIds).toHaveLength(1000)
    const firstCollection=page.locator(`[data-library-id="${seeded.collections[0]}"]`)
    await firstCollection.getByRole('button').first().click();await query('API 0001');await select(1)
    await page.getByRole('button',{name:'Clear search',exact:true}).click();await expect(page.locator(`[data-library-id="${seeded.requests[1]}"]`)).toBeVisible()
    await page.getByRole('treeitem').first().focus();await page.getByRole('treeitem').first().press('End');await expect(page.locator(`[data-library-id="${seeded.requests[990]}"]`)).toBeFocused()
    await page.getByRole('treeitem').last().press('Home');await expect(page.getByRole('treeitem').first()).toBeFocused()
    for(const viewport of [{width:1280,height:720},{width:1000,height:700}]) {await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await search.boundingBox())!.height).toBeGreaterThanOrEqual(32);await page.screenshot({path:`/tmp/api-client-scale-${viewport.width}.png`,animations:'disabled'})}
    await page.getByLabel('Workspace',{exact:true}).selectOption(seeded.other)
    await query('Other');await expect(page.locator('[data-search-id]')).toHaveCount(1);await query('API');await expect(page.getByRole('region',{name:'Request search'})).toContainText('of 0 requests')
    const p95=(samples:number[])=>[...samples].sort((a,b)=>a-b)[Math.ceil(samples.length*0.95)-1]!
    const metrics={coldMs,selections,searches,selectionP95:p95(selections),searchP95:p95(searches),maxTreeRows:Math.max(...treeCounts),maxSearchRows:100,searchCounts,platform:process.platform,cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryBytes:totalmem(),dataset:{requests:1000,folders:1000,collections:100,depth:16,otherRequests:1},viewport:{width:1280,height:720}}
    writeFileSync(process.env.API_CLIENT_PERFORMANCE_REPORT ?? '/tmp/task035-performance.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics))
    // Normal restart must retain the complete library, destinations, expansion and exact selected config.
    await page.getByLabel('Workspace',{exact:true}).selectOption(seeded.w)
    await query('API 0001');await select(1)
    const beforeRestart=await page.evaluate(async w=>({library:await window.offlineApi.library.list(w),request:await window.offlineApi.requests.list(w)}),seeded.w)
    await app.close();app=await launchDesktop({args:['.'],chromiumSandbox:true,env})
    const reopened=await app.firstWindow()
    await expect(reopened.getByLabel('Request name',{exact:true})).toHaveValue('API 0001')
    await expect(reopened.getByLabel('Search requests',{exact:true})).toHaveValue('')
    const afterRestart=await reopened.evaluate(async w=>({library:await window.offlineApi.library.list(w),request:await window.offlineApi.requests.list(w)}),seeded.w)
    expect(afterRestart).toEqual(beforeRestart)
    expect(received).toEqual([0,500,999].map(index=>({url:`/api/${index}`,method:'POST',body:JSON.stringify({index})})))
    expect(metrics.maxTreeRows).toBeLessThanOrEqual(100);expect(coldMs).toBeLessThanOrEqual(2000);expect(metrics.selectionP95).toBeLessThanOrEqual(500);expect(metrics.searchP95).toBeLessThanOrEqual(500)
  } finally {await shutdown(app);await server.close();rmSync(directory,{recursive:true,force:true})}
})
