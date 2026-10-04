import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, bootstrapResultSchema, type DesktopApi } from '../shared/desktop-api'

import { WORKSPACE_CHANNELS, workspaceInputs, workspaceResultSchema } from '../shared/workspaces'
import { z } from 'zod'
import { COLLECTION_CHANNELS, collectionInputs, groupingResultSchema } from '../shared/collections'
import { REQUEST_CHANNELS, requestInputs, requestResultSchema, type RequestDraft } from '../shared/requests'
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

async function collectionCall<I extends z.ZodType<unknown[]>>(channel: (typeof COLLECTION_CHANNELS)[keyof typeof COLLECTION_CHANNELS], schema: I, args: unknown[]): ReturnType<DesktopApi['collections']['list']> {
  const input = schema.safeParse(args)
  if (!input.success) return { ok: false, error: validationError(input.error) }
  try { return groupingResultSchema.parse(await ipcRenderer.invoke(channel, ...input.data)) }
  catch { return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } } }
}

async function requestCall<I extends z.ZodType<unknown[]>>(channel: (typeof REQUEST_CHANNELS)[keyof typeof REQUEST_CHANNELS], schema: I, args: unknown[]): ReturnType<DesktopApi['requests']['list']> {
  const input = schema.safeParse(args)
  if (!input.success) return { ok: false, error: validationError(input.error) }
  try { return requestResultSchema.parse(await ipcRenderer.invoke(channel, ...input.data)) }
  catch { return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } } }
}

const api: DesktopApi = Object.freeze({
  collections: Object.freeze({
    list: (workspace: string) => collectionCall(COLLECTION_CHANNELS.list, collectionInputs.list, [workspace]),
    create: (workspace: string, name: string) => collectionCall(COLLECTION_CHANNELS.create, collectionInputs.create, [workspace, name]),
    rename: (workspace: string, id: string, name: string) => collectionCall(COLLECTION_CHANNELS.rename, collectionInputs.rename, [workspace, id, name]),
    delete: (workspace: string, id: string) => collectionCall(COLLECTION_CHANNELS.delete, collectionInputs.delete, [workspace, id])
  }),
  requests: Object.freeze({
    list: (workspace: string) => requestCall(REQUEST_CHANNELS.list, requestInputs.list, [workspace]),
    get: (workspace: string, id: string) => requestCall(REQUEST_CHANNELS.get, requestInputs.get, [workspace, id]),
    create: (workspace: string, input: z.infer<typeof requestInputs.create>[1]) => requestCall(REQUEST_CHANNELS.create, requestInputs.create, [workspace, input]),
    save: (workspace: string, id: string, input: RequestDraft) => requestCall(REQUEST_CHANNELS.save, requestInputs.save, [workspace, id, input]),
    duplicate: (workspace: string, id: string) => requestCall(REQUEST_CHANNELS.duplicate, requestInputs.duplicate, [workspace, id]),
    delete: (workspace: string, id: string) => requestCall(REQUEST_CHANNELS.delete, requestInputs.delete, [workspace, id]),
    move: (workspace: string, id: string, collection: string | null) => collectionCall(COLLECTION_CHANNELS.move, collectionInputs.move, [workspace, id, collection]) }),
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
