import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { bootstrapInputSchema, bootstrapSchema, IPC_CHANNELS } from '../shared/desktop-api'
import type Database from 'better-sqlite3'
import { openDatabase } from './db/database'
import type { Bootstrap } from '../shared/desktop-api'
import { createOwnedHandler } from './ipc/guard'
import { createWorkspaceHandlers } from './ipc/workspaces'
import { WorkspaceService } from './services/workspaces'
import { CollectionService } from './services/collections'
import { createCollectionHandlers } from './ipc/collections'
import { COLLECTION_CHANNELS } from '../shared/collections'
import { RequestService } from './services/requests'
import { createRequestHandlers } from './ipc/requests'
import { REQUEST_CHANNELS } from '../shared/requests'
import { WORKSPACE_CHANNELS } from '../shared/workspaces'

let ownedWindow: BrowserWindow | null = null
let database: Database.Database | null = null
app.on('will-quit', () => {
  if (database?.open) database.close()
  database = null
})
app.enableSandbox()
const hasLock = app.requestSingleInstanceLock()
if (!hasLock) app.quit()
else {
  app.on('second-instance', () => {
    if (!ownedWindow || ownedWindow.isDestroyed()) return
    if (ownedWindow.isMinimized()) ownedWindow.restore()
    ownedWindow.focus()
  })
  void app.whenReady().then(async () => {
    const databasePath = join(app.getPath('userData'), 'offline-api-client.sqlite')
    let bootstrap: Bootstrap
    try {
      database = openDatabase(databasePath)
      bootstrap = { stage: 'foundation', capabilities: { database: true, requests: false }, database: { status: 'ready' } }
    } catch {
      bootstrap = { stage: 'foundation', capabilities: { database: false, requests: false }, database: { status: 'unavailable', path: databasePath, message: 'The local database could not be opened. Your existing data has not been replaced. Close the app and check access to the database location.' } }
    }
    const localEntry = pathToFileURL(join(__dirname, '../renderer/index.html')).href
    const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
    // Only the configured loopback tooling URL can be a development entry.
    if (devUrl) {
      const url = new URL(devUrl)
      if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) {
        throw new Error('Invalid development entry')
      }
    }
    const trustedUrl = devUrl ? new URL(devUrl).href : localEntry
    const window = new BrowserWindow({
      width: 1280, height: 720, minWidth: 1000, minHeight: 700,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        partition: 'offline-api-client',
        nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false,
        contextIsolation: true, sandbox: true, webSecurity: true,
        webviewTag: false, allowRunningInsecureContent: false
      }
    })
    ownedWindow = window
    const contents = window.webContents
    contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    contents.session.setPermissionCheckHandler(() => false)
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', event => event.preventDefault())
    contents.on('will-frame-navigate', event => event.preventDefault())
    contents.on('will-redirect', event => event.preventDefault())
    contents.on('will-attach-webview', event => event.preventDefault())
    contents.session.on('will-download', event => event.preventDefault())
    // Defense beyond CSP: prevent renderer resource requests to arbitrary files or remote origins.
    const rendererRoot = pathToFileURL(join(__dirname, '../renderer/')).href
    contents.session.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url)
      const allowed = devUrl
        ? url.origin === new URL(trustedUrl).origin || ((url.protocol === 'ws:' || url.protocol === 'wss:') && url.host === new URL(trustedUrl).host)
        : url.protocol === 'file:' && url.href.startsWith(rendererRoot) && !url.search
      callback({ cancel: !allowed })
    })
    ipcMain.handle(IPC_CHANNELS.getBootstrap, createOwnedHandler(
      () => ownedWindow, trustedUrl, bootstrapInputSchema, bootstrapSchema,
      () => bootstrap
    ))
    const workspaceService = database ? new WorkspaceService(database) : null
    const workspaceHandlers = createWorkspaceHandlers(() => ownedWindow, trustedUrl, () => workspaceService)
    for (const method of ['list', 'create', 'rename', 'delete', 'select'] as const) {
      ipcMain.handle(WORKSPACE_CHANNELS[method], workspaceHandlers[method])
    }
    const collectionService = database ? new CollectionService(database) : null
    const collectionHandlers = createCollectionHandlers(() => ownedWindow, trustedUrl, () => collectionService)
    for (const method of ['list', 'create', 'rename', 'delete', 'move'] as const) ipcMain.handle(COLLECTION_CHANNELS[method], collectionHandlers[method])
    const requestService = database ? new RequestService(database) : null
    const requestHandlers = createRequestHandlers(() => ownedWindow, trustedUrl, () => requestService)
    for (const method of ['list', 'get', 'create', 'save', 'duplicate', 'delete'] as const) ipcMain.handle(REQUEST_CHANNELS[method], requestHandlers[method])
    window.on('closed', () => {
      ownedWindow = null
      ipcMain.removeHandler(IPC_CHANNELS.getBootstrap)
      for (const channel of Object.values(REQUEST_CHANNELS)) ipcMain.removeHandler(channel)
      for (const channel of Object.values(COLLECTION_CHANNELS)) ipcMain.removeHandler(channel)
      for (const channel of Object.values(WORKSPACE_CHANNELS)) ipcMain.removeHandler(channel)
    })
    await window.loadURL(trustedUrl)
  }).catch(() => {
    // No raw startup exception or path is logged.
    app.quit()
  })
  app.on('window-all-closed', () => app.quit())
}
