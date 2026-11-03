import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'

test('Postman file preview/import and collection export use the real IPC/file services without auto-send',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'postman-ui-')),source=join(directory,'source.postman_collection.json'),destination=join(directory,'result.postman_collection.json'),received:{url:string|undefined;body:string}[]=[]
 const fixture=await startFixture(false,(req,res)=>{let body='';req.setEncoding('utf8');req.on('data',(chunk:string)=>body+=chunk);req.on('end',()=>{received.push({url:req.url,body});res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}')})})
 writeFileSync(source,JSON.stringify({info:{name:'Postman fixture',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},variable:[{key:'base_url',value:fixture.url}],event:[{listen:'prerequest',script:{exec:['window.mustNotRun=true']}}],item:[{name:'Users',item:[{name:'Create user',request:{method:'POST',url:{raw:'{{base_url}}/users?q=one',query:[{key:'q',value:'one'},{key:'q',value:'disabled',disabled:true}]},body:{mode:'raw',raw:'{"case":1}',options:{raw:{language:'json'}}}},response:[{name:'Alternative',originalRequest:{body:{mode:'raw',raw:'{"case":2}',options:{raw:{language:'json'}}}}}]}]}]}))
 const env={...Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined&&!['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(e[0]))),XDG_CONFIG_HOME:directory,APPDATA:directory}
 const app=await launchDesktop({args:['.'],chromiumSandbox:true,env})
 try {
  const page=await app.firstWindow()
  await app.evaluate(({dialog},paths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[paths.source]});dialog.showSaveDialog=async()=>({canceled:false,filePath:paths.destination})},{source,destination})
  await page.getByRole('button',{name:'Import collection or workspace',exact:true}).click()
  const importing=page.getByRole('dialog',{name:'Import collection or workspace',exact:true})
  await importing.getByRole('button',{name:'Choose JSON file',exact:true}).click()
  await expect(importing).toContainText('Postman Collection v2.1')
  await expect(importing).toContainText('Scripts, tests, response payloads')
  await expect(importing).toContainText('1 collections; 1 folders; 0 environments; 1 requests')
  await page.screenshot({path:'/tmp/api-client-postman-import.png',animations:'disabled'})
  expect(received).toHaveLength(0)
  await importing.getByRole('button',{name:'Import as new workspace',exact:true}).click()
  await expect(importing).not.toBeVisible()
  const workspaces=await page.evaluate(()=>window.offlineApi.workspaces.list());if(!workspaces.ok)throw new Error('Missing workspace')
  const w=workspaces.data.workspaces.find(w=>w.name==='Postman fixture (imported)')!
  await page.getByLabel('Workspace',{exact:true}).selectOption(w.id)
  const requests=await page.evaluate(w=>window.offlineApi.requests.list(w),w.id);if(!requests.ok)throw new Error('Missing requests')
  await page.evaluate(async({w,id})=>window.offlineApi.requests.get(w,id),{w:w.id,id:requests.data.requests[0]!.id});await page.reload()
  await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Create user')
  await page.getByRole('region',{name:'Request editor',exact:true}).getByRole('tab',{name:'Body',exact:true}).click()
  await page.getByLabel('Body variant',{exact:true}).selectOption({label:'Alternative'})
  expect(received).toHaveLength(0)
  await page.getByRole('button',{name:'Send',exact:true}).click()
  await expect.poll(()=>received.length).toBe(1)
  expect(received[0]!.url).toBe('/users?q=one');expect(JSON.parse(received[0]!.body) as unknown).toEqual({case:2})
  expect(await page.evaluate(()=>Reflect.get(window,'mustNotRun'))).toBeUndefined()
  await page.getByRole('button',{name:'Export Postman collection',exact:true}).click()
  const exporting=page.getByRole('dialog',{name:'Export Postman collection',exact:true})
  await expect(exporting.getByLabel('Collection to export')).toContainText('Postman fixture')
  await page.screenshot({path:'/tmp/api-client-postman-export.png',animations:'disabled'})
  await exporting.getByRole('button',{name:'Choose save location',exact:true}).click()
  await expect(exporting).not.toBeVisible()
  const output:unknown=JSON.parse(readFileSync(destination,'utf8'))
  expect(output).toMatchObject({info:{schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},item:[{name:'Users',item:[{name:'Create user',request:{method:'POST',body:{raw:'{"case":2}'}}}]}]})
  expect(readFileSync(destination,'utf8')).not.toContain('mustNotRun')
  expect(received).toHaveLength(1)
 }finally{await shutdown(app);await fixture.close();rmSync(directory,{recursive:true,force:true})}
})
