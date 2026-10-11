import { expect, test } from '@playwright/test'
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initialSchema } from '../src/main/db/migrations/001-initial'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { startFixture } from './fixtures/http'

const envFor = (directory: string) => ({ ...Object.fromEntries(Object.entries(process.env).filter((e): e is [string,string] => e[1] !== undefined && !['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(e[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory })
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
test('closed phase-1 database upgrades in the target app without losing 1005 requests, configs, secrets, variables or state', async () => {
  test.setTimeout(90_000)
  const directory = mkdtempSync(join(tmpdir(), 'api-client-upgrade-')), legacy = join(directory, 'legacy'), file = join(legacy, 'offline-api-client', 'offline-api-client.sqlite')
  const fixture = await startFixture(), captured: string[] = []
  fixture.server.on('request', request => captured.push(request.url ?? ''))
  let app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env: envFor(join(directory, 'bootstrap')) })
  try {
    const bootstrap = await app.firstWindow()
    await expect(bootstrap.getByRole('heading',{name:'No request selected',exact:true})).toBeVisible()
    // Create a separate closed synthetic legacy profile, using the target's native SQLite ABI.
    const before = await app.evaluate(({ app }, { file, sql, url }) => {
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`), Driver: typeof import('better-sqlite3') = load('better-sqlite3')
      const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path'), uuid = () => process.getBuiltinModule('crypto').randomUUID(), stamp = '2026-10-11T00:00:00.000Z'
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const db = new Driver(file), w = uuid(), other = uuid(), c = uuid(), e = uuid(), requestId = uuid(), secret = uuid()
      try {
        db.pragma('foreign_keys=ON')
        db.transaction(() => {
          db.exec(sql + '; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);')
          db.prepare('INSERT INTO schema_migrations VALUES (1,?)').run(stamp)
          const workspace = db.prepare('INSERT INTO workspaces VALUES (?,?,?,?)')
          workspace.run(w,'Legacy fixture',stamp,stamp);workspace.run(other,'Legacy other',stamp,stamp)
          db.prepare('INSERT INTO collections VALUES (?,?,?,?,?,?)').run(c,w,'Legacy API',7,stamp,stamp)
          db.prepare('INSERT INTO environments VALUES (?,?,?,?,?)').run(e,w,'Local',stamp,stamp)
          db.prepare('INSERT INTO secrets VALUES (?,?,?,?,?,?)').run(secret,w,null,'session',stamp,stamp)
          const variable = db.prepare('INSERT INTO variables VALUES (?,?,?,?,?,?,?,?,?)')
          variable.run(uuid(),w,e,'token',1,null,secret,stamp,stamp)
          variable.run(uuid(),w,null,'plain',0,'سلام',null,stamp,stamp)
          const config = { configVersion:1, method:'POST',urlTemplate:url+'/echo',queryRows:[{id:uuid(),key:'same',value:'one',enabled:true},{id:uuid(),key:'same',value:'two',enabled:false}],headerRows:[],body:{kind:'json',text:' {"legacy":"سلام"} '},auth:{mode:'none'},timeoutMs:12345,followRedirects:false }
          const insert = db.prepare('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)')
          insert.run(requestId,w,c,'Legacy selected',1,JSON.stringify(config),stamp,stamp)
          for(let i=0;i<1004;i++) insert.run(uuid(),i===1003 ? other : w,i%2 || i===1003 ? null : c,`Legacy API ${i}`,1,JSON.stringify({...config,queryRows:[],body:{kind:'none'},method:'GET'}),stamp,stamp)
          db.prepare('INSERT INTO workspace_state VALUES (?,?,?)').run(w,e,requestId)
          db.prepare('INSERT INTO workspace_state VALUES (?,NULL,NULL)').run(other)
          db.prepare('INSERT INTO app_settings VALUES (?,?)').run('lastWorkspaceId',JSON.stringify(w))
          db.prepare('INSERT INTO app_settings VALUES (?,?)').run('theme',JSON.stringify('dark'))
        })()
        const tables = ['workspaces','collections','environments','secrets','variables','requests','workspace_state','app_settings','schema_migrations']
        return { w, other, requestId, tables: Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()])) }
      } finally { db.close() }
    }, { file, sql: initialSchema, url: fixture.url })
    await test.step('Normally close ready bootstrap profile',async()=>{await app.close()})
    const backup = join(directory, 'closed-phase1.sqlite'); copyFileSync(file, backup); const backupHash = hash(backup)
    app = await launchDesktop({ args: ['.'], chromiumSandbox: true, env: envFor(legacy) })
    let page = await app.firstWindow()
    await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Legacy selected')
    await expect(page.getByLabel('Theme',{exact:true})).toHaveValue('dark')
    const after = await app.evaluate(({ app }) => {
      const load = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`), Driver: typeof import('better-sqlite3') = load('better-sqlite3'), db = new Driver(`${app.getPath('userData')}/offline-api-client.sqlite`)
      try {
        const tables = ['workspaces','collections','environments','secrets','variables','requests','workspace_state','app_settings','schema_migrations']
        const values = Object.fromEntries(tables.map(table => [table, db.prepare(table === 'requests' ? 'SELECT id,workspace_id,collection_id,name,config_version,config_json,created_at,updated_at FROM requests ORDER BY id' : table === 'schema_migrations' ? 'SELECT * FROM schema_migrations WHERE version=1' : `SELECT * FROM ${table} ORDER BY 1`).all()]))
        return { values, ledger: db.prepare('SELECT version FROM schema_migrations').all(), foreignKeys: db.pragma('foreign_key_check'), folders: db.prepare('SELECT count(*) AS n FROM folders').get(), abi: process.versions.modules, packaged: app.isPackaged }
      } finally { db.close() }
    })
    expect(after.values).toEqual(before.tables);expect(after.ledger).toEqual([{version:1},{version:2}]);expect(after.foreignKeys).toEqual([]);expect(after.folders).toEqual({n:0});expect(after.abi).toBe('149')
    if (process.env.API_CLIENT_EXECUTABLE) expect(after.packaged).toBe(true)
    expect(hash(backup)).toBe(backupHash)
    await page.getByLabel('Workspace',{exact:true}).selectOption(before.other)
    const other = await page.evaluate(w=>window.offlineApi.requests.list(w),before.other)
    expect(other).toMatchObject({ok:true,data:{requests:[expect.objectContaining({name:'Legacy API 1003'})],editor:null}})
    await page.getByLabel('Workspace',{exact:true}).selectOption(before.w)
    await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Legacy selected')
    await expect(page.getByRole('button',{name:'Save',exact:true})).toBeEnabled()
    await app.close();app=await launchDesktop({args:['.'],chromiumSandbox:true,env:envFor(legacy)});page=await app.firstWindow()
    await expect(page.getByLabel('Request name',{exact:true})).toHaveValue('Legacy selected')
    const reopened=await page.evaluate(w=>window.offlineApi.requests.list(w),before.w)
    expect(reopened).toMatchObject({ok:true,data:{requests:expect.any(Array),editor:{id:before.requestId,folderId:null}}})
    if(!reopened.ok) throw new Error('Missing upgraded workspace');expect(reopened.data.requests).toHaveLength(1004)
    expect(hash(backup)).toBe(backupHash);expect(captured).toEqual([])
  } finally { await shutdown(app);await fixture.close();rmSync(directory,{recursive:true,force:true}) }
})
