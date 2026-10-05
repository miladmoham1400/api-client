import { FILE_CHANNELS, fileInputs, uploadResultSchema, releaseResultSchema, type FileApi } from '../shared/files'
import { validationError, type Result } from '../shared/results'
import { z } from 'zod'

export function createFileApi(invoke: (channel: string, ...args: unknown[]) => Promise<unknown>): FileApi {
  async function call<I extends z.ZodType<unknown[]>, O>(channel: string, input: I, output: z.ZodType<Result<O>>, args: unknown[]): Promise<Result<O>> {
    const parsed = input.safeParse(args)
    if (!parsed.success) return { ok: false, error: validationError(parsed.error, true) }
    try { return output.parse(await invoke(channel, ...parsed.data)) }
    catch { return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } } }
  }
  return Object.freeze({
    chooseUpload: (workspace: string) => call(FILE_CHANNELS.chooseUpload, fileInputs.chooseUpload, uploadResultSchema, [workspace]),
    releaseUpload: (workspace: string, id: string) => call(FILE_CHANNELS.releaseUpload, fileInputs.releaseUpload, releaseResultSchema, [workspace, id])
  })
}
