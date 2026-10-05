import { themeSchema, type ThemePreference } from '../../../shared/theme'
import { importWorkspaceDataSchema } from '../../../shared/import'
import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { collectionSchema, environmentSchema, storedVariableSchema, workspaceSchema, workspaceStateSchema, requestSummarySchema, type StoredVariable } from '../../../shared/entities'
import { storedRequestConfigSchema, type StoredRequestConfig, storedCredentialSchema } from '../../../shared/request-config'
import { LIMITS, nameSchema, uuidSchema, variableKeySchema, limitedText } from '../../../shared/primitives'
import type { ErrorCode } from '../../../shared/results'

export class RepositoryError extends Error {
  constructor(readonly code: ErrorCode) { super(code === 'NOT_FOUND' ? 'Item not found' : code === 'VALIDATION' ? 'Invalid input' : 'Local data operation failed') }
}
const identity = 'id, name, created_at AS createdAt, updated_at AS updatedAt'
const scopedIdentity = `${identity}, workspace_id AS workspaceId`
const secretSchema = z.strictObject({ id: uuidSchema, workspaceId: uuidSchema, storageMode: z.enum(['secure','session']), encryptedValue: z.instanceof(Buffer).nullable(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() }).superRefine((record, ctx) => {
  if ((record.storageMode === 'secure') !== (record.encryptedValue !== null)) ctx.addIssue({ code: 'custom', message: 'Invalid secret storage' })
})
export type SecretRecord = z.infer<typeof secretSchema>
const variableValueSchema = z.discriminatedUnion('isSensitive', [
  z.strictObject({ isSensitive: z.literal(false), plainValue: limitedText(), secretId: z.null() }),
  z.strictObject({ isSensitive: z.literal(true), plainValue: z.null(), secretId: uuidSchema })
])
type StoredCredential = z.infer<typeof storedCredentialSchema>
type VariableValue = z.infer<typeof variableValueSchema>
type Table = 'collections' | 'environments' | 'requests' | 'variables' | 'secrets'
function secretIds(config: StoredRequestConfig): string[] {
  const credentials = config.auth.mode === 'bearer' ? [config.auth.token] : config.auth.mode === 'basic' ? [config.auth.username, config.auth.password] : []
  return [...new Set(credentials.flatMap(value => value.kind === 'secret' ? [value.secretId] : []))]
}

// Main-process only. Every descendant operation requires workspace ownership in its WHERE clause.
export class Repositories {
  constructor(private readonly db: Database.Database) {}
  private read<T>(operation: () => T): T {
    try { return operation() } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError(error instanceof z.ZodError ? 'VALIDATION' : 'DATABASE_UNAVAILABLE')
    }
  }
  private write<T>(operation: () => T): T {
    try { return this.db.transaction(operation).immediate() } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw new RepositoryError(error instanceof z.ZodError ? 'VALIDATION' : 'DATABASE_WRITE_FAILED')
    }
  }
  private owned(table: Table, workspaceId: string, id: string): void {
    uuidSchema.parse(workspaceId); uuidSchema.parse(id)
    if (!this.db.prepare(`SELECT id FROM ${table} WHERE workspace_id=? AND id=?`).get(workspaceId, id)) throw new RepositoryError('NOT_FOUND')
  }
  private workspace(id: string): void {
    uuidSchema.parse(id)
    if (!this.db.prepare('SELECT id FROM workspaces WHERE id=?').get(id)) throw new RepositoryError('NOT_FOUND')
  }
  importWorkspace(input: unknown) {
    // Validate the complete graph before any write; nested repository transactions are savepoints.
    const source = importWorkspaceDataSchema.parse(input)
    return this.write(() => {
      const w = this.createWorkspace(Array.from(source.name).slice(0, LIMITS.nameCharacters - 11).join('') + ' (imported)')
      const collections = new Map<string, string>(), environments = new Map<string, string>()
      for (const c of source.collections) {
        const created = this.createCollection(w.id, c.name)
        this.db.prepare('UPDATE collections SET sort_order=? WHERE workspace_id=? AND id=?').run(c.sortOrder, w.id, created.id)
        collections.set(c.id, created.id)
      }
      for (const e of source.environments) environments.set(e.id, this.createEnvironment(w.id, e.name).id)
      for (const v of source.variables) this.upsertVariable(w.id, v.environmentId === null ? null : environments.get(v.environmentId)!, v.key,
        v.isSensitive ? { isSensitive: true, plainValue: null, secretId: this.createSecret(w.id, 'session', null).id } : { isSensitive: false, plainValue: v.value, secretId: null })
      const row = (r: { key: string; value: string; enabled: boolean }) => ({ id: randomUUID(), key: r.key, value: r.value, enabled: r.enabled })
      const credential = (template: string, missing: boolean): StoredCredential => template === '' && missing
        ? { kind: 'secret', secretId: this.createSecret(w.id, 'session', null).id } : { kind: 'template', template }
      for (const request of source.requests) {
        const config = request.config, auth = config.auth
        const stored: StoredRequestConfig = { configVersion: 1, method: config.method, urlTemplate: config.urlTemplate,
          queryRows: config.queryRows.map(row), headerRows: config.headerRows.map(row), timeoutMs: config.timeoutMs, followRedirects: config.followRedirects,
          auth: auth.mode === 'none' ? { mode: 'none' } : auth.mode === 'bearer' ? { mode: 'bearer', token: credential(auth.tokenTemplate, auth.requiresCredentials) }
            : { mode: 'basic', username: credential(auth.usernameTemplate, auth.requiresCredentials), password: credential(auth.passwordTemplate, auth.requiresCredentials) },
          body: config.body.kind === 'multipart' ? { kind: 'multipart', rows: config.body.rows.map(r => r.kind === 'text' ? { ...row(r), kind: 'text' }
            : { id: randomUUID(), key: r.key, kind: 'file', enabled: r.enabled, ...(r.fileName === undefined ? {} : { fileName: r.fileName }), ...(r.fileSize === undefined ? {} : { fileSize: r.fileSize }) }) }
            : config.body.kind === 'urlencoded' ? { kind: 'urlencoded', rows: config.body.rows.map(row) } : { ...config.body }
        }
        this.createRequest(w.id, request.name, request.collectionId === null ? null : collections.get(request.collectionId)!, stored)
      }
      // createWorkspace supplies None/no request; app selection and existing workspaces stay unchanged.
      return w
    })
  }
  getTheme(): ThemePreference { return this.read(() => {
    const row = this.db.prepare("SELECT value_json AS value FROM app_settings WHERE key='theme'").get()
    return row ? themeSchema.parse(JSON.parse(z.strictObject({ value: z.string() }).parse(row).value)) : 'system'
  }) }
  setTheme(theme: ThemePreference): ThemePreference { return this.write(() => {
    const value = themeSchema.parse(theme)
    this.db.prepare("INSERT INTO app_settings VALUES ('theme',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json").run(JSON.stringify(value))
    return this.getTheme()
  }) }
  listWorkspaces() { return this.read(() => z.array(workspaceSchema).parse(this.db.prepare(`SELECT ${identity} FROM workspaces ORDER BY created_at,id`).all())) }
  getWorkspace(id: string) { return this.read(() => { this.workspace(id); return workspaceSchema.parse(this.db.prepare(`SELECT ${identity} FROM workspaces WHERE id=?`).get(id)) }) }
  createWorkspace(name: string) {
    return this.write(() => {
      const id = randomUUID(), now = new Date().toISOString()
      this.db.prepare('INSERT INTO workspaces VALUES (?,?,?,?)').run(id, nameSchema.parse(name), now, now)
      this.db.prepare('INSERT INTO workspace_state VALUES (?,NULL,NULL)').run(id)
      return this.getWorkspace(id)
    })
  }
  renameWorkspace(id: string, name: string) { return this.write(() => { this.workspace(id); this.db.prepare('UPDATE workspaces SET name=?,updated_at=? WHERE id=?').run(nameSchema.parse(name), new Date().toISOString(), id); return this.getWorkspace(id) }) }
  deleteWorkspace(id: string, beforeDelete: () => void = () => {}) {
    this.read(() => this.workspace(id))
    beforeDelete() // Later execution service must abort before descendant deletion.
    return this.write(() => {
      this.workspace(id)
      this.db.prepare('DELETE FROM workspace_state WHERE workspace_id=?').run(id)
      const state = this.db.prepare("SELECT value_json FROM app_settings WHERE key='lastWorkspaceId'").get()
      if (state) {
        const value = z.strictObject({ value_json: z.string() }).parse(state)
        if (JSON.parse(value.value_json) === id) this.db.prepare("UPDATE app_settings SET value_json='null' WHERE key='lastWorkspaceId'").run()
      }
      this.db.prepare('DELETE FROM workspaces WHERE id=?').run(id)
    })
  }
  listCollections(w: string) { return this.read(() => { this.workspace(w); return z.array(collectionSchema).parse(this.db.prepare(`SELECT ${scopedIdentity},sort_order AS sortOrder FROM collections WHERE workspace_id=? ORDER BY sort_order,id`).all(w)) }) }
  getCollection(w: string, id: string) { return this.read(() => { this.owned('collections',w,id); return collectionSchema.parse(this.db.prepare(`SELECT ${scopedIdentity},sort_order AS sortOrder FROM collections WHERE workspace_id=? AND id=?`).get(w,id)) }) }
  createCollection(w: string, name: string) {
    return this.write(() => {
      this.workspace(w)
      const id = randomUUID(), now = new Date().toISOString()
      const order = z.strictObject({ n: z.number().int() }).parse(this.db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM collections WHERE workspace_id=?').get(w)).n
      this.db.prepare('INSERT INTO collections VALUES (?,?,?,?,?,?)').run(id,w,nameSchema.parse(name),order,now,now)
      return this.getCollection(w,id)
    })
  }
  renameCollection(w: string, id: string, name: string) { return this.write(() => { this.owned('collections',w,id); this.db.prepare('UPDATE collections SET name=?,updated_at=? WHERE workspace_id=? AND id=?').run(nameSchema.parse(name),new Date().toISOString(),w,id); return this.getCollection(w,id) }) }
  deleteCollection(w: string,id: string) { return this.write(() => { this.owned('collections',w,id); this.db.prepare('UPDATE requests SET collection_id=NULL,updated_at=? WHERE workspace_id=? AND collection_id=?').run(new Date().toISOString(),w,id); this.db.prepare('DELETE FROM collections WHERE workspace_id=? AND id=?').run(w,id) }) }
  listEnvironments(w: string) { return this.read(() => { this.workspace(w); return z.array(environmentSchema).parse(this.db.prepare(`SELECT ${scopedIdentity} FROM environments WHERE workspace_id=? ORDER BY created_at,id`).all(w)) }) }
  getEnvironment(w: string,id: string) { return this.read(() => { this.owned('environments',w,id); return environmentSchema.parse(this.db.prepare(`SELECT ${scopedIdentity} FROM environments WHERE workspace_id=? AND id=?`).get(w,id)) }) }
  createEnvironment(w: string,name: string) { return this.write(() => { this.workspace(w); const id=randomUUID(),now=new Date().toISOString(); this.db.prepare('INSERT INTO environments VALUES (?,?,?,?,?)').run(id,w,nameSchema.parse(name),now,now); return this.getEnvironment(w,id) }) }
  renameEnvironment(w: string,id: string,name: string) { return this.write(() => { this.owned('environments',w,id); this.db.prepare('UPDATE environments SET name=?,updated_at=? WHERE workspace_id=? AND id=?').run(nameSchema.parse(name),new Date().toISOString(),w,id); return this.getEnvironment(w,id) }) }
  deleteEnvironment(w: string,id: string) { return this.write(() => {
    this.owned('environments',w,id)
    const variables=this.listVariables(w,id)
    this.db.prepare('UPDATE workspace_state SET active_environment_id=NULL WHERE workspace_id=? AND active_environment_id=?').run(w,id)
    this.db.prepare('DELETE FROM variables WHERE workspace_id=? AND environment_id=?').run(w,id)
    for (const variable of variables) if (variable.secretId) this.removeOrphanSecret(w,variable.secretId)
    this.db.prepare('DELETE FROM environments WHERE workspace_id=? AND id=?').run(w,id)
  }) }
  listRequests(w: string) { return this.read(() => { this.workspace(w); return z.array(requestSummarySchema).parse(this.db.prepare(`SELECT ${scopedIdentity},collection_id AS collectionId FROM requests WHERE workspace_id=? ORDER BY created_at,id`).all(w)) }) }
  getRequest(w: string,id: string) { return this.read(() => {
    this.owned('requests',w,id)
    const row=z.strictObject({ ...requestSummarySchema.shape, configJson:z.string(),configVersion:z.literal(1) }).parse(this.db.prepare(`SELECT ${scopedIdentity},collection_id AS collectionId,config_json AS configJson,config_version AS configVersion FROM requests WHERE workspace_id=? AND id=?`).get(w,id))
    const {configJson,...summary}=row
    const result={id:summary.id,name:summary.name,workspaceId:summary.workspaceId,collectionId:summary.collectionId,createdAt:summary.createdAt,updatedAt:summary.updatedAt}
    const config=storedRequestConfigSchema.parse(JSON.parse(configJson))
    for (const secret of secretIds(config)) this.owned('secrets',w,secret)
    return {...result,config}
  }) }
  private validateConfig(w: string, input: StoredRequestConfig, owner?: string) {
    const config=storedRequestConfigSchema.parse(input)
    for (const id of secretIds(config)) { this.owned('secrets',w,id); this.assertSecretAvailable(w,id,owner) }
    return config
  }
  createRequest(w: string,name: string,collectionId: string|null, input: StoredRequestConfig) { return this.write(() => {
    this.workspace(w); if (collectionId!==null) this.owned('collections',w,collectionId)
    const config=this.validateConfig(w,input),id=randomUUID(),now=new Date().toISOString()
    this.db.prepare('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)').run(id,w,collectionId,nameSchema.parse(name),1,JSON.stringify(config),now,now)
    return this.getRequest(w,id)
  }) }
  saveRequest(w: string,id: string,name: string,input: StoredRequestConfig) { return this.write(() => {
    const old=this.getRequest(w,id),config=this.validateConfig(w,input,id)
    this.db.prepare('UPDATE requests SET name=?,config_json=?,updated_at=? WHERE workspace_id=? AND id=?').run(nameSchema.parse(name),JSON.stringify(config),new Date().toISOString(),w,id)
    for (const secret of secretIds(old.config)) this.removeOrphanSecret(w,secret)
    return this.getRequest(w,id)
  }) }
  moveRequest(w: string,id: string,collectionId: string|null) { return this.write(() => { this.owned('requests',w,id); if(collectionId!==null)this.owned('collections',w,collectionId); this.db.prepare('UPDATE requests SET collection_id=?,updated_at=? WHERE workspace_id=? AND id=?').run(collectionId,new Date().toISOString(),w,id); return this.getRequest(w,id) }) }
  deleteRequest(w: string,id: string) { return this.write(() => {
    const old=this.getRequest(w,id)
    this.db.prepare('UPDATE workspace_state SET selected_request_id=NULL WHERE workspace_id=? AND selected_request_id=?').run(w,id)
    this.db.prepare('DELETE FROM requests WHERE workspace_id=? AND id=?').run(w,id)
    for (const secret of secretIds(old.config)) this.removeOrphanSecret(w,secret)
  }) }
  duplicateRequest(w: string,id: string) { return this.write(() => {
    const original=this.getRequest(w,id),copies: {sourceId:string;id:string}[]=[]
    const clone=(value:StoredCredential):StoredCredential => {
      if(value.kind==='template')return {...value}
      const previous=copies.find(copy=>copy.sourceId===value.secretId)
      if(previous)return {kind:'secret',secretId:previous.id}
      const source=this.getSecret(w,value.secretId),secret=this.createSecret(w,source.storageMode,source.encryptedValue)
      copies.push({sourceId:source.id,id:secret.id})
      return {kind:'secret',secretId:secret.id}
    }
    const auth=original.config.auth
    const config:StoredRequestConfig={...original.config,auth:auth.mode==='none'?auth:auth.mode==='bearer'?{mode:'bearer',token:clone(auth.token)}:{mode:'basic',username:clone(auth.username),password:clone(auth.password)}}
    const name=Array.from(original.name).slice(0,LIMITS.nameCharacters-7).join('')+' (copy)'
    return {request:this.createRequest(w,name,original.collectionId,config),secretCopies:copies}
  }) }
  getState(w:string) { return this.read(() => {
    this.workspace(w)
    const row=this.db.prepare('SELECT workspace_id AS workspaceId,active_environment_id AS activeEnvironmentId,selected_request_id AS selectedRequestId FROM workspace_state WHERE workspace_id=?').get(w)
    const state=workspaceStateSchema.parse(row??{workspaceId:w,activeEnvironmentId:null,selectedRequestId:null})
    if(state.activeEnvironmentId&&!this.db.prepare('SELECT id FROM environments WHERE workspace_id=? AND id=?').get(w,state.activeEnvironmentId))state.activeEnvironmentId=null
    if(state.selectedRequestId&&!this.db.prepare('SELECT id FROM requests WHERE workspace_id=? AND id=?').get(w,state.selectedRequestId))state.selectedRequestId=null
    return state
  }) }
  setState(w:string,environmentId:string|null,requestId:string|null) { return this.write(() => {
    this.workspace(w);if(environmentId!==null)this.owned('environments',w,environmentId);if(requestId!==null)this.owned('requests',w,requestId)
    this.db.prepare('INSERT INTO workspace_state VALUES (?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET active_environment_id=excluded.active_environment_id,selected_request_id=excluded.selected_request_id').run(w,environmentId,requestId)
    return this.getState(w)
  }) }
  selectWorkspace(id:string|null) { return this.write(() => {if(id!==null)this.workspace(id);this.db.prepare("INSERT INTO app_settings VALUES ('lastWorkspaceId',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json").run(JSON.stringify(id))}) }
  getSelectedWorkspace() {return this.read(() => {const row=this.db.prepare("SELECT value_json AS value FROM app_settings WHERE key='lastWorkspaceId'").get();if(!row)return null;const id=uuidSchema.nullable().parse(JSON.parse(z.strictObject({value:z.string()}).parse(row).value));return id&&this.db.prepare('SELECT id FROM workspaces WHERE id=?').get(id)?id:null})}
  createSecret(w:string,storageMode:'secure'|'session',encryptedValue:Buffer|null) {return this.write(() => {
    this.workspace(w);const now=new Date().toISOString(),record=secretSchema.parse({id:randomUUID(),workspaceId:w,storageMode,encryptedValue,createdAt:now,updatedAt:now})
    this.db.prepare('INSERT INTO secrets VALUES (?,?,?,?,?,?)').run(record.id,w,record.encryptedValue,record.storageMode,now,now)
    return record
  })}
  getSecret(w:string,id:string) {return this.read(() => {this.owned('secrets',w,id);return secretSchema.parse(this.db.prepare('SELECT id,workspace_id AS workspaceId,encrypted_value AS encryptedValue,storage_mode AS storageMode,created_at AS createdAt,updated_at AS updatedAt FROM secrets WHERE workspace_id=? AND id=?').get(w,id))})}
  updateSecret(w:string,id:string,storageMode:'secure'|'session',encryptedValue:Buffer|null) {return this.write(() => {const old=this.getSecret(w,id),record=secretSchema.parse({...old,storageMode,encryptedValue,updatedAt:new Date().toISOString()});this.db.prepare('UPDATE secrets SET storage_mode=?,encrypted_value=?,updated_at=? WHERE workspace_id=? AND id=?').run(record.storageMode,record.encryptedValue,record.updatedAt,w,id);return record})}
  private references(w:string,id:string):string[] {
    const variables=z.array(z.strictObject({id:uuidSchema})).parse(this.db.prepare('SELECT id FROM variables WHERE workspace_id=? AND secret_id=?').all(w,id)).map(row=>row.id)
    const requests=this.listRequests(w).filter(row=>secretIds(this.getRequest(w,row.id).config).includes(id)).map(row=>row.id)
    return [...variables,...requests]
  }
  private assertSecretAvailable(w:string,id:string,owner?:string) {if(this.references(w,id).some(reference=>reference!==owner))throw new RepositoryError('VALIDATION')}
  private removeOrphanSecret(w:string,id:string) {if(this.references(w,id).length===0)this.db.prepare('DELETE FROM secrets WHERE workspace_id=? AND id=?').run(w,id)}
  deleteSecret(w:string,id:string) {return this.write(() => {this.owned('secrets',w,id);this.assertSecretAvailable(w,id);this.db.prepare('DELETE FROM secrets WHERE workspace_id=? AND id=?').run(w,id)})}
  listVariables(w:string,environmentId:string|null) {return this.read(() => {
    this.workspace(w);if(environmentId!==null)this.owned('environments',w,environmentId)
    const rows=z.array(z.strictObject({id:uuidSchema,workspaceId:uuidSchema,environmentId:uuidSchema.nullable(),key:variableKeySchema,isSensitive:z.union([z.literal(0),z.literal(1)]),plainValue:z.string().nullable(),secretId:uuidSchema.nullable(),createdAt:z.iso.datetime(),updatedAt:z.iso.datetime()})).parse(this.db.prepare('SELECT id,workspace_id AS workspaceId,environment_id AS environmentId,key,is_sensitive AS isSensitive,plain_value AS plainValue,secret_id AS secretId,created_at AS createdAt,updated_at AS updatedAt FROM variables WHERE workspace_id=? AND environment_id IS ? ORDER BY key,id').all(w,environmentId))
    return rows.map(row=>storedVariableSchema.parse({...row,isSensitive:row.isSensitive===1}))
  })}
  getVariable(w:string,id:string):StoredVariable {return this.read(() => {this.owned('variables',w,id);const scope=z.strictObject({environmentId:uuidSchema.nullable()}).parse(this.db.prepare('SELECT environment_id AS environmentId FROM variables WHERE workspace_id=? AND id=?').get(w,id));const value=this.listVariables(w,scope.environmentId).find(row=>row.id===id);if(!value)throw new RepositoryError('NOT_FOUND');return value})}
  upsertVariable(w:string,environmentId:string|null,key:string,input:VariableValue) {return this.write(() => {
    this.workspace(w);if(environmentId!==null)this.owned('environments',w,environmentId)
    key=variableKeySchema.parse(key);const value=variableValueSchema.parse(input)
    const old=this.listVariables(w,environmentId).find(row=>row.key===key)
    if(!old&&this.listVariables(w,environmentId).length>=LIMITS.variablesPerScope)throw new RepositoryError('VALIDATION')
    if(value.secretId){this.owned('secrets',w,value.secretId);this.assertSecretAvailable(w,value.secretId,old?.id)}
    const id=old?.id??randomUUID(),now=new Date().toISOString()
    if(old)this.db.prepare('UPDATE variables SET is_sensitive=?,plain_value=?,secret_id=?,updated_at=? WHERE workspace_id=? AND id=?').run(value.isSensitive?1:0,value.plainValue,value.secretId,now,w,id)
    else this.db.prepare('INSERT INTO variables VALUES (?,?,?,?,?,?,?,?,?)').run(id,w,environmentId,key,value.isSensitive?1:0,value.plainValue,value.secretId,now,now)
    if(old?.secretId)this.removeOrphanSecret(w,old.secretId)
    return this.getVariable(w,id)
  })}
  deleteVariable(w:string,id:string) {return this.write(() => {const old=this.getVariable(w,id);this.db.prepare('DELETE FROM variables WHERE workspace_id=? AND id=?').run(w,id);if(old.secretId)this.removeOrphanSecret(w,old.secretId)})}
}
