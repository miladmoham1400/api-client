import { validateHeaderName, validateHeaderValue } from 'node:http'
import { runtimeRequestConfigSchema, type RuntimeRequestConfig } from '../../shared/request-config'
import { resolveRequestTemplates, type EffectiveVariables } from '../../shared/variables'
import { LIMITS, limitedText, mediaTypeSchema, type FieldPath } from '../../shared/primitives'
import { validationError, type Result, type ErrorCode } from '../../shared/results'

export interface MaterializedRequest {
  readonly method: RuntimeRequestConfig['method']; readonly url: string
  readonly headers: readonly Readonly<{ name: string; value: string }>[]
  readonly bodyBytes: Buffer | null; readonly timeoutMs: number; readonly followRedirects: boolean
}
function fail(code: ErrorCode, field: FieldPath, message: string): Result<never> { return { ok: false, error: { code, field, message, retryable: false } } }
/** Main-only result includes resolved secrets. No sockets, IPC, persistence or logging. */
export function materialize(config: RuntimeRequestConfig, variables: EffectiveVariables): Result<MaterializedRequest> {
  const parsed = runtimeRequestConfigSchema.safeParse(config)
  if (!parsed.success) return { ok: false, error: validationError(parsed.error) }
  const source = parsed.data
  if (source.body.kind !== 'none' && ['GET', 'HEAD'].includes(source.method)) return fail('VALIDATION', 'body', 'GET and HEAD cannot have a body')
  if (source.body.kind === 'multipart' || source.body.kind === 'urlencoded') return fail('VALIDATION', 'body', 'Form serialization is not available yet')
  const resolved = resolveRequestTemplates(source, variables, { maxBytes: field => field === 'body.text' ? LIMITS.textBodyBytes : LIMITS.fieldCharacters * 4 })
  if (!resolved.ok) return resolved
  const c = resolved.data
  if (!limitedText().safeParse(c.urlTemplate).success) return fail('VALIDATION', 'urlTemplate', 'Resolved URL exceeds character limit')
  let url: URL
  try { url = new URL(c.urlTemplate) } catch { return fail('INVALID_URL', 'urlTemplate', 'Use an absolute HTTP or HTTPS URL') }
  if (!['http:', 'https:'].includes(url.protocol)) return fail('UNSUPPORTED_SCHEME', 'urlTemplate', 'Only HTTP and HTTPS are supported')
  if (!url.hostname || url.username || url.password || c.urlTemplate.includes('#') || /[\r\n]/.test(c.urlTemplate)) return fail('INVALID_URL', 'urlTemplate', 'URL must have a host and no credentials, fragment or line breaks')
  for (const [index, row] of c.queryRows.entries()) {
    const original = source.queryRows.flatMap((r, i) => r.enabled ? [i] : [])[index]
    if (!limitedText().safeParse(row.key).success) return fail('VALIDATION', `queryRows[${original}].key`, 'Resolved key exceeds character limit')
    if (!limitedText().safeParse(row.value).success) return fail('VALIDATION', `queryRows[${original}].value`, 'Resolved value exceeds character limit')
    url.searchParams.append(row.key, row.value)
  }
  const headers: { name: string; value: string }[] = [], singletons = new Set<string>()
  const originalIndexes = source.headerRows.flatMap((row, index) => row.enabled ? [index] : [])
  for (const [index, row] of c.headerRows.entries()) {
    const path = `headerRows[${originalIndexes[index]}]` as const
    if (!limitedText().safeParse(row.key).success || !limitedText().safeParse(row.value).success) return fail('VALIDATION', `${path}.value`, 'Resolved header exceeds character limit')
    try { validateHeaderName(row.key) } catch { return fail('INVALID_HEADER', `${path}.key`, 'Invalid header name') }
    try { validateHeaderValue(row.key, row.value) } catch { return fail('INVALID_HEADER', `${path}.value`, 'Invalid header value') }
    const name = row.key.toLowerCase()
    if (['host', 'content-length', 'transfer-encoding', 'connection', 'accept-encoding'].includes(name)) return fail('INVALID_HEADER', `${path}.key`, 'Header is managed by the HTTP engine')
    if (['authorization', 'content-type', 'host'].includes(name)) {
      if (singletons.has(name)) return fail('INVALID_HEADER', `${path}.key`, 'Duplicate singleton header')
      singletons.add(name)
    }
    headers.push({ name: row.key, value: row.value })
  }
  if (c.auth.mode !== 'none') {
    if (singletons.has('authorization')) return fail('AUTH_CONFLICT', 'auth', 'Remove the explicit Authorization header or select Auth None')
    let value: string
    if (c.auth.mode === 'bearer') value = `Bearer ${c.auth.tokenTemplate}`
    else {
      if (c.auth.usernameTemplate.includes(':')) return fail('VALIDATION', 'auth.usernameTemplate', 'Basic username cannot contain a colon')
      value = `Basic ${Buffer.from(`${c.auth.usernameTemplate}:${c.auth.passwordTemplate}`, 'utf8').toString('base64')}`
    }
    try { validateHeaderValue('Authorization', value) } catch { return fail('INVALID_HEADER', 'auth', 'Invalid authentication value') }
    headers.push({ name: 'Authorization', value })
  }
  let bytes: Buffer | null = null
  if (c.body.kind === 'json' || c.body.kind === 'raw') {
    bytes = Buffer.from(c.body.text, 'utf8')
    if (bytes.length > LIMITS.textBodyBytes) return fail('VALIDATION', 'body.text', 'Resolved text body exceeds 5 MiB')
    const explicit = headers.find(h => h.name.toLowerCase() === 'content-type')
    if (explicit) {
      if (!mediaTypeSchema.safeParse(explicit.value).success) return fail('CONTENT_TYPE_CONFLICT', 'headerRows', 'Invalid Content-Type')
      const type = explicit.value.split(';')[0]!.trim().toLowerCase()
      if (c.body.kind === 'json' && type !== 'application/json' && !type.endsWith('+json')) return fail('CONTENT_TYPE_CONFLICT', 'headerRows', 'JSON body requires a JSON Content-Type')
    } else headers.push({ name: 'Content-Type', value: c.body.kind === 'json' ? 'application/json' : c.body.kind === 'raw' ? c.body.mediaType : 'text/plain' })
    headers.push({ name: 'Content-Length', value: String(bytes.length) })
  }
  headers.push({ name: 'Accept-Encoding', value: 'gzip, deflate, br' })
  const snapshot: MaterializedRequest = Object.freeze({ method: c.method, url: url.href, headers: Object.freeze(headers.map(h => Object.freeze(h))), get bodyBytes() { return bytes === null ? null : Buffer.from(bytes) }, timeoutMs: c.timeoutMs, followRedirects: c.followRedirects })
  return { ok: true, data: snapshot }
}
