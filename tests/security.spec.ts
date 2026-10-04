import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { _electron, expect, test } from '@playwright/test'

test('owned production window exposes only validated APIs and denies browser capabilities', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-smoke-'))
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[0] !== 'ELECTRON_RUN_AS_NODE' && entry[0] !== 'ELECTRON_RENDERER_URL'))
  env.XDG_CONFIG_HOME = directory
  env.APPDATA = directory
  const application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
    const preferences = await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (!window) throw new Error('Missing window')
      const inspect = Reflect.get(window.webContents, 'getLastWebPreferences')
      if (typeof inspect !== 'function') throw new Error('Preferences inspection unavailable')
      const preferences: unknown = Reflect.apply(inspect, window.webContents, [])
      if (!preferences || typeof preferences !== 'object') throw new Error('Invalid preferences')
      return {
        nodeIntegration: Reflect.get(preferences, 'nodeIntegration'), contextIsolation: Reflect.get(preferences, 'contextIsolation'),
        sandbox: Reflect.get(preferences, 'sandbox'), webSecurity: Reflect.get(preferences, 'webSecurity'), webviewTag: Reflect.get(preferences, 'webviewTag')
      }
    })
    expect(preferences).toEqual({ nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false })
    expect(await page.evaluate(() => ({
      keys: Object.keys(window.offlineApi), methods: Object.keys(window.offlineApi.app), environmentMethods: Object.keys(window.offlineApi.environments), variableMethods: Object.keys(window.offlineApi.variables), workspaceMethods: Object.keys(window.offlineApi.workspaces), collectionMethods: Object.keys(window.offlineApi.collections), requestMethods: Object.keys(window.offlineApi.requests),
      frozen: Object.isFrozen(window.offlineApi) && Object.isFrozen(window.offlineApi.app) && Object.isFrozen(window.offlineApi.environments) && Object.isFrozen(window.offlineApi.variables) && Object.isFrozen(window.offlineApi.workspaces) && Object.isFrozen(window.offlineApi.collections) && Object.isFrozen(window.offlineApi.requests),
      require: typeof Reflect.get(window, 'require'), process: typeof Reflect.get(window, 'process'),
      ipc: typeof Reflect.get(window, 'ipcRenderer')
    }))).toEqual({ keys: ['environments', 'variables', 'collections', 'requests', 'workspaces', 'app'], methods: ['getBootstrap'], environmentMethods: ['list', 'create', 'rename', 'delete', 'select'], variableMethods: ['list', 'upsert', 'delete', 'reveal'], workspaceMethods: ['list', 'create', 'rename', 'delete', 'select'], collectionMethods: ['list', 'create', 'rename', 'delete'], requestMethods: ['newRow', 'list', 'get', 'create', 'save', 'duplicate', 'delete', 'move'], frozen: true, require: 'undefined', process: 'undefined', ipc: 'undefined' })
    expect(await page.evaluate(() => window.offlineApi.app.getBootstrap())).toEqual({
      ok: true, data: { stage: 'foundation', capabilities: { database: true, requests: false }, database: { status: 'ready' } }
    })
    expect(await page.evaluate(() => Reflect.apply(window.offlineApi.app.getBootstrap, null, [{ script: 'synthetic' }]))).toEqual({
      ok: true, data: { stage: 'foundation', capabilities: { database: true, requests: false }, database: { status: 'ready' } }
    }) // Bridge method never forwards renderer-selected arguments/channels.
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toContain("connect-src 'none'")
    expect(csp).toContain("frame-src 'none'")
    expect(csp).not.toContain('ws:')
    expect(await page.evaluate(() => window.open('https://untrusted.invalid/'))).toBeNull()
    expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
    expect(await page.evaluate(async () => {
      try { await fetch('https://untrusted.invalid/'); return true } catch { return false }
    })).toBe(false)
    expect(await page.evaluate(() => Notification.requestPermission())).toBe('denied')
    const rejected = await application.evaluate(async ({ BrowserWindow, app }) => {
      const owned = BrowserWindow.getAllWindows()[0]
      if (!owned) throw new Error('Missing window')
      const preload = `${app.getAppPath()}/out/preload/index.js`
      const other = new BrowserWindow({ show: false, webPreferences: {
        preload, sandbox: true, nodeIntegration: false, contextIsolation: true, webSecurity: true
      } })
      try {
        await other.loadURL(owned.webContents.getURL())
        const result: unknown = await other.webContents.executeJavaScript('Promise.all([window.offlineApi.app.getBootstrap(), window.offlineApi.workspaces.create("Unauthorized")])')
        return result
      } finally { other.destroy() }
    })
    expect(rejected).toEqual([
      { ok: false, error: { code: 'NOT_FOUND', message: 'Operation unavailable', retryable: false } },
      { ok: false, error: { code: 'NOT_FOUND', message: 'Operation unavailable', retryable: false } }
    ])
    expect(await page.evaluate(() => window.offlineApi.workspaces.list())).toEqual({ ok: true, data: { workspaces: [], selectedWorkspaceId: null } })
    const executable = await application.evaluate(({ app }) => app.getPath('exe'))
    const child = spawn(executable, ['.'], { env, stdio: 'ignore' })
    try {
      const exit = await new Promise<number | null>((resolve, reject) => {
        const timer = setTimeout(() => { child.kill(); reject(new Error('Second instance did not exit')) }, 5_000)
        child.once('error', error => { clearTimeout(timer); reject(error) })
        child.once('exit', code => { clearTimeout(timer); resolve(code) })
      })
      expect(exit).toBe(0)
    } finally { if (child.exitCode === null) child.kill() }
    expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
    const original = page.url()
    await application.evaluate(({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0]?.webContents
      if (!contents) throw new Error('Missing contents')
      contents.once('will-frame-navigate', () => Reflect.set(globalThis, 'navigationDeniedObserved', true))
    })
    await page.evaluate(() => {
      const link = document.createElement('a')
      link.href = 'https://untrusted.invalid/'
      document.body.append(link)
      link.click()
      link.remove()
    })
    await expect.poll(() => application.evaluate(() => Reflect.get(globalThis, 'navigationDeniedObserved'))).toBe(true)
    expect(page.url()).toBe(original)
    expect((await page.evaluate(() => window.offlineApi.app.getBootstrap())).ok).toBe(true)
  } finally { await application.close(); rmSync(directory, { recursive: true, force: true }) }
})
