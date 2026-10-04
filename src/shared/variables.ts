import { variableKeySchema, type FieldPath } from './primitives'
import type { RuntimeRequestConfig, TextRow } from './request-config'
import type { DomainError, ErrorCode, Result } from './results'

/** Main supplies captured values after secret lookup. null means unavailable, not empty. */
export interface ResolutionVariable { workspaceId: string; environmentId: string | null; key: string; value: string | null }
export type EffectiveVariables = ReadonlyMap<string, string | null>
function failure(code: ErrorCode, message: string, field: FieldPath): { ok: false; error: DomainError } {
  return { ok: false, error: { code, message, field, retryable: false } }
}
export function mergeVariables(workspaceId: string, environmentId: string | null, variables: readonly ResolutionVariable[]): Result<EffectiveVariables> {
  const workspace = new Map<string, string | null>(), environment = new Map<string, string | null>()
  for (const variable of variables) {
    if (variable.workspaceId !== workspaceId || (variable.environmentId !== null && variable.environmentId !== environmentId)) continue
    if (!variableKeySchema.safeParse(variable.key).success) return failure('VALIDATION', 'Invalid variable key', 'variables')
    const scope = variable.environmentId === null ? workspace : environment
    if (scope.has(variable.key)) return failure('VALIDATION', `Duplicate variable key: ${variable.key}`, 'variables')
    scope.set(variable.key, variable.value)
  }
  return { ok: true, data: new Map([...workspace, ...environment]) }
}
export function interpolate(template: string, variables: EffectiveVariables, field: FieldPath): Result<string> {
  let error: DomainError | undefined
  const text = template.replace(/\{\{([\s\S]*?)\}\}/g, (placeholder: string, inner: string) => {
    const key = inner.trim()
    if (!variableKeySchema.safeParse(key).success) { error ??= failure('VALIDATION', 'Invalid placeholder key', field).error; return placeholder }
    if (!variables.has(key)) { error ??= failure('VARIABLE_MISSING', `Missing variable: ${key}`, field).error; return placeholder }
    const value = variables.get(key)
    if (value === null || value === undefined) { error ??= failure('SECRET_UNAVAILABLE', `Variable value unavailable: ${key}`, field).error; return placeholder }
    return value
  })
  return error ? { ok: false, error } : { ok: true, data: text }
}
class ResolutionFailure { constructor(readonly error: DomainError) {} }
export interface ResolutionValidationHooks {
  url?: (text: string) => boolean
  header?: (key: string, value: string) => boolean
  json?: (text: string) => boolean
}
/** Pure only: call from main on a captured snapshot. Contains resolved values; never log/expose it. */
export function resolveRequestTemplates(config: RuntimeRequestConfig, variables: EffectiveVariables, hooks: ResolutionValidationHooks = {}): Result<RuntimeRequestConfig> {
  // Local failures terminate resolution without exposing an intermediate sensitive snapshot.
  const text = (value: string, field: FieldPath): string => {
    const result = interpolate(value, variables, field)
    if (!result.ok) throw new ResolutionFailure(result.error)
    return result.data
  }
  const validate = (check: () => boolean, code: ErrorCode, message: string, field: FieldPath) => {
    let valid = false
    try { valid = check() } catch { /* Validator details may contain resolved values. */ }
    if (!valid) throw new ResolutionFailure(failure(code, message, field).error)
  }
  const rows = (source: readonly TextRow[], group: 'queryRows' | 'headerRows' | 'body.rows'): TextRow[] => source.flatMap((row, index) => {
    if (!row.enabled) return []
    const key = text(row.key, `${group}[${index}].key`), value = text(row.value, `${group}[${index}].value`)
    if (group === 'headerRows' && hooks.header) validate(() => hooks.header!(key, value), 'INVALID_HEADER', 'Invalid resolved header', `${group}[${index}].value`)
    return [{ ...row, key, value }]
  })
  try {
    const urlTemplate = text(config.urlTemplate, 'urlTemplate')
    if (hooks.url) validate(() => hooks.url!(urlTemplate), 'INVALID_URL', 'Invalid resolved URL', 'urlTemplate')
    const queryRows = rows(config.queryRows, 'queryRows'), headerRows = rows(config.headerRows, 'headerRows')
    let body = { ...config.body }
    if (body.kind === 'json' || body.kind === 'raw') {
      body = { ...body, text: text(body.text, 'body.text') }
      if (body.kind === 'json') {
        const source = body.text
        validate(() => { JSON.parse(source); return hooks.json ? hooks.json(source) : true }, 'VALIDATION', 'Invalid resolved JSON', 'body.text')
      }
    } else if (body.kind === 'urlencoded') body = { ...body, rows: rows(body.rows, 'body.rows') }
    else if (body.kind === 'multipart') body = { ...body, rows: body.rows.flatMap((row, index) => {
      if (!row.enabled) return []
      const key = text(row.key, `body.rows[${index}].key`)
      return [row.kind === 'text' ? { ...row, key, value: text(row.value, `body.rows[${index}].value`) } : { ...row, key }]
    }) }
    let auth = { ...config.auth }
    if (auth.mode === 'bearer') auth = { ...auth, tokenTemplate: text(auth.tokenTemplate, 'auth.tokenTemplate') }
    else if (auth.mode === 'basic') auth = { ...auth, usernameTemplate: text(auth.usernameTemplate, 'auth.usernameTemplate'), passwordTemplate: text(auth.passwordTemplate, 'auth.passwordTemplate') }
    return { ok: true, data: { ...config, urlTemplate, queryRows, headerRows, body, auth } }
  } catch (error) {
    // Unexpected failures and hook details never become diagnostics.
    return error instanceof ResolutionFailure ? { ok: false, error: error.error } : failure('VALIDATION', 'Invalid resolution snapshot', 'variables')
  }
}
