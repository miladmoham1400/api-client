export const PRETTY_INPUT_LIMIT = 64 * 1024
export type PrettyResult = { ok: true; text: string } | { ok: false; message: string }

/** Opt-in, bounded JSON formatting. Raw text is never replaced or mutated. */
export function prettyJson(raw: string): PrettyResult {
  if (raw.length > PRETTY_INPUT_LIMIT) return { ok: false, message: 'Pretty is limited to 64 Ki characters. Use Raw for this body.' }
  try {
    const value: unknown = JSON.parse(raw)
    const text = JSON.stringify(value, null, 2)
    if (text.length > 1024 * 1024) return { ok: false, message: 'Pretty output is too large. Use Raw for this body.' }
    return { ok: true, text }
  } catch { return { ok: false, message: 'Pretty is unavailable for invalid or deeply nested JSON. Raw remains available.' } }
}
