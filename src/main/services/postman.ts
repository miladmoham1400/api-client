import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { httpMethodSchema, nameSchema, variableKeySchema } from '../../shared/primitives'
import { credentialTemplateSchema, type ExportAuth, type ExportBody } from '../../shared/request-config'
import { workspaceExportV2Schema, type WorkspaceExportV2 } from '../../shared/transfer'

export const POSTMAN_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
export class PostmanError extends Error {}
const fail = (message: string): never => { throw new PostmanError(message) }
const object = (value: unknown): Record<string, unknown> => z.record(z.string(), z.unknown()).parse(value)
const text = (value: unknown, fallback = '') => value === undefined || value === null ? fallback : z.string().parse(value)
const entries = (value: unknown, max = 200) => value === undefined ? [] : z.array(z.unknown()).max(max).parse(value)
const hasSettings = (value: unknown) => value !== undefined && value !== null && Object.keys(object(value)).length > 0
const credentialHeader = /^(authorization|proxy-authorization|cookie)$/i
const sensitiveDescription = 'Sensitive value omitted. Supply locally.'
const sensitiveKey = /token|secret|password|api[_-]?key|authorization|cookie/i
const row = (key: string, value: string, enabled = true) => ({ id: randomUUID(), key, value, enabled })
function headers(input: unknown) {
  const values = typeof input === 'string' ? input.split(/\r?\n/).filter(Boolean).map(line => { const colon = line.indexOf(':'); if (colon < 1) return fail('Invalid Postman header line.'); return { key: line.slice(0, colon), value: line.slice(colon + 1).trim() } }) : entries(input)
  return values.map(value => { const h = object(value), key = text(h.key); return row(key, credentialHeader.test(key.trim()) ? '' : text(h.value), credentialHeader.test(key.trim()) ? false : h.disabled !== true) })
}
function auth(input: unknown): ExportAuth {
  if (input === undefined || input === null) return { mode: 'none' }
  const a = object(input), type = text(a.type)
  if (type === 'noauth') return { mode: 'none' }
  if (type !== 'basic' && type !== 'bearer') return fail('Unsupported Postman authentication. Only no auth, Bearer and Basic are supported; no data was imported.')
  const attrs = entries(a[type]).map(object)
  const field = (key: string) => { const value = text(attrs.find(v => v.key === key)?.value); return credentialTemplateSchema.safeParse(value).success ? value : '' }
  if (type === 'bearer') return { mode: 'bearer', tokenTemplate: field('token'), requiresCredentials: !field('token') }
  return { mode: 'basic', usernameTemplate: field('username'), passwordTemplate: field('password'), requiresCredentials: !field('username') || !field('password') }
}
function body(input: unknown, requestHeaders: ReturnType<typeof headers>): ExportBody {
  if (input === undefined || input === null) return { kind: 'none' }
  const b = object(input)
  if (b.disabled === true || b.mode === undefined) return { kind: 'none' }
  if (b.mode === 'raw') {
    const options = b.options === undefined ? {} : object(b.options), rawOptions = options.raw === undefined ? {} : object(options.raw)
    const mediaType = requestHeaders.find(h => h.key.toLowerCase() === 'content-type' && h.enabled)?.value ?? 'text/plain'
    return rawOptions.language === 'json' || /(?:\/json|\+json)(?:;|$)/i.test(mediaType) ? { kind: 'json', text: text(b.raw) } : { kind: 'raw', text: text(b.raw), mediaType }
  }
  if (b.mode === 'urlencoded') return { kind: 'urlencoded', rows: entries(b.urlencoded).map(value => { const v = object(value); return row(text(v.key), text(v.value), v.disabled !== true) }) }
  if (b.mode === 'formdata') return { kind: 'multipart', rows: entries(b.formdata).flatMap<Extract<ExportBody, { kind: 'multipart' }>['rows'][number]>(value => {
    const v = object(value), key = text(v.key), enabled = v.disabled !== true
    if (v.contentType !== undefined) return fail('Per-part Content-Type overrides are not supported. No data was imported.')
    if (v.type === 'file') {
      // Never retain imported paths. Every file must be explicitly selected locally.
      const sources = Array.isArray(v.src) ? entries(v.src) : [v.src]
      return (sources.length ? sources : [null]).map(() => ({ id: randomUUID(), key, kind: 'file' as const, enabled, requiresSelection: true as const }))
    }
    if (v.type !== undefined && v.type !== 'text') return fail('Unsupported Postman form field type.')
    return [{ ...row(key, text(v.value), enabled), kind: 'text' as const }]
  }) }
  return fail('Unsupported Postman body mode. Raw, JSON, URL-encoded and multipart bodies are supported; no data was imported.')
}
function url(input: unknown) {
  if (typeof input === 'string') return { urlTemplate: input, queryRows: [] }
  const u = object(input), host = Array.isArray(u.host) ? z.array(z.string()).parse(u.host).join('.') : text(u.host)
  const path = Array.isArray(u.path) ? u.path.map(p => typeof p === 'string' ? p : text(object(p).value)).join('/') : text(u.path)
  let raw = text(u.raw, `${text(u.protocol, 'https')}://${host}${u.port ? ':' + text(u.port) : ''}/${path}`)
  const queryRows = entries(u.query).map(value => { const v = object(value); return row(text(v.key), text(v.value), v.disabled !== true) })
  if (queryRows.length && raw.includes('?')) raw = raw.slice(0, raw.indexOf('?'))
  if (entries(u.variable).length || /\/:\w+/.test(raw)) return fail('Postman path variables are not supported. Replace them with {{variables}} before importing.')
  return { urlTemplate: raw, queryRows }
}
const POSTMAN_NOTICE = 'Scripts, tests, response payloads and descriptions are not imported. Literal auth credentials, credential headers, sensitive variable values and file paths are omitted. Examples contribute Body variants only. Re-enter credentials and select files locally. Unsupported methods, auth/body modes, path variables, proxy/certificate or protocol settings are rejected.'

/** Parse bounded, inert JSON nodes iteratively; never execute collection content. */
export function importPostman(input: unknown): WorkspaceExportV2 {
  const root = object(input), info = object(root.info), schema = text(info.schema)
  if (!/^https?:\/\/schema\.(?:get)?postman\.com\/json\/collection\/v2\.1\.0\/collection\.json$/.test(schema)) return fail('Only Postman Collection v2.1 JSON is supported.')
  const name = nameSchema.parse(info.name), collectionId = randomUUID()
  const workspace: WorkspaceExportV2['workspace'] = { id: randomUUID(), name, collections: [{ id: collectionId, name, sortOrder: 0 }], folders: [], requests: [], environments: [], variables: entries(root.variable, 100).map(value => {
    const v = object(value), key = variableKeySchema.parse(v.key), base = { id: randomUUID(), environmentId: null, key }
    return v.type === 'secret' || sensitiveKey.test(key) || v.description === sensitiveDescription ? { ...base, isSensitive: true as const, requiresValue: true as const } : { ...base, isSensitive: false as const, value: typeof v.value === 'number' || typeof v.value === 'boolean' ? String(v.value) : text(v.value), requiresValue: false as const }
  }) }
  const stack = entries(root.item, 2000).map((item, index) => ({ item, parent: null as string | null, depth: 0, inherited: root.auth, order: index })).reverse()
  if (hasSettings(root.protocolProfileBehavior)) return fail('Postman protocol settings are not supported.')
  while (stack.length) {
    const entry = stack.pop()!, item = object(entry.item), inherited = item.auth ?? entry.inherited
    if (hasSettings(item.protocolProfileBehavior) || entries(item.variable, 100).length) return fail('Folder/item variables or protocol settings are not supported. Move variables to collection scope before importing.')
    if (item.item !== undefined) {
      if (item.request !== undefined || entry.depth >= 16 || workspace.folders.length >= 1000) return fail('Invalid or oversized Postman folder hierarchy.')
      const folderId = randomUUID()
      workspace.folders.push({ id: folderId, collectionId, parentFolderId: entry.parent, name: nameSchema.parse(item.name), sortOrder: entry.order })
      const children = entries(item.item, 2000)
      for (let i = children.length - 1; i >= 0; i--) stack.push({ item: children[i], parent: folderId, depth: entry.depth + 1, inherited, order: i })
      continue
    }
    if (workspace.requests.length >= 1000) return fail('Postman collection exceeds 1,000 requests.')
    const request = typeof item.request === 'string' ? { method: 'GET', url: item.request } : object(item.request)
    if (request.proxy !== undefined || request.certificate !== undefined || hasSettings(request.protocolProfileBehavior)) return fail('Postman proxy, certificate and protocol settings are not supported.')
    const method = httpMethodSchema.safeParse(request.method ?? 'GET')
    if (!method.success) return fail('Unsupported Postman HTTP method. No data was imported.')
    const hs = headers(request.header), activeBody = body(request.body, hs)
    if (activeBody.kind === 'multipart') hs.forEach(h => { if (h.key.toLowerCase() === 'content-type') h.enabled = false })
    const config: WorkspaceExportV2['workspace']['requests'][number]['config'] = { configVersion: 1, method: method.data, ...url(request.url), headerRows: hs, body: activeBody, auth: auth(request.auth ?? inherited), timeoutMs: 30000, followRedirects: false }
    const examples = entries(item.response, 20), variants = [{ id: randomUUID(), name: 'Body 1', body: activeBody }]
    for (const example of examples) {
      const ex = object(example)
      if (ex.originalRequest === undefined) continue
      const original = object(ex.originalRequest), exampleBody = body(original.body, headers(original.header ?? request.header))
      const existing = variants.find(v => JSON.stringify(v.body) === JSON.stringify(exampleBody))
      if (existing) { if (ex.name) existing.name = nameSchema.parse(ex.name); continue }
      variants.push({ id: randomUUID(), name: nameSchema.parse(ex.name ?? `Body ${variants.length + 1}`), body: exampleBody })
    }
    if (variants.length > 1) { config.bodyVariants = variants; config.selectedBodyVariantId = variants[0]!.id }
    workspace.requests.push({ id: randomUUID(), collectionId, folderId: entry.parent, name: nameSchema.parse(item.name ?? 'Imported request'), config })
  }
  return workspaceExportV2Schema.parse({ format: 'offline-api-client-workspace', version: 2, exportedAt: new Date().toISOString(), workspace })
}
export { POSTMAN_NOTICE }

function postmanBody(b: ExportBody): Record<string, unknown> | undefined {
  if (b.kind === 'none') return undefined
  if (b.kind === 'json' || b.kind === 'raw') return { mode: 'raw', raw: b.text, options: { raw: { language: b.kind === 'json' ? 'json' : 'text' } } }
  if (b.kind === 'urlencoded') return { mode: 'urlencoded', urlencoded: b.rows.map(r => ({ key: r.key, value: r.value, disabled: !r.enabled })) }
  return { mode: 'formdata', formdata: b.rows.map(r => r.kind === 'file' ? { key: r.key, type: 'file', src: null, disabled: !r.enabled } : { key: r.key, value: r.value, type: 'text', disabled: !r.enabled }) }
}
function postmanAuth(a: ExportAuth): Record<string, unknown> {
  if (a.mode === 'none') return { type: 'noauth' }
  const field = (key: string, value: string) => ({ key, value, type: 'string' })
  return a.mode === 'bearer' ? { type: 'bearer', bearer: [field('token', a.tokenTemplate)] } : { type: 'basic', basic: [field('username', a.usernameTemplate), field('password', a.passwordTemplate)] }
}
/** Input is an already allowlisted native export: secrets and capabilities are absent. */
export function exportPostman(dto: WorkspaceExportV2, collectionId: string): Record<string, unknown> {
  const w = dto.workspace, collection = w.collections.find(c => c.id === collectionId)
  if (!collection) return fail('Collection is not available in this workspace.')
  const folders = new Map<string, Record<string, unknown>[]>(), root: Record<string, unknown>[] = []
  const children = (id: string | null) => { if (id === null) return root; let items = folders.get(id); if (!items) { items = []; folders.set(id, items) }; return items }
  for (const f of w.folders.filter(f => f.collectionId === collectionId).sort((a,b) => a.sortOrder-b.sortOrder)) children(f.parentFolderId).push({ name: f.name, item: children(f.id) })
  for (const r of w.requests.filter(r => r.collectionId === collectionId)) {
    const c = r.config
    const question = c.urlTemplate.indexOf('?')
    const embedded = question < 0 ? [] : Array.from(new URLSearchParams(c.urlTemplate.slice(question + 1)), ([key, value]) => ({ key, value, disabled: false }))
    const query = [...embedded, ...c.queryRows.map(q => ({ key: q.key, value: q.value, disabled: !q.enabled }))]
    const encode = (value: string) => value.split(/(\{\{\s*[A-Za-z_][A-Za-z0-9_]{0,63}\s*\}\})/g).map(part => part.startsWith('{{') ? part : encodeURIComponent(part)).join('')
    const suffix = c.queryRows.filter(q => q.enabled).map(q => `${encode(q.key)}=${encode(q.value)}`).join('&')
    const raw = c.urlTemplate + (suffix ? (c.urlTemplate.includes('?') ? '&' : '?') + suffix : '')
    const makeRequest = (b: ExportBody) => {
      const hs = c.headerRows.map(h => ({ key: h.key, value: h.value, disabled: !h.enabled }))
      if ((b.kind === 'json' || b.kind === 'raw') && !hs.some(h => h.key.toLowerCase() === 'content-type' && !h.disabled)) hs.push({ key: 'Content-Type', value: b.kind === 'json' ? 'application/json' : b.mediaType, disabled: false })
      return { method: c.method, url: query.length ? { raw, query } : c.urlTemplate, header: hs, auth: postmanAuth(c.auth), ...(b.kind === 'none' ? {} : { body: postmanBody(b) }) }
    }
    const request = makeRequest(c.body)
    children(r.folderId).push({ name: r.name, request, ...(c.bodyVariants?.length ? { response: c.bodyVariants.map(v => ({ name: v.name, originalRequest: makeRequest(v.body), body: '' })) } : {}) })
  }
  return { info: { name: collection.name, schema: POSTMAN_SCHEMA, description: 'Exported saved configuration. Secrets, file paths/selections and responses omitted. Environment-specific values and timeout/redirect settings are not transferred. Body variants are represented by request examples.' }, item: root,
    variable: w.variables.filter(v => v.environmentId === null).map(v => ({ key: v.key, value: v.isSensitive ? '' : v.value, type: 'string', ...(v.isSensitive ? { description: sensitiveDescription } : {}) })) }
}
