import { z } from 'zod'
import { validationError, type Result } from '../../shared/results'

interface FrameIdentity { readonly url: string }
interface OwnedWindow {
  isDestroyed(): boolean
  readonly webContents: { readonly mainFrame: FrameIdentity }
}
interface SenderContext { readonly sender: object; readonly senderFrame: FrameIdentity | null }

export function createOwnedHandler<T extends z.ZodType>(
  getWindow: () => OwnedWindow | null,
  trustedUrl: string,
  inputSchema: z.ZodType,
  outputSchema: T,
  operation: () => z.infer<T>
) {
  return (event: SenderContext, ...args: unknown[]): Result<z.infer<T>> => {
    const window = getWindow()
    if (!window || window.isDestroyed() || event.sender !== window.webContents ||
        !event.senderFrame || event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame.url !== trustedUrl) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Operation unavailable', retryable: false } }
    }
    const input = inputSchema.safeParse(args)
    if (!input.success) return { ok: false, error: validationError(input.error) }
    try {
      return { ok: true, data: outputSchema.parse(operation()) }
    } catch {
      return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } }
    }
  }
}
