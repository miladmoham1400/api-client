import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  LIMITS, createDefaultRequestConfig, runtimeRequestConfigSchema, storedRequestConfigSchema,
  exportRequestConfigSchema, nameSchema, timeoutSchema, textRowSchema, runtimeBodySchema,
  runtimeAuthSchema, storedAuthSchema, workspaceExportSchema, variableScopeEntriesSchema,
  storedVariableSchema, variableListItemSchema, uuidSchema, timestampSchema,
  formatFieldPath, rowFieldPath, resultSchema, validationError, httpResponseSchema,
  executionCompletedSchema, uploadCapabilitySchema, utf8ByteLength
} from '../../src/shared'

const id = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`
const row = (value: number, enabled = true) => ({ id: id(value), key: 'same', value: `${value}`, enabled })
const config = () => createDefaultRequestConfig()
const stamp = '2026-10-04T00:00:00.000Z'
const variable = (value: number) => ({
  id: id(value), workspaceId: id(1), environmentId: null, key: `key_${value}`,
  createdAt: stamp, updatedAt: stamp, isSensitive: false as const, value: ''
})
const transfer = () => ({
  format: 'offline-api-client-workspace' as const, version: 1, exportedAt: stamp,
  workspace: {
    id: id(1), name: 'Local', collections: [{ id: id(2), name: 'Group', sortOrder: 0 }],
    environments: [{ id: id(3), name: 'Environment' }],
    variables: [{ id: id(4), environmentId: null as string | null, key: 'base_url', isSensitive: false, value: '', requiresValue: false }],
    requests: [{ id: id(5), collectionId: id(2), name: 'Example', config: config() }]
  }
})

describe('bounded primitive contracts', () => {
  it('trims names and counts Unicode characters without splitting astral text', () => {
    expect(nameSchema.parse('  Persian فارسی  ')).toBe('Persian فارسی')
    expect(nameSchema.parse('😀'.repeat(100))).toHaveLength(200)
    for (const name of ['', '  ', '😀'.repeat(101), 42, null]) expect(nameSchema.safeParse(name).success).toBe(false)
  })
  it.each([100, 30_000, 300_000])('accepts timeout %s', value => {
    expect(timeoutSchema.parse(value)).toBe(value)
  })
  it.each([99, 300_001, 0, -1, 1.5, '30000', Infinity, NaN, null])('rejects timeout %s', value => {
    expect(timeoutSchema.safeParse(value).success).toBe(false)
  })
  it('normalizes valid UUIDs and requires UTC timestamps', () => {
    expect(uuidSchema.parse(id(0xabc).toUpperCase())).toBe(id(0xabc))
    expect(uuidSchema.safeParse('some-id').success).toBe(false)
    expect(timestampSchema.safeParse(stamp).success).toBe(true)
    expect(timestampSchema.safeParse('2026-10-04T00:00:00+03:30').success).toBe(false)
  })
  it('uses UTF-8 byte limits, not UTF-16 string lengths', () => {
    expect(utf8ByteLength('فارسی😀')).toBe(14)
    expect(runtimeBodySchema.safeParse({ kind: 'raw', text: 'a'.repeat(LIMITS.textBodyBytes), mediaType: 'text/plain' }).success).toBe(true)
    expect(runtimeBodySchema.safeParse({ kind: 'json', text: 'a'.repeat(LIMITS.textBodyBytes + 1) }).success).toBe(false)
    expect(runtimeBodySchema.safeParse({ kind: 'json', text: '😀'.repeat(Math.floor(LIMITS.textBodyBytes / 4) + 1) }).success).toBe(false)
  })
})

describe('request variants and row contracts', () => {
  it('creates fresh independent product defaults', () => {
    const first = config()
    first.queryRows.push(row(1))
    expect(config().queryRows).toEqual([])
    expect(runtimeRequestConfigSchema.parse(config())).toEqual({
      configVersion: 1, method: 'GET', urlTemplate: '', queryRows: [], headerRows: [],
      timeoutMs: 30_000, followRedirects: false, body: { kind: 'none' }, auth: { mode: 'none' }
    })
  })
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])('accepts method %s', method => {
    expect(runtimeRequestConfigSchema.safeParse({ ...config(), method }).success).toBe(true)
  })
  it.each([
    { kind: 'none' },
    { kind: 'json', text: '{"key":"{{value}}"}' },
    { kind: 'raw', text: '', mediaType: 'text/plain; charset=utf-8' },
    { kind: 'urlencoded', rows: [row(1), row(2)] },
    { kind: 'multipart', rows: [
      { ...row(1), kind: 'text' },
      { id: id(2), key: 'upload', kind: 'file', enabled: true, fileId: id(3), fileName: 'فایل.txt', fileSize: 12 }
    ] }
  ])('validates body variant $kind', body => {
    expect(runtimeBodySchema.safeParse(body).success).toBe(true)
  })
  it.each([
    { mode: 'none' }, { mode: 'bearer', tokenTemplate: '{{token}}' },
    { mode: 'basic', usernameTemplate: '{{user}}', passwordTemplate: '' }
  ])('validates runtime auth $mode', auth => {
    expect(runtimeAuthSchema.safeParse(auth).success).toBe(true)
  })
  it('preserves row order, duplicate keys and empty values', () => {
    const rows = [row(2), { ...row(1), value: '' }, row(3, false)]
    const input = { ...config(), queryRows: rows, body: { kind: 'urlencoded', rows } }
    const parsed = runtimeRequestConfigSchema.parse(input)
    expect(parsed.queryRows).toEqual(rows)
    expect(parsed.body).toEqual(input.body)
  })
  it('retains disabled semantically invalid drafts without requiring capabilities or variables', () => {
    expect(runtimeRequestConfigSchema.safeParse({
      ...config(), headerRows: [{ ...row(1, false), key: 'bad\r\nheader', value: '{{missing}}' }],
      body: { kind: 'multipart', rows: [{ id: id(2), key: '', kind: 'file', enabled: false }] }
    }).success).toBe(true)
    expect(textRowSchema.safeParse({ ...row(1, false), value: 1 }).success).toBe(false)
    expect(textRowSchema.safeParse({ ...row(1, false), value: 'x'.repeat(10_001) }).success).toBe(false)
  })
  it('accepts exactly 200 rows per group and rejects 201 including disabled rows', () => {
    const rows = Array.from({ length: 200 }, (_, index) => row(index, false))
    const full = { ...config(), queryRows: rows, headerRows: rows, body: { kind: 'urlencoded', rows } }
    expect(runtimeRequestConfigSchema.safeParse(full).success).toBe(true)
    for (const field of ['queryRows', 'headerRows']) {
      expect(runtimeRequestConfigSchema.safeParse({ ...full, [field]: [...rows, row(201)] }).success).toBe(false)
    }
    expect(runtimeBodySchema.safeParse({ kind: 'urlencoded', rows: [...rows, row(201)] }).success).toBe(false)
    expect(runtimeBodySchema.safeParse({ kind: 'multipart', rows: [...rows, row(201)].map(item => ({ ...item, kind: 'text' })) }).success).toBe(false)
  })
  it('rejects repeated row IDs while allowing repeated keys', () => {
    expect(runtimeRequestConfigSchema.safeParse({ ...config(), queryRows: [row(1), row(1)] }).success).toBe(false)
  })
  it.each([
    { method: 'TRACE' }, { configVersion: 2 }, { followRedirects: 'false' },
    { urlTemplate: 'x'.repeat(10_001) }, { queryRows: {} }, { headerRows: [{ ...row(1), enabled: 1 }] },
    { body: { kind: 'raw', text: '', mediaType: 'text/plain\r\nInjected: yes' } },
    { body: { kind: 'none', text: '' } }, { body: { kind: 'graphql', text: '' } },
    { body: { kind: 'json', text: 42 } }, { auth: { mode: 'oauth' } },
    { auth: { mode: 'basic', usernameTemplate: '', passwordTemplate: 42 } }
  ])('rejects invalid config %#', patch => {
    expect(runtimeRequestConfigSchema.safeParse({ ...config(), ...patch }).success).toBe(false)
  })
  it.each(['script', 'scripts', 'proxy', 'websocket', 'response', 'ciphertext'])('rejects unknown config field %s', field => {
    expect(runtimeRequestConfigSchema.safeParse({ ...config(), [field]: '' }).success).toBe(false)
  })
  it('bounds row keys and values including Unicode at 10,000 characters', () => {
    expect(textRowSchema.safeParse({ ...row(1), key: 'x'.repeat(10_000), value: '😀'.repeat(10_000) }).success).toBe(true)
    expect(textRowSchema.safeParse({ ...row(1), key: 'x'.repeat(10_001) }).success).toBe(false)
    expect(variableListItemSchema.safeParse({ ...variable(1), value: 'x'.repeat(10_001) }).success).toBe(false)
  })
  it('rejects malformed or unknown fields even on disabled rows', () => {
    expect(textRowSchema.safeParse({ ...row(1, false), script: '' }).success).toBe(false)
  })
})

describe('runtime, storage and export isolation', () => {
  it('allows credential templates or secret references in storage, never literals', () => {
    expect(storedAuthSchema.safeParse({ mode: 'basic', username: { kind: 'template', template: '{{ user }}' }, password: { kind: 'secret', secretId: id(1) } }).success).toBe(true)
    expect(storedAuthSchema.safeParse({ mode: 'bearer', token: { kind: 'template', template: 'literal-{{token}}' } }).success).toBe(false)
    expect(storedRequestConfigSchema.safeParse({ ...config(), auth: { mode: 'bearer', tokenTemplate: '{{token}}' } }).success).toBe(false)
    expect(runtimeRequestConfigSchema.safeParse({ ...config(), auth: { mode: 'bearer', token: { kind: 'secret', secretId: id(1) } } }).success).toBe(false)
  })
  it('excludes capabilities from persisted bodies and requires explicit export reselection', () => {
    const file = { id: id(1), key: 'file', kind: 'file', enabled: true, fileName: 'file.txt', fileSize: 1 }
    expect(storedRequestConfigSchema.safeParse({ ...config(), body: { kind: 'multipart', rows: [file] } }).success).toBe(true)
    expect(storedRequestConfigSchema.safeParse({ ...config(), body: { kind: 'multipart', rows: [{ ...file, fileId: id(2) }] } }).success).toBe(false)
    expect(exportRequestConfigSchema.safeParse({ ...config(), body: { kind: 'multipart', rows: [file] } }).success).toBe(false)
    expect(exportRequestConfigSchema.safeParse({ ...config(), body: { kind: 'multipart', rows: [{ ...file, requiresSelection: true }] } }).success).toBe(true)
    for (const schema of [runtimeRequestConfigSchema, storedRequestConfigSchema, exportRequestConfigSchema]) {
      const validFile = schema === exportRequestConfigSchema ? { ...file, requiresSelection: true } : file
      expect(schema.safeParse({ ...config(), body: { kind: 'multipart', rows: [{ ...validFile, path: '/synthetic/file.txt' }] } }).success).toBe(false)
    }
  })
  it('exports only placeholder credentials or marked omissions', () => {
    expect(exportRequestConfigSchema.safeParse({ ...config(), auth: { mode: 'bearer', tokenTemplate: '{{ token }}', requiresCredentials: false } }).success).toBe(true)
    expect(exportRequestConfigSchema.safeParse({ ...config(), auth: { mode: 'basic', usernameTemplate: '', passwordTemplate: '', requiresCredentials: true } }).success).toBe(true)
    expect(exportRequestConfigSchema.safeParse({ ...config(), auth: { mode: 'bearer', tokenTemplate: 'synthetic-literal', requiresCredentials: true } }).success).toBe(false)
    expect(exportRequestConfigSchema.safeParse({ ...config(), auth: { mode: 'bearer', tokenTemplate: '{{token}}' } }).success).toBe(false)
  })
  it.each(['Authorization', 'PROXY-AUTHORIZATION', 'cookie'])('requires empty disabled exported %s headers', key => {
    expect(exportRequestConfigSchema.safeParse({ ...config(), headerRows: [{ ...row(1, false), key, value: '' }] }).success).toBe(true)
    expect(exportRequestConfigSchema.safeParse({ ...config(), headerRows: [{ ...row(1, false), key }] }).success).toBe(false)
    expect(exportRequestConfigSchema.safeParse({ ...config(), headerRows: [{ ...row(1), key, value: '' }] }).success).toBe(false)
  })
  it('keeps sensitive variable storage references and masked list separate', () => {
    const common = variable(1)
    const identity = { id: common.id, workspaceId: common.workspaceId, environmentId: common.environmentId, key: common.key, createdAt: common.createdAt, updatedAt: common.updatedAt }
    expect(storedVariableSchema.safeParse({ ...identity, isSensitive: true, plainValue: null, secretId: id(2) }).success).toBe(true)
    expect(storedVariableSchema.safeParse({ ...identity, isSensitive: true, plainValue: 'synthetic', secretId: id(2) }).success).toBe(false)
    expect(variableListItemSchema.safeParse({ ...identity, isSensitive: true, hasValue: false, maskedDisplay: '••••••••', storageMode: 'session' }).success).toBe(true)
    expect(variableListItemSchema.safeParse({ ...common, isSensitive: true }).success).toBe(false)
  })
})

describe('transfer validation before future transactional import', () => {
  it('accepts v1 portable configuration with ordered duplicate rows', () => {
    const input = transfer()
    const request = input.workspace.requests[0]
    if (!request) throw new Error('Missing test request')
    request.config.queryRows = [row(10), row(11)]
    expect(workspaceExportSchema.parse(input)).toEqual(input)
  })
  it.each([{ version: 2 }, { format: 'postman' }, { exportedAt: 'not-date' }, { scripts: [] }])('rejects invalid envelope %#', patch => {
    expect(workspaceExportSchema.safeParse({ ...transfer(), ...patch }).success).toBe(false)
  })
  it('rejects duplicates, orphan references and duplicate scope keys', () => {
    const base = transfer()
    const workspace = base.workspace
    for (const patch of [
      { collections: [{ id: id(1), name: 'collision', sortOrder: 0 }] },
      { requests: [{ id: id(5), collectionId: id(90), name: 'orphan', config: config() }] },
      { variables: [{ id: id(4), environmentId: id(90), key: 'key', isSensitive: true, requiresValue: true }] },
      { variables: [workspace.variables[0], { ...workspace.variables[0], id: id(6) }] }
    ]) expect(workspaceExportSchema.safeParse({ ...base, workspace: { ...workspace, ...patch } }).success).toBe(false)
  })
  it('allows the same variable key across scopes and case-sensitive keys', () => {
    const base = transfer()
    base.workspace.variables.push(
      { id: id(6), environmentId: id(3), key: 'base_url', isSensitive: false, value: '', requiresValue: false },
      { id: id(7), environmentId: null, key: 'BASE_URL', isSensitive: false, value: '', requiresValue: false }
    )
    expect(workspaceExportSchema.safeParse(base).success).toBe(true)
  })
  it('enforces entity counts and per-scope variable counts', () => {
    const base = transfer()
    const collections = Array.from({ length: 101 }, (_, i) => ({ id: id(100 + i), name: 'Group', sortOrder: i }))
    const environments = Array.from({ length: 51 }, (_, i) => ({ id: id(300 + i), name: 'Env' }))
    const requests = Array.from({ length: 1001 }, (_, i) => ({ id: id(1000 + i), collectionId: null, name: 'Request', config: config() }))
    const variables = Array.from({ length: 101 }, (_, i) => ({ id: id(3000 + i), environmentId: null, key: `key_${i}`, isSensitive: false, value: '', requiresValue: false }))
    for (const patch of [{ collections }, { environments }, { requests }, { variables }]) {
      expect(workspaceExportSchema.safeParse({ ...base, workspace: { ...base.workspace, ...patch } }).success).toBe(false)
    }
  })
  it('rejects sensitive values, state, paths, capabilities and unknown script fields', () => {
    const base = transfer()
    const sensitive = { id: id(4), environmentId: null, key: 'token', isSensitive: true, requiresValue: true }
    expect(workspaceExportSchema.safeParse({ ...base, workspace: { ...base.workspace, variables: [sensitive] } }).success).toBe(true)
    for (const field of ['value', 'secretId', 'ciphertext', 'script']) {
      expect(workspaceExportSchema.safeParse({ ...base, workspace: { ...base.workspace, variables: [{ ...sensitive, [field]: 'synthetic' }] } }).success).toBe(false)
    }
    expect(workspaceExportSchema.safeParse({ ...base, workspace: { ...base.workspace, activeEnvironmentId: id(3) } }).success).toBe(false)
  })
})

describe('variable scope and sanitized shared results', () => {
  it('enforces 100 entries, key syntax, uniqueness and workspace/scope consistency', () => {
    const variables = Array.from({ length: 100 }, (_, i) => variable(i + 100))
    expect(variableScopeEntriesSchema.safeParse(variables).success).toBe(true)
    expect(variableScopeEntriesSchema.safeParse([...variables, variable(300)]).success).toBe(false)
    expect(variableScopeEntriesSchema.safeParse([variable(1), { ...variable(2), key: 'key_1' }]).success).toBe(false)
    expect(variableScopeEntriesSchema.safeParse([variable(1), { ...variable(2), workspaceId: id(99) }]).success).toBe(false)
    expect(variableScopeEntriesSchema.safeParse([{ ...variable(1), key: 'bad-key' }]).success).toBe(false)
  })
  it('supports stable UUID row paths and indexed validation paths without reflecting values', () => {
    expect(formatFieldPath(['draft', 'headerRows', 2, 'value'])).toBe('draft.headerRows[2].value')
    expect(rowFieldPath('body.rows', id(1), 'value')).toBe(`body.rows[${id(1)}].value`)
    expect(formatFieldPath(['sensitive value'])).toBeUndefined()
    const result = runtimeRequestConfigSchema.safeParse({ ...config(), queryRows: [{ ...row(1), value: 42 }] })
    if (result.success) throw new Error('Expected validation failure')
    expect(validationError(result.error)).toEqual({ code: 'VALIDATION', message: 'Invalid input', retryable: false, field: 'queryRows[0].value' })
    const unknown = runtimeRequestConfigSchema.safeParse({ ...config(), 'synthetic-secret-field': 'synthetic' })
    if (unknown.success) throw new Error('Expected strict rejection')
    expect(JSON.stringify(validationError(unknown.error))).not.toContain('synthetic')
  })
  it('validates exact discriminated result envelopes', () => {
    const schema = resultSchema(z.strictObject({ id: uuidSchema }))
    expect(schema.safeParse({ ok: true, data: { id: id(1) } }).success).toBe(true)
    expect(schema.safeParse({ ok: false, error: { code: 'CANCELLED', message: 'Cancelled', retryable: false } }).success).toBe(true)
    expect(schema.safeParse({ ok: true, data: { id: id(1) }, error: {} }).success).toBe(false)
    expect(schema.safeParse({ ok: false, error: { code: 'INTERNAL_STACK', message: 'Bad', retryable: false, stack: '' } }).success).toBe(false)
  })
  it('treats non-2xx transport statuses as responses and retains duplicate response headers', () => {
    const response = {
      statusCode: 401, statusMessage: 'Unauthorized', finalUrl: 'http://127.0.0.1/echo',
      redirectCount: 0, durationMs: 1.25, bodySizeBytes: 2,
      headers: [{ name: 'Set-Cookie', value: 'synthetic=1' }, { name: 'Set-Cookie', value: 'synthetic=2' }],
      body: { kind: 'text', text: '{}', charset: 'utf-8' }
    }
    expect(httpResponseSchema.parse(response)).toEqual(response)
    expect(executionCompletedSchema.safeParse({ executionId: id(1), result: response }).success).toBe(true)
    expect(httpResponseSchema.safeParse({ ...response, bodySizeBytes: LIMITS.decodedResponseBytes + 1 }).success).toBe(false)
    expect(httpResponseSchema.safeParse({ ...response, body: { kind: 'binary', sizeBytes: 3, reason: 'Unsupported type' } }).success).toBe(false)
  })
  it('rejects oversized selected file capability metadata', () => {
    expect(uploadCapabilitySchema.safeParse({ fileId: id(1), name: 'file', size: LIMITS.fileBytes }).success).toBe(true)
    expect(uploadCapabilitySchema.safeParse({ fileId: id(1), name: 'file', size: LIMITS.fileBytes + 1 }).success).toBe(false)
  })
})
