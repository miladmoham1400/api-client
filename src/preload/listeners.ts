import type { z } from 'zod'

// Internal helper only: no channel selector or Electron event is exposed to the renderer.
export function subscribeValidated<T>(
  schema: z.ZodType<T>,
  add: (listener: (event: unknown, payload: unknown) => void) => void,
  remove: (listener: (event: unknown, payload: unknown) => void) => void,
  callback: (payload: T) => void
): () => void {
  let active = true
  const listener = (_event: unknown, payload: unknown): void => {
    if (!active) return
    const result = schema.safeParse(payload)
    if (result.success) callback(result.data)
  }
  add(listener)
  return () => {
    if (!active) return
    active = false
    remove(listener)
  }
}
