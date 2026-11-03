import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'

test('named Body variants, JSON diagnostics, variable completion, expanded response and exact copy work together', async () => {
 const directory=mkdtempSync(join(tmpdir(),'body-template-ui-')), received:string[]=[]
 const fixture=await startFixture(false,(req,res)=>{let body='';req.setEncoding('utf8');req.on('data',(chunk:string)=>body+=chunk);req.on('end',()=>{received.push(body);res.writeHead(200,{'Content-Type':'application/json'});res.end('{"data":{"items":[{"name":"Visible immediately"}]}}')})})
 const env={...Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined&&!['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(e[0]))),XDG_CONFIG_HOME:directory,APPDATA:directory}
 let app=await launchDesktop({args:['.'],chromiumSandbox:true,env})
 try {
  let page=await app.firstWindow()
  await page.evaluate(async url=>{const api=window.offlineApi,w=await api.workspaces.create('Templates');if(!w.ok||!w.data.selectedWorkspaceId)throw new Error('Missing workspace');const id=w.data.selectedWorkspaceId;await api.variables.upsert(id,null,'base_url',url,false);await api.variables.upsert(id,null,'token','synthetic-private-value',true);await api.requests.create(id,{name:'Variant request',method:'POST',urlTemplate:'{{base_url}}/echo',collectionId:null,body:{kind:'json',text:'{"case":1}'}})},fixture.url)
  await page.reload();await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Variant request')
  const editor=page.getByRole('region',{name:'Request editor',exact:true}), response=page.getByRole('region',{name:'Response',exact:true})
  await editor.getByRole('tab',{name:'Body',exact:true}).click()
  const body=page.getByLabel('JSON source text',{exact:true})
  await body.fill('{"case":1,"large":9007199254740993}')
  await body.press('Tab');await body.press('Shift+Tab') // Tab inserts spaces; a later focus change formats.
  await page.getByLabel('Request name',{exact:true}).click()
  await expect(body).toHaveValue('{\n  "case": 1,\n  "large": 9007199254740993\n}')
  await body.fill('{"case":1 "broken":2}');await page.getByLabel('Request name',{exact:true}).click()
  await expect(editor.getByRole('alert')).toContainText(/Line 1, column/)
  await expect(body).toHaveValue('{"case":1 "broken":2}')
  await editor.getByRole('tab',{name:'Params',exact:true}).click()
  await expect(editor.getByRole('alert')).toBeVisible()
  await editor.getByRole('tab',{name:'Body',exact:true}).click()
  await body.fill('{"case":1}')
  await editor.getByRole('button',{name:'+ Body variant',exact:true}).click()
  await page.getByLabel('Body variant name').fill('Alternate')
  await body.fill('{"case":2}')
  await page.getByLabel('Body variant',{exact:true}).selectOption({label:'Body 1'})
  await expect(body).toHaveValue('{\n  "case": 1\n}')
  await page.getByRole('button',{name:'Send',exact:true}).click()
  await expect(response.getByLabel('Response body JSON')).toContainText('Visible immediately')
  await response.getByRole('button',{name:'Copy response',exact:true}).click()
  await expect(response).toContainText('Copied')
  expect(await app.evaluate(({clipboard})=>clipboard.readText())).toBe('{"data":{"items":[{"name":"Visible immediately"}]}}')
  await page.getByLabel('Body variant',{exact:true}).selectOption({label:'Alternate'})
  await page.getByRole('button',{name:'Send',exact:true}).click()
  await expect.poll(()=>received.length).toBe(2)
  expect(received.map(s=>JSON.parse(s) as unknown)).toEqual([{case:1},{case:2}])
  await page.screenshot({path:'/tmp/api-client-body-variants.png',animations:'disabled'})
  const url=page.getByLabel('Request URL',{exact:true})
  await url.fill('{{ba');await url.press('End')
  await expect(page.getByRole('listbox',{name:'Variable suggestions'})).toBeVisible()
  await page.screenshot({path:'/tmp/api-client-variable-completion.png',animations:'disabled'})
  await url.press('Tab');await expect(url).toHaveValue('{{base_url}}')
  await expect(page.locator('.template-backdrop .template-variable')).toContainText('{{base_url}}')
  expect(await page.content()).not.toContain('synthetic-private-value')
  await page.keyboard.press('Control+s');await app.close()
  app=await launchDesktop({args:['.'],chromiumSandbox:true,env});page=await app.firstWindow()
  await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Variant request')
  await page.getByRole('region',{name:'Request editor',exact:true}).getByRole('tab',{name:'Body',exact:true}).click()
  await expect(page.getByLabel('Body variant name')).toHaveValue('Alternate')
  expect(received).toHaveLength(2)
 } finally {await shutdown(app);await fixture.close();rmSync(directory,{recursive:true,force:true})}
})
