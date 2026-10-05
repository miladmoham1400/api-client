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
    if (!input.success) return { ok: false, error: validationError(input.error, true) }
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

// Native dialogs yield control. Recheck the exact owner before returning their result.
export function createOwnedAsyncHandler<I extends z.ZodType, T extends z.ZodType>(
  getWindow: () => OwnedWindow | null, trustedUrl: string, inputSchema: I, outputSchema: T,
  operation: (input: z.infer<I>, authorized: () => boolean) => Promise<z.infer<T>>, mapError: (error: unknown) => DomainError
) {
  return async (event: SenderContext, ...args: unknown[]): Promise<Result<z.infer<T>>> => {
    const owner = getWindow()
    const authorized = () => owner !== null && getWindow() === owner && !owner.isDestroyed() &&
      event.sender === owner.webContents && event.senderFrame !== null &&
      event.senderFrame === owner.webContents.mainFrame && event.senderFrame.url === trustedUrl
    const unavailable: Result<z.infer<T>> = { ok: false, error: { code: 'NOT_FOUND', message: 'Operation unavailable', retryable: false } }
    if (!authorized()) return unavailable
    const input = inputSchema.safeParse(args)
    if (!input.success) return { ok: false, error: validationError(input.error, true) }
    try {
      const data = await operation(input.data, authorized)
      if (!authorized()) return unavailable
      return { ok: true, data: outputSchema.parse(data) }
    } catch (error) {
      if (!authorized()) return unavailable
      const mapped = domainErrorSchema.safeParse(mapError(error))
      return mapped.success ? { ok: false, error: mapped.data } : unavailable
    }
  }
}
