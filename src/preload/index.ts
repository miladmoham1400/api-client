import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, bootstrapResultSchema, type DesktopApi } from '../shared/desktop-api'

import { WORKSPACE_CHANNELS, workspaceInputs, workspaceResultSchema } from '../shared/workspaces'
import { z } from 'zod'
import { validationError } from '../shared/results'

// Private allowlisted invocation helper; never exposed to renderer.
async function workspaceCall<I extends z.ZodType<unknown[]>>(channel: (typeof WORKSPACE_CHANNELS)[keyof typeof WORKSPACE_CHANNELS], schema: I, args: unknown[]): ReturnType<DesktopApi['workspaces']['list']> {
  const input = schema.safeParse(args)
  if (!input.success) return { ok: false, error: validationError(input.error) }
  try {
    return workspaceResultSchema.parse(await ipcRenderer.invoke(channel, ...input.data))
  } catch {
    return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } }
  }
}

const api: DesktopApi = Object.freeze({
  workspaces: Object.freeze({
    list: () => workspaceCall(WORKSPACE_CHANNELS.list, workspaceInputs.list, []),
    create: (name: string) => workspaceCall(WORKSPACE_CHANNELS.create, workspaceInputs.create, [name]),
    rename: (id: string, name: string) => workspaceCall(WORKSPACE_CHANNELS.rename, workspaceInputs.rename, [id, name]),
    delete: (id: string) => workspaceCall(WORKSPACE_CHANNELS.delete, workspaceInputs.delete, [id]),
    select: (id: string | null) => workspaceCall(WORKSPACE_CHANNELS.select, workspaceInputs.select, [id])
  }),
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
