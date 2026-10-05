import { CLOSE_CHANNELS, closeRequestedSchema, closeDecisionInput, closeDecisionResult } from '../shared/close'
import { subscribeValidated } from './listeners'
import { createFileApi } from './files'
import { ENVIRONMENT_CHANNELS as EC, VARIABLE_CHANNELS as VC, environmentInputs as EI, variableInputs as VI, environmentResultSchema, variableResultSchema, revealResultSchema } from '../shared/variable-management'
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, bootstrapResultSchema, type DesktopApi } from '../shared/desktop-api'

import { WORKSPACE_CHANNELS, workspaceInputs, workspaceResultSchema } from '../shared/workspaces'
import { z } from 'zod'
import { COLLECTION_CHANNELS, collectionInputs, groupingResultSchema } from '../shared/collections'
import { REQUEST_CHANNELS, requestInputs, requestResultSchema, requestRowResultSchema, type RequestDraft } from '../shared/requests'
import { validationError } from '../shared/results'
import { EXECUTION_CHANNELS } from '../shared/execution'
import { createExecutionApi } from './execution'

// Private allowlisted invocation helper; never exposed to renderer.
async function workspaceCall<I extends z.ZodType<unknown[]>>(channel: (typeof WORKSPACE_CHANNELS)[keyof typeof WORKSPACE_CHANNELS], schema: I, args: unknown[]): ReturnType<DesktopApi['workspaces']['list']> {
  const input = schema.safeParse(args)
  if (!input.success) return { ok: false, error: validationError(input.error, true) }
  try {
    return workspaceResultSchema.parse(await ipcRenderer.invoke(channel, ...input.data))
  } catch {
    return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } }
  }
}

async function collectionCall<I extends z.ZodType<unknown[]>>(channel: (typeof COLLECTION_CHANNELS)[keyof typeof COLLECTION_CHANNELS], schema: I, args: unknown[]): ReturnType<DesktopApi['collections']['list']> {
  const input = schema.safeParse(args)
  if (!input.success) return { ok: false, error: validationError(input.error, true) }
  try { return groupingResultSchema.parse(await ipcRenderer.invoke(channel, ...input.data)) }
  catch { return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } } }
}

async function requestCall<I extends z.ZodType<unknown[]>>(channel: (typeof REQUEST_CHANNELS)[keyof typeof REQUEST_CHANNELS], schema: I, args: unknown[]): ReturnType<DesktopApi['requests']['list']> {
  const input = schema.safeParse(args)
  if (!input.success) return { ok: false, error: validationError(input.error, true) }
  try { return requestResultSchema.parse(await ipcRenderer.invoke(channel, ...input.data)) }
  catch { return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } } }
}

async function variableCall<I extends z.ZodType<unknown[]>, O extends z.ZodType>(channel: (typeof EC)[keyof typeof EC] | (typeof VC)[keyof typeof VC], schema: I, output: O, args: unknown[]) {
  const input = schema.safeParse(args)
  if (!input.success) return { ok: false as const, error: validationError(input.error, true) }
  try { return output.parse(await ipcRenderer.invoke(channel, ...input.data)) }
  catch { return { ok: false as const, error: { code: 'VALIDATION' as const, message: 'Operation unavailable', retryable: false } } }
}

const api: DesktopApi = Object.freeze({
  files: createFileApi((channel, ...args) => ipcRenderer.invoke(channel, ...args)),
  execution: createExecutionApi(
    args => ipcRenderer.invoke(EXECUTION_CHANNELS.send, ...args),
    id => ipcRenderer.send(EXECUTION_CHANNELS.start, id),
    listener => ipcRenderer.on(EXECUTION_CHANNELS.completed, listener),
    listener => ipcRenderer.removeListener(EXECUTION_CHANNELS.completed, listener),
    id => ipcRenderer.invoke(EXECUTION_CHANNELS.cancel, id)
  ),
  environments: Object.freeze({
    list: (w: string) => variableCall(EC.list, EI.list, environmentResultSchema, [w]),
    create: (w: string, n: string) => variableCall(EC.create, EI.create, environmentResultSchema, [w, n]),
    rename: (w: string, id: string, n: string) => variableCall(EC.rename, EI.rename, environmentResultSchema, [w, id, n]),
    delete: (w: string, id: string) => variableCall(EC.delete, EI.delete, environmentResultSchema, [w, id]),
    select: (w: string, id: string | null) => variableCall(EC.select, EI.select, environmentResultSchema, [w, id])
  }),
  variables: Object.freeze({
    list: (w: string, scope: string | null) => variableCall(VC.list, VI.list, variableResultSchema, [w, scope]),
    upsert: (w: string, scope: string | null, k: string, v: string, sensitive: boolean, id?: string | null) => variableCall(VC.upsert, VI.upsert, variableResultSchema, [w, scope, k, v, sensitive, id]),
    delete: (w: string, id: string) => variableCall(VC.delete, VI.delete, variableResultSchema, [w, id]),
    reveal: (w: string, id: string) => variableCall(VC.reveal, VI.reveal, revealResultSchema, [w, id])
  }),
  collections: Object.freeze({
    list: (workspace: string) => collectionCall(COLLECTION_CHANNELS.list, collectionInputs.list, [workspace]),
    create: (workspace: string, name: string) => collectionCall(COLLECTION_CHANNELS.create, collectionInputs.create, [workspace, name]),
    rename: (workspace: string, id: string, name: string) => collectionCall(COLLECTION_CHANNELS.rename, collectionInputs.rename, [workspace, id, name]),
    delete: (workspace: string, id: string) => collectionCall(COLLECTION_CHANNELS.delete, collectionInputs.delete, [workspace, id])
  }),
  requests: Object.freeze({
    newRow: async (workspace: string): ReturnType<DesktopApi['requests']['newRow']> => {
      const input = requestInputs.newRow.safeParse([workspace])
      if (!input.success) return { ok: false, error: validationError(input.error, true) }
      try { return requestRowResultSchema.parse(await ipcRenderer.invoke(REQUEST_CHANNELS.newRow, ...input.data)) }
      catch { return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } } }
    },
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
    onCloseRequested: (callback: Parameters<DesktopApi['app']['onCloseRequested']>[0]) => subscribeValidated(closeRequestedSchema, listener => { ipcRenderer.on(CLOSE_CHANNELS.requested, listener) }, listener => { ipcRenderer.removeListener(CLOSE_CHANNELS.requested, listener) }, callback),
    requestCloseDecision: async (token: string, decision: 'close' | 'cancel') => {
      const parsed = closeDecisionInput.safeParse([token, decision])
      if (!parsed.success) return { ok: false as const, error: validationError(parsed.error, true) }
      try { return closeDecisionResult.parse(await ipcRenderer.invoke(CLOSE_CHANNELS.decision, ...parsed.data)) }
      catch { return { ok: false as const, error: { code: 'VALIDATION' as const, message: 'Operation unavailable', retryable: false } } }
    },
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
