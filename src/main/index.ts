import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { CLOSE_CHANNELS, closeDecisionInput } from '../shared/close'
import { UploadService } from './files/uploads'
import { Repositories } from './db/repositories'
import { createFileHandlers } from './ipc/files'
import { FILE_CHANNELS } from '../shared/files'
import { app, BrowserWindow, ipcMain, safeStorage, dialog } from 'electron'
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
import { VariableService } from './services/variables'
import { createVariableHandlers } from './ipc/variables'
import { ENVIRONMENT_CHANNELS, VARIABLE_CHANNELS } from '../shared/variable-management'
import { SecretStore } from './security/secrets'
import { WORKSPACE_CHANNELS } from '../shared/workspaces'
import { MaterializationService } from './services/materialization'
import { ExecutionService } from './services/execution'
import { createExecutionHandlers } from './ipc/execution'
import { EXECUTION_CHANNELS } from '../shared/execution'

let uploadService: UploadService | null = null
let ownedWindow: BrowserWindow | null = null
let database: Database.Database | null = null
let secretStore: SecretStore | null = null
let executionService: ExecutionService | null = null
app.on('will-quit', () => {
  uploadService?.clear(); uploadService = null
  executionService?.abort(); executionService = null
  secretStore?.clear(); secretStore = null
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
      secretStore = new SecretStore(database, safeStorage, process.platform)
      secretStore.capability()
      bootstrap = { stage: 'foundation', capabilities: { database: true, requests: true }, database: { status: 'ready' } }
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
    let closeReady = false, approvedClose = false
    let pendingClose: string | null = null
    window.on('close', event => {
      if (!closeReady || approvedClose) { approvedClose = false; return }
      event.preventDefault()
      if (pendingClose) return
      pendingClose = randomUUID()
      contents.send(CLOSE_CHANNELS.requested, { token: pendingClose })
    })
    ipcMain.handle(CLOSE_CHANNELS.decision, createOwnedHandler(() => ownedWindow, trustedUrl, closeDecisionInput, z.null(), ([token, decision]) => {
      if (token !== pendingClose) throw new Error('No matching close request')
      pendingClose = null
      if (decision === 'close') {
        approvedClose = true
        setImmediate(() => { if (!window.isDestroyed()) window.close() })
      }
      return null
    }))
    uploadService = database ? new UploadService(id => { if (!database) throw new Error('Unavailable'); new Repositories(database).getWorkspace(id) }) : null
    executionService = database && secretStore ? new ExecutionService(new MaterializationService(database, secretStore, uploadService ?? undefined), completion => {
      if (ownedWindow !== window || window.isDestroyed() || contents.isDestroyed()) return
      try { contents.send(EXECUTION_CHANNELS.completed, completion) }
      catch { /* A disappearing renderer cannot undo completion or committed deletion. */ }
    }) : null
    const fileHandlers = createFileHandlers(() => ownedWindow, trustedUrl, () => uploadService, async () => {
      const result = await dialog.showOpenDialog(window, { title: 'Select upload file', properties: ['openFile', 'dontAddToRecent'] })
      return result.canceled ? null : result.filePaths[0] ?? null
    })
    ipcMain.handle(FILE_CHANNELS.chooseUpload, fileHandlers.chooseUpload)
    ipcMain.handle(FILE_CHANNELS.releaseUpload, fileHandlers.releaseUpload)
    const executionHandlers = createExecutionHandlers(() => ownedWindow, trustedUrl, () => executionService)
    ipcMain.handle(EXECUTION_CHANNELS.send, executionHandlers.send)
    ipcMain.handle(EXECUTION_CHANNELS.cancel, executionHandlers.cancel)
    ipcMain.on(EXECUTION_CHANNELS.start, executionHandlers.start)
    // Captured requests must not outlive their renderer, including reload/crash.
    contents.on('render-process-gone', () => { closeReady = false; pendingClose = null; executionService?.abort(); uploadService?.clear() })
    contents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
      if (mainFrame && !inPlace) { closeReady = false; pendingClose = null; approvedClose = false; executionService?.abort(); uploadService?.clear() }
    })
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
      () => { closeReady = true; return bootstrap }
    ))
    const variableService = database && secretStore ? new VariableService(database, secretStore) : null
    const variableHandlers = createVariableHandlers(() => ownedWindow, trustedUrl, () => variableService)
    for (const method of ['list', 'create', 'rename', 'delete', 'select'] as const) ipcMain.handle(ENVIRONMENT_CHANNELS[method], variableHandlers.environments[method])
    for (const method of ['list', 'upsert', 'delete', 'reveal'] as const) ipcMain.handle(VARIABLE_CHANNELS[method], variableHandlers.variables[method])
    const workspaceService = database ? new WorkspaceService(database, secretStore ?? undefined, id => { uploadService?.forgetWorkspace(id) }, id => { executionService?.abortWorkspace(id) }) : null
    const workspaceHandlers = createWorkspaceHandlers(() => ownedWindow, trustedUrl, () => workspaceService)
    for (const method of ['list', 'create', 'rename', 'delete', 'select'] as const) {
      ipcMain.handle(WORKSPACE_CHANNELS[method], workspaceHandlers[method])
    }
    const collectionService = database ? new CollectionService(database) : null
    const collectionHandlers = createCollectionHandlers(() => ownedWindow, trustedUrl, () => collectionService)
    for (const method of ['list', 'create', 'rename', 'delete', 'move'] as const) ipcMain.handle(COLLECTION_CHANNELS[method], collectionHandlers[method])
    const requestService = database ? new RequestService(database, secretStore ?? undefined, secretStore ?? undefined) : null
    const requestHandlers = createRequestHandlers(() => ownedWindow, trustedUrl, () => requestService)
    for (const method of ['newRow', 'list', 'get', 'create', 'save', 'duplicate', 'delete'] as const) ipcMain.handle(REQUEST_CHANNELS[method], requestHandlers[method])
    window.on('closed', () => {
      ipcMain.removeHandler(CLOSE_CHANNELS.decision)
      uploadService?.clear(); uploadService = null
      for (const channel of Object.values(FILE_CHANNELS)) ipcMain.removeHandler(channel)
      ownedWindow = null
      executionService?.abort(); executionService = null
      ipcMain.removeHandler(EXECUTION_CHANNELS.send)
      ipcMain.removeHandler(EXECUTION_CHANNELS.cancel)
      ipcMain.removeListener(EXECUTION_CHANNELS.start, executionHandlers.start)
      for (const channel of [...Object.values(ENVIRONMENT_CHANNELS), ...Object.values(VARIABLE_CHANNELS)]) ipcMain.removeHandler(channel)
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
