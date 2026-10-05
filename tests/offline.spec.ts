import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { connect } from 'node:net'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron, expect, test } from '@playwright/test'
import type { RequestDraft } from '../src/shared/requests'
import { workspaceExportSchema } from '../src/shared/transfer'
import { startFixture } from './fixtures/http'
import { shutdown } from './fixtures/shutdown'
const execute = promisify(execFile)

test('loopback-only integrated story: persistence, isolation, failures and safe transfer recovery', async () => {
  test.skip(process.env.API_CLIENT_OFFLINE_TEST !== '1', 'Run npm run test:offline for actual Linux egress isolation; regular smoke is not offline evidence')
  test.setTimeout(60_000)
  expect(process.platform).toBe('linux')
  expect(process.getuid?.()).not.toBe(0)
  const devices = readFileSync('/proc/net/dev', 'utf8').split('\n').filter(line => line.includes(':')).map(line => line.split(':')[0]?.trim())
  expect(devices).toEqual(['lo'])
  expect(readFileSync('/proc/net/route', 'utf8').trim().split('\n')).toHaveLength(1)
  const blocked = await new Promise<string>(resolve => {
    // RFC 5737 documentation address; no public service is contacted in this isolated namespace.
    const socket = connect({ host: '192.0.2.1', port: 443 })
    socket.once('connect', () => { socket.destroy(); resolve('CONNECTED') })
    socket.once('error', error => { socket.destroy(); resolve('code' in error ? String(error.code) : 'UNKNOWN') })
    socket.setTimeout(1000, () => { socket.destroy(); resolve('TIMEOUT') })
  })
  expect(blocked).toBe('ENETUNREACH')
  console.log('Offline proof: only lo, no IPv4 routes, non-root Electron, external probe ENETUNREACH')
  const directory = mkdtempSync(join(tmpdir(), 'api-client-offline-')), destination = join(directory, 'workspace.json'), upload = join(directory, 'fixture.txt')
  writeFileSync(upload, 'synthetic offline file')
  const fixture = await startFixture(), tls = await startFixture(true), other = await startFixture()
  const captures: string[] = []
  fixture.server.on('request', request => captures.push(request.url ?? ''))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  let app = await _electron.launch({ args: ['.'], chromiumSandbox: true, env }), closedNormally = false
  const diagnostics: string[] = []
  const observeDiagnostics = () => {
    for (const stream of [app.process().stdout, app.process().stderr]) stream?.on('data', (bytes: Buffer) => diagnostics.push(bytes.toString()))
  }
  observeDiagnostics()
  try {
    let page = await app.firstWindow()
    const browserRequests: string[] = []
    const observe = () => page.on('request', request => { if (/^https?:/.test(request.url())) browserRequests.push(request.url()) })
    observe()
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
    const ids = await page.evaluate(async base => {
      const api = window.offlineApi, created = await api.workspaces.create('Clinic API')
      if (!created.ok || !created.data.selectedWorkspaceId) throw new Error('Workspace setup failed')
      const w = created.data.selectedWorkspaceId, environment = await api.environments.create(w, 'Local'), row = await api.requests.newRow(w)
      if (!environment.ok || !row.ok) throw new Error('Environment setup failed')
      const e = environment.data.environments[0]?.id
      if (!e) throw new Error('Missing environment')
      await api.variables.upsert(w, null, 'base_url', 'http://127.0.0.1:1', false)
      await api.variables.upsert(w, e, 'base_url', base, false)
      await api.variables.upsert(w, e, 'token', 'synthetic-offline-token', true)
      await api.environments.select(w, e)
      const request = await api.requests.create(w, { name: 'Echo', collectionId: null, method: 'GET', urlTemplate: '{{base_url}}/echo', queryRows: [{ ...row.data, key: 'language', value: 'سلام' }], auth: { mode: 'bearer', token: { kind: 'value', value: '{{token}}' } } })
      if (!request.ok || !request.data.editor) throw new Error('Request setup failed')
      return { w, e, request: request.data.editor.id }
    }, fixture.url)
    expect(captures).toEqual([])
    await page.reload()
    await expect(page.getByLabel('Environment', { exact: true })).toHaveValue(ids.e)
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    const response = page.getByRole('region', { name: 'Response', exact: true })
    await expect(response).toContainText('Status 200')
    await expect(response).toContainText('bytes (decoded)')
    await expect(page.getByLabel('Response body text')).toContainText('Bearer synthetic-offline-token')
    expect(captures).toHaveLength(1)
    // Explicit preload sends exercise the same owned command/transport, without modifying the saved request.
    const send = (w: string, draft: RequestDraft, environment: string | null = null, cancel = false) => page.evaluate(async ({ w, draft, environment, cancel }) => {
      const selected = await window.offlineApi.workspaces.select(w)
      const scoped = await window.offlineApi.environments.select(w, environment)
      if (!selected.ok || !scoped.ok) throw new Error('Fixture selection failed')
      let finish: ((event: import('../src/shared/results').ExecutionCompleted) => void) | undefined
      const completion = new Promise<import('../src/shared/results').ExecutionCompleted>(resolve => { finish = resolve })
      const stop = window.offlineApi.execution.onCompleted(event => finish?.(event))
      try {
        const accepted = await window.offlineApi.execution.send(w, null, draft, environment)
        if (!accepted.ok) return accepted.error
        if (cancel) await window.offlineApi.execution.cancel(accepted.data.executionId)
        return (await completion).result
      } finally { stop() }
    }, { w, draft, environment, cancel })
    expect(await send(ids.w, { name: 'Cancel', method: 'GET', urlTemplate: fixture.url + '/hold' }, null, true)).toMatchObject({ code: 'CANCELLED' })
    expect(await send(ids.w, { name: 'Timeout', method: 'GET', urlTemplate: fixture.url + '/hold', timeoutMs: 100 })).toMatchObject({ code: 'TIMEOUT' })
    expect(await send(ids.w, { name: 'TLS', method: 'GET', urlTemplate: tls.url })).toMatchObject({ code: 'TLS_FAILURE' })
    expect(await send(ids.w, { name: 'Reset', method: 'GET', urlTemplate: fixture.url + '/reset' })).toMatchObject({ code: 'NETWORK_FAILURE' })
    const closed = await startFixture(), unreachable = closed.url
    await closed.close()
    expect(await send(ids.w, { name: 'Refusal', method: 'GET', urlTemplate: unreachable })).toMatchObject({ code: 'CONNECTION_REFUSED' })
    for (const status of [401, 500]) expect(await send(ids.w, { name: 'HTTP status', method: 'GET', urlTemplate: fixture.url + '/status/' + status })).toMatchObject({ statusCode: status })
    expect(await send(ids.w, { name: 'Missing variable', method: 'GET', urlTemplate: '{{missing}}/echo' })).toMatchObject({ code: 'VARIABLE_MISSING' })
    expect(await send(ids.w, { name: 'Recovery', method: 'GET', urlTemplate: fixture.url + '/echo' })).toMatchObject({ statusCode: 200 })
    const second = await page.evaluate(async base => {
      const api = window.offlineApi, result = await api.workspaces.create('Second workspace')
      if (!result.ok || !result.data.selectedWorkspaceId) throw new Error('Second workspace failed')
      const w = result.data.selectedWorkspaceId
      await api.variables.upsert(w, null, 'base_url', base, false)
      return w
    }, other.url)
    expect(await page.evaluate(({ w, id }) => window.offlineApi.requests.get(w, id), { w: second, id: ids.request })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(await page.evaluate(({ w, e }) => window.offlineApi.environments.select(w, e), { w: second, e: ids.e })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    const isolated = await send(second, { name: 'Isolated', method: 'GET', urlTemplate: '{{base_url}}/echo' })
    expect(isolated).toMatchObject({ statusCode: 200, finalUrl: other.url + '/echo' })
    await page.evaluate(async ({ w, e }) => { await window.offlineApi.workspaces.select(w); await window.offlineApi.environments.select(w, e) }, ids)
    await page.reload()
    await app.close(); closedNormally = true
    app = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
    closedNormally = false; observeDiagnostics()
    page = await app.firstWindow(); observe()
    await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Echo')
    await expect(page.getByLabel('Environment', { exact: true })).toHaveValue(ids.e)
    await expect(page.getByLabel('Response body text')).toHaveCount(0)
    const storage = await page.evaluate(async ({ w, e }) => {
      const result = await window.offlineApi.variables.list(w, e)
      if (!result.ok) throw new Error('Variables lost')
      return result.data.items.find(v => v.key === 'token')
    }, ids)
    if (!storage?.isSensitive) throw new Error('Secret metadata lost')
    console.log('Offline actual secret storage mode:', storage.storageMode)
    if (storage.storageMode === 'session') {
      expect(storage.hasValue).toBe(false)
      expect(await send(ids.w, { name: 'Missing secret', method: 'GET', urlTemplate: '{{base_url}}/echo', auth: { mode: 'bearer', token: { kind: 'value', value: '{{token}}' } } }, ids.e)).toMatchObject({ code: 'SECRET_UNAVAILABLE' })
    }
    expect(await page.evaluate(({ w, e, id }) => window.offlineApi.variables.upsert(w, e, 'token', 'synthetic-offline-reentered', true, id), { ...ids, id: storage.id })).toMatchObject({ ok: true })
    await page.evaluate(async w => {
      const api = window.offlineApi, row = await api.requests.newRow(w)
      if (!row.ok) throw new Error('Upload row setup failed')
      const result = await api.requests.create(w, { name: 'Upload requiring re-entry', collectionId: null, method: 'POST', urlTemplate: '{{base_url}}/echo', auth: { mode: 'bearer', token: { kind: 'value', value: 'synthetic-offline-literal' } }, body: { kind: 'multipart', rows: [{ id: row.data.id, key: 'file', kind: 'file', enabled: true, fileName: 'fixture.txt', fileSize: 22 }] } })
      if (!result.ok) throw new Error('Upload request setup failed')
    }, ids.w)
    const exporting = page.evaluate(w => window.offlineApi.transfer.exportWorkspace(w), ids.w)
    await execute('python3', ['tests/fixtures/native-upload-dialog.py', destination, 'Export workspace JSON'], { timeout: 15000 })
    expect(await exporting).toMatchObject({ ok: true, data: { status: 'saved' } })
    const bytes = readFileSync(destination, 'utf8'), dto = workspaceExportSchema.parse(JSON.parse(bytes))
    expect(bytes).not.toContain('synthetic-offline-token'); expect(bytes).not.toContain('synthetic-offline-reentered'); expect(bytes).not.toContain('synthetic-offline-literal')
    expect(dto.workspace.variables.find(v => v.key === 'token')).toMatchObject({ isSensitive: true, requiresValue: true })
    const importing = page.evaluate(() => window.offlineApi.transfer.chooseImport())
    await execute('python3', ['tests/fixtures/native-upload-dialog.py', destination, 'Import workspace JSON'], { timeout: 15000 })
    const preview = await importing
    if (!preview.ok || preview.data.status !== 'preview') throw new Error('Import preview failed')
    expect(preview.data.preview).toMatchObject({ missingVariables: 1, missingCredentials: 1, missingFiles: 1 })
    const countBeforeImport = captures.length
    const imported = await page.evaluate(token => window.offlineApi.transfer.importWorkspace(token), preview.data.preview.token)
    if (!imported.ok) throw new Error('Import failed')
    expect(imported.data.workspaceId).not.toBe(ids.w)
    expect(captures).toHaveLength(countBeforeImport)
    const restored = await page.evaluate(async w => {
      const api = window.offlineApi
      await api.workspaces.select(w)
      const environments = await api.environments.list(w)
      if (!environments.ok) throw new Error('Imported environment missing')
      const e = environments.data.environments[0]?.id
      if (!e) throw new Error('Imported scope missing')
      const variables = await api.variables.list(w, e)
      if (!variables.ok) throw new Error('Imported variables missing')
      const token = variables.data.items.find(v => v.key === 'token')
      if (!token) throw new Error('Imported secret metadata missing')
      const updated = await api.variables.upsert(w, e, 'token', 'synthetic-offline-import-reentered', true, token.id)
      if (!updated.ok) throw new Error('Imported credential re-entry failed')
      const requests = await api.requests.list(w)
      if (!requests.ok) throw new Error('Imported requests missing')
      const upload = requests.data.requests.find(r => r.name === 'Upload requiring re-entry')
      if (!upload) throw new Error('Imported upload missing')
      const editor = await api.requests.get(w, upload.id)
      if (!editor.ok || !editor.data.editor || editor.data.editor.body?.kind !== 'multipart') throw new Error('Imported upload config missing')
      return { w, e, upload: editor.data.editor }
    }, imported.data.workspaceId)
    expect(await send(restored.w, { name: 'Imported recovered', method: 'GET', urlTemplate: '{{base_url}}/echo', auth: { mode: 'bearer', token: { kind: 'value', value: '{{token}}' } } }, restored.e)).toMatchObject({ statusCode: 200 })
    expect(restored.upload.auth).toMatchObject({ mode: 'bearer', token: { kind: 'stored', hasValue: false } })
    expect(restored.upload.body?.kind).toBe('multipart')
    expect(await send(restored.w, { name: 'File not selected', method: 'POST', urlTemplate: '{{base_url}}/echo', body: restored.upload.body ?? { kind: 'none' } }, restored.e)).toMatchObject({ code: 'FILE_REQUIRED' })
    const selecting = page.evaluate(w => window.offlineApi.files.chooseUpload(w), restored.w)
    await execute('python3', ['tests/fixtures/native-upload-dialog.py', upload, 'Select upload file'], { timeout: 15000 })
    const selection = await selecting
    if (!selection.ok || !selection.data) throw new Error('File selection failed')
    const row = await page.evaluate(w => window.offlineApi.requests.newRow(w), restored.w)
    if (!row.ok) throw new Error('Row creation failed')
    expect(await send(restored.w, { name: 'File recovery', method: 'POST', urlTemplate: '{{base_url}}/echo', auth: { mode: 'bearer', token: { kind: 'value', value: 'synthetic-offline-reentered-literal' } }, body: { kind: 'multipart', rows: [{ id: row.data.id, key: 'file', kind: 'file', enabled: true, fileId: selection.data.fileId, fileName: selection.data.name, fileSize: selection.data.size }] } }, restored.e)).toMatchObject({ statusCode: 200 })
    expect(browserRequests).toEqual([])
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name))
    expect(resources.every(url => /^(file|data):/.test(url))).toBe(true)
    const dataFiles = await app.evaluate(({ app }) => {
      const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path')
      const directory = app.getPath('userData')
      return fs.readdirSync(directory).filter(name => name.startsWith('offline-api-client.sqlite')).map(name => Array.from(fs.readFileSync(path.join(directory, name))))
    })
    for (const bytes of dataFiles) {
      expect(Buffer.from(bytes).includes(Buffer.from('synthetic-offline-reentered'))).toBe(false)
      expect(Buffer.from(bytes).includes(Buffer.from('synthetic-offline-import-reentered'))).toBe(false)
    }
    for (const value of ['synthetic-offline-token', 'synthetic-offline-reentered', 'synthetic-offline-import-reentered', 'synthetic-offline-literal', 'synthetic-offline-reentered-literal']) expect(diagnostics.join('')).not.toContain(value)
    await app.close(); closedNormally = true
  } finally { if (!closedNormally) await shutdown(app); await fixture.close(); await tls.close(); await other.close(); rmSync(directory, { recursive: true, force: true }) }
})
