import { launchDesktop } from './fixtures/desktop'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { startFixture } from './fixtures/http'
import { shutdown } from './fixtures/shutdown'

test('theme survives restart and failed saves without draft loss; keyboard scopes, contrast and resizing work in both appearances', async () => {
  test.setTimeout(60_000)
  const directory=mkdtempSync(join(tmpdir(),'api-client-theme-ui-')), fixture=await startFixture(), urls:string[]=[]
  fixture.server.on('request',r=>urls.push(r.url??''))
  const env={...Object.fromEntries(Object.entries(process.env).filter((e): e is [string,string]=>e[1]!==undefined&&!['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(e[0]))),XDG_CONFIG_HOME:directory,APPDATA:directory}
  let app=await launchDesktop({args:['.'],chromiumSandbox:true,env})
  try {
    let page=await app.firstWindow()
    await expect(page.getByLabel('Theme',{exact:true})).toBeEnabled()
    await expect(page.getByLabel('Theme',{exact:true})).toHaveValue('system')
    await page.emulateMedia({colorScheme:'dark'}); await expect(page.locator('html')).toHaveClass('dark')
    await page.getByRole('button',{name:'Create Workspace',exact:true}).click()
    const dialog=page.getByRole('dialog',{name:'Create workspace',exact:true})
    await dialog.getByLabel('Workspace name').fill('Theme fixture'); await page.keyboard.press('Enter'); await expect(dialog).not.toBeVisible()
    await page.getByRole('button',{name:'Create Request',exact:true}).click()
    await page.getByLabel('Request name',{exact:true}).fill('Draft stays mounted')
    await page.getByLabel('Request URL',{exact:true}).fill(fixture.url+'/echo')
    const w=await page.getByLabel('Workspace',{exact:true}).inputValue()
    for (const mode of ['light','dark'] as const) {
      await page.getByLabel('Theme',{exact:true}).focus()
      await page.keyboard.press('Home'); if(mode==='dark') await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Tab')
      await expect(page.getByLabel('Theme',{exact:true})).toHaveValue(mode)
      await expect(page.locator('html')).toHaveClass(mode)
      await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Draft stays mounted')
      await page.emulateMedia({colorScheme:mode==='light'?'dark':'light'}); await expect(page.locator('html')).toHaveClass(mode)
      await page.getByRole('tab',{name:'Settings',exact:true}).click()
      await page.getByLabel('Overall timeout (ms)',{exact:true}).fill('99'); await page.keyboard.press('Control+s')
      const error=page.locator('#timeout-error'); await expect(error).toBeVisible()
      await expect(page.getByLabel('Overall timeout (ms)',{exact:true})).toHaveAttribute('aria-describedby','timeout-error')
      const contrast=await error.evaluate(element=>{
        const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{const n=v/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4})
        const lum=(v:number[])=>v[0]!*0.2126+v[1]!*0.7152+v[2]!*0.0722
        let parent:Element|null=element, background=''
        while(parent){background=getComputedStyle(parent).backgroundColor;if(background!=='rgba(0, 0, 0, 0)'&&background!=='transparent')break;parent=parent.parentElement}
        const a=lum(rgb(getComputedStyle(element).color)),b=lum(rgb(background));return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)
      })
      console.log(`${mode} field-error contrast`,contrast); expect(contrast).toBeGreaterThanOrEqual(4.5)
      await page.setViewportSize({width:1280,height:720}); await page.screenshot({path:`/tmp/api-client-theme-${mode}.png`,animations:'disabled'})
      await page.setViewportSize({width:1000,height:700}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      await page.getByLabel('Overall timeout (ms)',{exact:true}).fill('30000')
    }
    await page.getByLabel('Theme',{exact:true}).focus(); await page.keyboard.press('Control+Enter'); expect(urls).toEqual([])
    await page.getByRole('button',{name:'Import workspace JSON',exact:true}).click()
    const importing=page.getByRole('dialog',{name:'Import workspace JSON',exact:true})
    await page.keyboard.press('Control+s'); await page.keyboard.press('Control+Enter')
    expect(await page.evaluate(w=>window.offlineApi.requests.list(w),w)).toMatchObject({ok:true,data:{requests:[]}}); expect(urls).toEqual([])
    await page.keyboard.press('Escape'); await expect(importing).not.toBeVisible(); await expect(page.getByRole('button',{name:'Import workspace JSON',exact:true})).toBeFocused()
    await page.getByLabel('Request URL',{exact:true}).focus(); await page.keyboard.press('Control+s')
    await expect(page.getByRole('status').filter({hasText:/^Saved$/})).toBeVisible()
    await expect(page.getByLabel('Request URL',{exact:true})).toBeFocused()
    // The Ctrl+Enter listener is re-registered in a passive effect after the save commits; let that effect flush first.
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0))))
    await page.keyboard.press('Control+Enter'); await expect(page.getByLabel('Response body text')).toContainText('bodyLength'); expect(urls).toEqual(['/echo'])
    const response=page.getByRole('region',{name:'Response',exact:true}), before=(await response.boundingBox())!.height
    await page.getByRole('button',{name:'Increase response panel height',exact:true}).focus(); await page.keyboard.press('Enter')
    await expect.poll(async()=>(await response.boundingBox())!.height).toBeGreaterThan(before)
    await page.getByRole('button',{name:'Decrease response panel height',exact:true}).focus(); await page.keyboard.press('Enter')
    await expect.poll(async()=>(await response.boundingBox())!.height).toBe(before)
    await response.scrollIntoViewIfNeeded()
    const bounds=(await response.boundingBox())!
    await page.mouse.move(bounds.x+bounds.width-3,bounds.y+bounds.height-3);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width-3,bounds.y+bounds.height+17,{steps:5});await page.mouse.up()
    await expect.poll(async()=>(await response.boundingBox())!.height).toBeGreaterThan(before)
    await page.getByRole('button',{name:'Decrease response panel height',exact:true}).focus();await page.keyboard.press('Enter')
    const editor=page.getByRole('region',{name:'Request editor',exact:true})
    await editor.focus();await page.keyboard.press('Home');const scroll=await editor.evaluate(e=>e.scrollTop);await page.keyboard.press('PageDown');await expect.poll(()=>editor.evaluate(e=>e.scrollTop)).toBeGreaterThan(scroll)
    await page.getByRole('tab',{name:'Params',exact:true}).click(); await page.getByRole('button',{name:'Add param',exact:true}).focus(); await page.keyboard.press('Enter')
    await expect(page.getByLabel('Param 1 key',{exact:true})).toBeVisible(); await page.getByLabel('Param 1 key',{exact:true}).fill('keyboard'); await page.keyboard.press('Tab'); await expect(page.getByLabel('Param 1 value',{exact:true})).toBeFocused(); await page.keyboard.type('kept')
    await page.getByLabel('Theme',{exact:true}).selectOption('light'); await expect(page.locator('html')).toHaveClass('light')
    await app.evaluate(({app})=>{
      const load=process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`), Driver:typeof import('better-sqlite3')=load('better-sqlite3'),db=new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try{db.exec("CREATE TRIGGER fail_theme BEFORE UPDATE ON app_settings WHEN NEW.key='theme' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END")}finally{db.close()}
    })
    await page.getByLabel('Theme',{exact:true}).selectOption('dark'); await expect(page.locator('#theme-error')).toContainText('previous preference and draft have been kept')
    await expect(page.locator('html')).toHaveClass('light'); await expect(page.getByLabel('Param 1 value',{exact:true})).toHaveValue('kept')
    await app.evaluate(({app})=>{const load=process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`),Driver:typeof import('better-sqlite3')=load('better-sqlite3'),db=new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`);try{db.exec('DROP TRIGGER fail_theme')}finally{db.close()}})
    await page.getByLabel('Request URL',{exact:true}).focus(); await page.keyboard.press('Control+s'); await expect(page.getByRole('status').filter({hasText:/^Saved$/})).toBeVisible()
    for(const mode of ['light','dark','system'] as const){
      await page.getByLabel('Theme',{exact:true}).selectOption(mode); await expect(page.getByLabel('Theme',{exact:true})).toBeEnabled()
      await app.close(); app=await launchDesktop({args:['.'],chromiumSandbox:true,env});page=await app.firstWindow()
      await expect(page.getByLabel('Theme',{exact:true})).toHaveValue(mode); await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Draft stays mounted')
      await page.emulateMedia({colorScheme:'dark'}); await expect(page.locator('html')).toHaveClass(mode==='light'?'light':'dark')
      if(mode==='system'){await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveClass('light')}
    }
    expect(await page.evaluate(()=>performance.getEntriesByType('resource').every(e=>e.name.startsWith('file:')||e.name.startsWith('data:')))).toBe(true)
  }finally{await shutdown(app);await fixture.close();rmSync(directory,{recursive:true,force:true})}
})
