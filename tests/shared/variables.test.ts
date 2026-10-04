import { expect, it } from 'vitest'
import { mergeVariables, interpolate, resolveRequestTemplates } from '../../src/shared/variables'
import { createDefaultRequestConfig, type RuntimeRequestConfig } from '../../src/shared/request-config'
const variables = new Map([['host', 'http://localhost'], ['value', 'سلام'], ['key', 'duplicate'], ['nested', '{{missing}}']])
const row = (id: string, key: string, value: string, enabled = true) => ({ id, key, value, enabled })
const config = (): RuntimeRequestConfig => ({ ...createDefaultRequestConfig(), method: 'POST', urlTemplate: '{{host}}/echo?existing=%2F' })
it('merges only selected scopes, including empty/null overrides and case-sensitive safe keys', () => {
  const entries = [
    { workspaceId: 'a', environmentId: null, key: 'host', value: 'workspace' },
    { workspaceId: 'a', environmentId: 'active', key: 'host', value: '' },
    { workspaceId: 'a', environmentId: null, key: 'Host', value: 'case' },
    { workspaceId: 'a', environmentId: null, key: '__proto__', value: 'ordinary' },
    { workspaceId: 'a', environmentId: 'inactive', key: 'host', value: 'inactive' },
    { workspaceId: 'b', environmentId: 'active', key: 'host', value: 'foreign' }
  ]
  const merged = mergeVariables('a', 'active', entries)
  expect(merged.ok && [...merged.data]).toEqual([['host', ''], ['Host', 'case'], ['__proto__', 'ordinary']])
  const none = mergeVariables('a', null, entries)
  expect(none.ok && none.data.get('host')).toBe('workspace')
  expect(mergeVariables('a', null, [...entries, entries[0]!])).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  const unavailable = mergeVariables('a', 'active', [...entries.filter(e => e.environmentId !== 'active'), { workspaceId: 'a', environmentId: 'active', key: 'host', value: null }])
  expect(unavailable.ok && interpolate('{{host}}', unavailable.data, 'urlTemplate')).toMatchObject({ ok: false, error: { code: 'SECRET_UNAVAILABLE', field: 'urlTemplate' } })
  expect(mergeVariables('a', null, [{ workspaceId: 'a', environmentId: null, key: 'invalid key', value: '' }])).toMatchObject({ ok: false })
})
it('interpolates once, trims only keys and treats unmatched braces as text', () => {
  expect(interpolate(' {{ value }} {{nested}} {{key}} ', variables, 'body.text')).toEqual({ ok: true, data: ' سلام {{missing}} duplicate ' })
  for (const text of ['before {{missing', 'after missing}}']) expect(interpolate(text, variables, 'body.text')).toEqual({ ok: true, data: text })
  for (const text of ['{{}}', '{{bad-key}}', '{{a b}}', '{{a.b}}']) expect(interpolate(text, variables, 'body.text')).toMatchObject({ ok: false, error: { code: 'VALIDATION', field: 'body.text' } })
  expect(interpolate('{{Missing}}', variables, 'queryRows[1].key')).toMatchObject({ ok: false, error: { code: 'VARIABLE_MISSING', field: 'queryRows[1].key', message: 'Missing variable: Missing' } })
})
it('resolves enabled locations in order without mutating templates or encoding query values', () => {
  const source = { ...config(), queryRows: [row('a', '{{key}}', '%2F'), row('b', '{{key}}', '{{value}}'), row('c', '{{bad-key}}', '{{missing}}', false)], headerRows: [row('h', 'X-{{key}}', '{{value}}')], body: { kind: 'raw' as const, text: '{{value}} {{nested}}', mediaType: 'text/plain' }, auth: { mode: 'basic' as const, usernameTemplate: '{{key}}', passwordTemplate: '{{value}}' } }
  const original = structuredClone(source), result = resolveRequestTemplates(source, variables)
  expect(source).toEqual(original)
  expect(result).toMatchObject({ ok: true, data: { urlTemplate: 'http://localhost/echo?existing=%2F', queryRows: [row('a', 'duplicate', '%2F'), row('b', 'duplicate', 'سلام')], headerRows: [row('h', 'X-duplicate', 'سلام')], body: { text: 'سلام {{missing}}' }, auth: { usernameTemplate: 'duplicate', passwordTemplate: 'سلام' } } })
})
it('resolves URL-encoded and multipart text/file keys, excluding disabled parts and file metadata', () => {
  expect(resolveRequestTemplates({ ...config(), body: { kind: 'urlencoded', rows: [row('a', '{{key}}', '{{value}}'), row('b', '{{missing}}', '', false)] } }, variables)).toMatchObject({ ok: true, data: { body: { rows: [row('a', 'duplicate', 'سلام')] } } })
  const result = resolveRequestTemplates({ ...config(), body: { kind: 'multipart', rows: [{ ...row('a', '{{key}}', '{{value}}'), kind: 'text' }, { id: 'f', kind: 'file', key: '{{key}}', enabled: true, fileId: 'opaque', fileName: '{{missing}}' }, { id: 'd', kind: 'file', key: '{{missing}}', enabled: false }] }, auth: { mode: 'bearer', tokenTemplate: '{{value}}' } }, variables)
  expect(result).toMatchObject({ ok: true, data: { body: { rows: [{ key: 'duplicate', value: 'سلام' }, { key: 'duplicate', fileId: 'opaque', fileName: '{{missing}}' }] }, auth: { tokenTemplate: 'سلام' } } })
  if (result.ok && result.data.body.kind === 'multipart') expect(result.data.body.rows).toHaveLength(2)
})
it('validates substituted JSON without escaping, rewriting source or exposing parse details', () => {
  const source = { ...config(), body: { kind: 'json' as const, text: ' { "message": "{{value}}" } ' } }
  expect(resolveRequestTemplates(source, variables)).toMatchObject({ ok: true, data: { body: { text: ' { "message": "سلام" } ' } } })
  const rejected = resolveRequestTemplates(source, new Map([['host', 'http://localhost'], ['value', 'synthetic"quote']]))
  expect(rejected).toEqual({ ok: false, error: { code: 'VALIDATION', message: 'Invalid resolved JSON', field: 'body.text', retryable: false } })
  expect(JSON.stringify(rejected)).not.toContain('synthetic')
  expect(source.body.text).toBe(' { "message": "{{value}}" } ')
  expect(resolveRequestTemplates({ ...config(), body: { kind: 'json', text: '' } }, variables)).toMatchObject({ ok: false, error: { field: 'body.text' } })
})
it('runs validation hooks after substitution and sanitizes failures before any consuming operation', () => {
  let consumed = 0
  const missing = resolveRequestTemplates({ ...config(), headerRows: [row('h', 'X-Test', '{{missing}}')] }, variables)
  if (missing.ok) consumed++
  expect(consumed).toBe(0)
  expect(missing).toMatchObject({ ok: false, error: { field: 'headerRows[0].value' } })
  expect(resolveRequestTemplates(config(), variables, { url: text => text === 'http://localhost/echo?existing=%2F' })).toMatchObject({ ok: true })
  expect(resolveRequestTemplates(config(), variables, { url: () => { throw new Error('private resolved URL') } })).toEqual({ ok: false, error: { code: 'INVALID_URL', message: 'Invalid resolved URL', field: 'urlTemplate', retryable: false } })
  expect(resolveRequestTemplates({ ...config(), headerRows: [row('d', '{{bad-key}}', '{{missing}}', false), row('h', 'X-Test', '{{value}}')] }, variables, { header: (_key, value) => value !== 'سلام' })).toMatchObject({ ok: false, error: { code: 'INVALID_HEADER', field: 'headerRows[1].value' } })
  expect(resolveRequestTemplates({ ...config(), body: { kind: 'json', text: '"{{value}}"' } }, variables, { json: text => text === '"سلام"' })).toMatchObject({ ok: true })
})
it('reports missing/unavailable values at every supported location with no resolved data', () => {
  const cases: [RuntimeRequestConfig, string][] = [
    [{ ...config(), urlTemplate: '{{missing}}' }, 'urlTemplate'],
    [{ ...config(), queryRows: [row('q', '{{missing}}', '')] }, 'queryRows[0].key'],
    [{ ...config(), queryRows: [row('q', '', '{{missing}}')] }, 'queryRows[0].value'],
    [{ ...config(), headerRows: [row('h', '{{missing}}', '')] }, 'headerRows[0].key'],
    [{ ...config(), body: { kind: 'raw', text: '{{missing}}', mediaType: 'text/plain' } }, 'body.text'],
    [{ ...config(), body: { kind: 'urlencoded', rows: [row('q', '', '{{missing}}')] } }, 'body.rows[0].value'],
    [{ ...config(), body: { kind: 'multipart', rows: [{ id: 'f', kind: 'file', key: '{{missing}}', enabled: true }] } }, 'body.rows[0].key'],
    [{ ...config(), auth: { mode: 'bearer', tokenTemplate: '{{missing}}' } }, 'auth.tokenTemplate'],
    [{ ...config(), auth: { mode: 'basic', usernameTemplate: '{{missing}}', passwordTemplate: '' } }, 'auth.usernameTemplate'],
    [{ ...config(), auth: { mode: 'basic', usernameTemplate: '', passwordTemplate: '{{missing}}' } }, 'auth.passwordTemplate']
  ]
  for (const [source, field] of cases) {
    expect(resolveRequestTemplates(source, variables)).toEqual({ ok: false, error: { code: 'VARIABLE_MISSING', message: 'Missing variable: missing', field, retryable: false } })
    expect(resolveRequestTemplates(source, new Map([...variables, ['missing', null]]))).toEqual({ ok: false, error: { code: 'SECRET_UNAVAILABLE', message: 'Variable value unavailable: missing', field, retryable: false } })
  }
})
it('ignores invalid duplicate keys in excluded scopes and resolves supplied main-only sensitive values without diagnostics', () => {
  const result = mergeVariables('a', null, [
    { workspaceId: 'b', environmentId: null, key: 'bad key', value: 'excluded' },
    { workspaceId: 'a', environmentId: 'inactive', key: 'same', value: 'one' },
    { workspaceId: 'a', environmentId: 'inactive', key: 'same', value: 'two' },
    { workspaceId: 'a', environmentId: null, key: 'fixture', value: 'synthetic value' }
  ])
  expect(result.ok && [...result.data]).toEqual([['fixture', 'synthetic value']])
  if (result.ok) expect(interpolate('{{fixture}}', result.data, 'auth.tokenTemplate')).toEqual({ ok: true, data: 'synthetic value' })
})
