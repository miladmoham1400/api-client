export const JSON_HIGHLIGHT_LIMIT = 64 * 1024
export const JSON_TOKEN_LIMIT = 4096
export const RESPONSE_HIGHLIGHT_LIMIT = 1024 * 1024
export const RESPONSE_TOKEN_LIMIT = 32768
export type JsonToken = { text: string; kind: 'plain' | 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation' }
export type JsonHighlight = { tokens: JsonToken[]; limited: boolean }

// Lexical presentation only: never normalize whitespace or numeric spelling.
// Bound scanning and DOM size, retaining a colored prefix when a response is large.
function tokenize(source: string, characterLimit: number, tokenLimit: number): JsonHighlight {
  const input = source.slice(0, characterLimit)
  const pattern = /"(?:[^"\\]|\\[\s\S])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}[\],:]/g
  const tokens: JsonToken[] = []
  const colon = /\s*:/y
  let offset = 0
  for (const match of input.matchAll(pattern)) {
    const start = match.index, value = match[0]
    // Reserve a final plain token for the full remaining source.
    if (tokens.length + (start > offset ? 2 : 1) >= tokenLimit) {
      tokens.push({ text: source.slice(offset), kind: 'plain' })
      return { tokens, limited: true }
    }
    if (start > offset) tokens.push({ text: source.slice(offset, start), kind: 'plain' })
    colon.lastIndex = start + value.length
    const kind: JsonToken['kind'] = value.startsWith('"') ? (colon.test(input) ? 'key' : 'string')
      : value === 'null' ? 'null' : value === 'true' || value === 'false' ? 'boolean' : /^-?\d/.test(value) ? 'number' : 'punctuation'
    tokens.push({ text: value, kind })
    offset = start + value.length
  }
  if (offset < source.length) tokens.push({ text: source.slice(offset), kind: 'plain' })
  return { tokens, limited: source.length > characterLimit }
}

export function jsonTokens(source: string): JsonToken[] {
  if (source.length > JSON_HIGHLIGHT_LIMIT) return [{ text: source, kind: 'plain' }]
  const result = tokenize(source, JSON_HIGHLIGHT_LIMIT, JSON_TOKEN_LIMIT)
  return result.limited ? [{ text: source, kind: 'plain' }] : result.tokens
}

export function responseJsonTokens(source: string): JsonHighlight {
  return tokenize(source, RESPONSE_HIGHLIGHT_LIMIT, RESPONSE_TOKEN_LIMIT)
}
