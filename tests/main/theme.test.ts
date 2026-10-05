import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../../src/main/db/database'
import { Repositories } from '../../src/main/db/repositories'
import { createThemeHandlers } from '../../src/main/ipc/theme'
const cleanup: (() => void)[] = []
afterEach(() => cleanup.splice(0).forEach(fn => fn()))
function fixture() {
  const directory = mkdtempSync(join(tmpdir(),'api-client-theme-')), path = join(directory,'data.sqlite'), db = openDatabase(path), r = new Repositories(db)
  cleanup.push(() => { if (db.open) db.close(); rmSync(directory,{ recursive:true,force:true }) })
  return { db, r, path }
}
it('defaults to System, persists all themes across reopen and preserves unrelated selection/data', () => {
  const f = fixture(), w = f.r.createWorkspace('Kept'); f.r.selectWorkspace(w.id)
  expect(f.r.getTheme()).toBe('system')
  for (const theme of ['light','dark','system'] as const) {
    expect(f.r.setTheme(theme)).toBe(theme)
    const other = openDatabase(f.path)
    try { expect(new Repositories(other).getTheme()).toBe(theme) } finally { other.close() }
    expect(f.r.getWorkspace(w.id)).toEqual(w); expect(f.r.getSelectedWorkspace()).toBe(w.id)
  }
})
it('rejects invalid/foreign IPC and rolls back a failed preference write', () => {
  const f = fixture(), frame = {url:'file:///app/index.html'}, contents = { mainFrame:frame }, window = {isDestroyed:()=>false,webContents:contents}, event={sender:contents,senderFrame:frame}
  const handlers = createThemeHandlers(()=>window,frame.url,()=>f.r)
  expect(handlers.get(event,'theme')).toMatchObject({ok:false,error:{code:'VALIDATION'}})
  expect(handlers.set(event,'custom')).toMatchObject({ok:false,error:{code:'VALIDATION'}})
  expect(handlers.set({sender:{},senderFrame:frame},'dark')).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
  expect(handlers.get({sender:contents,senderFrame:{url:frame.url}})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})
  f.r.setTheme('light')
  f.db.exec("CREATE TRIGGER fail_theme BEFORE UPDATE ON app_settings WHEN NEW.key='theme' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END")
  const before=f.db.serialize()
  expect(handlers.set(event,'dark')).toMatchObject({ok:false})
  expect(f.r.getTheme()).toBe('light'); expect(f.db.serialize()).toEqual(before)
})
