import { z } from 'zod'
import { domainErrorSchema, validationError, type DomainError, type Result } from '../../shared/results'

interface FrameIdentity { readonly url: string }
interface OwnedWindow {
  isDestroyed(): boolean
  readonly webContents: { readonly mainFrame: FrameIdentity }
}
interface SenderContext { readonly sender: object; readonly senderFrame: FrameIdentity | null }

export function createOwnedHandler<I extends z.ZodType, T extends z.ZodType>(
  getWindow: () => OwnedWindow | null,
  trustedUrl: string,
  inputSchema: I,
  outputSchema: T,
  operation: (input: z.infer<I>) => z.infer<T>,
  mapError?: (error: unknown) => DomainError
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
      return { ok: true, data: outputSchema.parse(operation(input.data)) }
    } catch (error) {
      if (mapError) {
        const mapped = domainErrorSchema.safeParse(mapError(error))
        if (mapped.success) return { ok: false, error: mapped.data }
      }
      return { ok: false, error: { code: 'VALIDATION', message: 'Operation unavailable', retryable: false } }
    }
  }
}
