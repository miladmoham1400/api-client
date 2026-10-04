import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, bootstrapResultSchema, type DesktopApi } from '../shared/desktop-api'

const api: DesktopApi = Object.freeze({
  app: Object.freeze({
    getBootstrap: async (): ReturnType<DesktopApi['app']['getBootstrap']> => {
      try {
        return bootstrapResultSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.getBootstrap))
      } catch {
        return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } }
      }
    }
  })
})
if (process.isMainFrame) contextBridge.exposeInMainWorld('offlineApi', api)
