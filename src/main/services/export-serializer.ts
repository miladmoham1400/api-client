import type { Collection, Environment, StoredRequest, StoredVariable, Workspace } from '../../shared/entities'
import { credentialTemplateSchema, type ExportAuth, type ExportBody, type StoredBody, type StoredAuth } from '../../shared/request-config'
import { workspaceExportSchema, type WorkspaceExport } from '../../shared/transfer'

export interface ExportSnapshot {
  workspace: Workspace
  collections: Collection[]
  environments: Environment[]
  variables: StoredVariable[]
  requests: StoredRequest[]
}
function auth(source: StoredAuth): ExportAuth {
  if (source.mode === 'none') return { mode: 'none' }
  const credential = (value: Extract<StoredAuth, { mode: 'bearer' }>['token']) => {
    const permitted = value.kind === 'template' && credentialTemplateSchema.safeParse(value.template).success
    return { template: permitted && value.kind === 'template' ? value.template : '', omitted: !permitted }
  }
  if (source.mode === 'bearer') {
    const token = credential(source.token)
    return { mode: 'bearer', tokenTemplate: token.template, requiresCredentials: token.omitted }
  }
  const username = credential(source.username), password = credential(source.password)
  return { mode: 'basic', usernameTemplate: username.template, passwordTemplate: password.template, requiresCredentials: username.omitted || password.omitted }
}
const row = (value: { id: string; key: string; value: string; enabled: boolean }) => ({ id: value.id, key: value.key, value: value.value, enabled: value.enabled })
function body(source: StoredBody): ExportBody {
  switch (source.kind) {
    case 'none': return { kind: 'none' }
    case 'json': return { kind: 'json', text: source.text }
    case 'raw': return { kind: 'raw', text: source.text, mediaType: source.mediaType }
    case 'urlencoded': return { kind: 'urlencoded', rows: source.rows.map(row) }
    case 'multipart': return { kind: 'multipart', rows: source.rows.map(value => value.kind === 'text'
      ? { id: value.id, key: value.key, value: value.value, enabled: value.enabled, kind: 'text' }
      : { id: value.id, key: value.key, enabled: value.enabled, kind: 'file', requiresSelection: true,
        ...(value.fileName === undefined ? {} : { fileName: value.fileName }), ...(value.fileSize === undefined ? {} : { fileSize: value.fileSize }) }) }
  }
}
/** Explicit allowlists throughout: stored objects, credentials and state are never dumped. */
export function serializeWorkspace(snapshot: ExportSnapshot, exportedAt = new Date().toISOString()): WorkspaceExport {
  return workspaceExportSchema.parse({
    format: 'offline-api-client-workspace', version: 1, exportedAt,
    workspace: {
      id: snapshot.workspace.id, name: snapshot.workspace.name,
      collections: snapshot.collections.map(value => ({ id: value.id, name: value.name, sortOrder: value.sortOrder })),
      environments: snapshot.environments.map(value => ({ id: value.id, name: value.name })),
      variables: snapshot.variables.map(value => value.isSensitive
        ? { id: value.id, environmentId: value.environmentId, key: value.key, isSensitive: true, requiresValue: true }
        : { id: value.id, environmentId: value.environmentId, key: value.key, isSensitive: false, value: value.plainValue, requiresValue: false }),
      requests: snapshot.requests.map(value => ({ id: value.id, collectionId: value.collectionId, name: value.name, config: {
        configVersion: 1, method: value.config.method, urlTemplate: value.config.urlTemplate,
        queryRows: value.config.queryRows.map(row), headerRows: value.config.headerRows.map(value => /^(authorization|proxy-authorization|cookie)$/i.test(value.key.trim())
          ? { id: value.id, key: value.key, value: '', enabled: false } : row(value)),
        body: body(value.config.body), auth: auth(value.config.auth), timeoutMs: value.config.timeoutMs, followRedirects: value.config.followRedirects
      } }))
    }
  })
}
