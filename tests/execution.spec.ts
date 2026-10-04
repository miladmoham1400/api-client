import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron, expect, test } from '@playwright/test'
import type { RequestDraft } from '../src/shared/requests'
import { startFixture } from './fixtures/http'

test('sandboxed preload sends captured native requests, receives immediate completion and cleans up execution lifetimes', async () => {
  const fixture = await startFixture(), tls = await startFixture(true), directory = mkdtempSync(join(tmpdir(), 'api-client-send-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  const application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
  let closed = false
  try {
    const page = await application.firstWindow(), rendererRemoteRequests: string[] = []
    page.on('request', request => { if (/^https?:/.test(request.url())) rendererRemoteRequests.push(request.url()) })
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
    const workspace = await page.evaluate(async () => {
      const result = await window.offlineApi.workspaces.create('Transport fixture')
      if (!result.ok || !result.data.selectedWorkspaceId) throw new Error('Workspace creation failed')
      return result.data.selectedWorkspaceId
    })
    const draft: RequestDraft = { name: 'Synthetic', method: 'POST', urlTemplate: '{{base_url}}/echo', body: { kind: 'json', text: ' { "message": "سلام" } ' }, auth: { mode: 'bearer', token: { kind: 'value', value: '{{fixture_token}}' } } }
    const saved = await page.evaluate(async ({ w, base, draft }) => {
      await window.offlineApi.variables.upsert(w, null, 'base_url', base, false)
      await window.offlineApi.variables.upsert(w, null, 'fixture_token', 'synthetic-fixture-token', true)
      const result = await window.offlineApi.requests.create(w, { ...draft, collectionId: null })
      if (!result.ok || !result.data.editor) throw new Error('Request creation failed')
      return result.data.editor.id
    }, { w: workspace, base: fixture.url, draft })
    const send = (draft: RequestDraft, request: string | null = null) => page.evaluate(async ({ w, draft, request }) => {
      let resolveCompletion: ((value: import('../src/shared/results').ExecutionCompleted) => void) | undefined
      const completion = new Promise<import('../src/shared/results').ExecutionCompleted>(resolve => { resolveCompletion = resolve })
      let acceptedId: string | undefined, acceptanceFirst = false, count = 0
      const stop = window.offlineApi.execution.onCompleted(value => { count++; acceptanceFirst = acceptedId === value.executionId; resolveCompletion?.(value) })
      try {
        const accepted = await window.offlineApi.execution.send(w, request, draft, null)
        if (!accepted.ok) return { accepted, completion: null, acceptanceFirst, count }
        acceptedId = accepted.data.executionId
        return { accepted, completion: await completion, acceptanceFirst, count }
      } finally { stop(); stop() }
    }, { w: workspace, draft, request })
    const result = await send(draft, saved)
    expect(result.accepted.ok).toBe(true); expect(result.acceptanceFirst).toBe(true); expect(result.count).toBe(1)
    expect(result.completion?.result).toMatchObject({ statusCode: 200, body: { kind: 'text' } })
    if (!result.completion || !('statusCode' in result.completion.result) || result.completion.result.body.kind !== 'text') throw new Error('Missing response')
    expect(JSON.parse(result.completion.result.body.text)).toMatchObject({ method: 'POST', bodyBase64: Buffer.from(' { "message": "سلام" } ').toString('base64'), rawHeaders: expect.arrayContaining(['Authorization', 'Bearer synthetic-fixture-token']) })
    const persisted = await page.evaluate(({ w, id }) => window.offlineApi.requests.get(w, id), { w: workspace, id: saved })
    expect(persisted).toMatchObject({ ok: true, data: { editor: { urlTemplate: '{{base_url}}/echo', body: draft.body, auth: draft.auth } } })
    for (const [path, expected] of [['/status', { statusCode: 503 }], ['/gzip', { statusCode: 200, body: { kind: 'text', text: '{"message":"سلام"}' } }], ['/binary', { body: { kind: 'binary', sizeBytes: 3 } }], ['/bomb', { code: 'RESPONSE_TOO_LARGE' }], ['/corrupt/br', { code: 'DECOMPRESSION_FAILURE' }]] as const) {
      const value = await send({ name: 'Fixture', method: 'GET', urlTemplate: fixture.url + path })
      expect(value.completion?.result).toMatchObject(expected); expect(value.acceptanceFirst).toBe(true); expect(value.count).toBe(1)
    }
    expect((await send({ name: 'TLS', method: 'GET', urlTemplate: tls.url })).completion?.result).toMatchObject({ code: 'TLS_FAILURE' })
    expect((await send({ name: 'Redirect', method: 'GET', urlTemplate: fixture.url + '/redirect', followRedirects: true })).completion?.result).toMatchObject({ statusCode: 200, finalUrl: fixture.url + '/echo', redirectCount: 1 })
    const lifecycle = await page.evaluate(async ({ w, base }) => {
      let resolveCompletion: ((value: import('../src/shared/results').ExecutionCompleted) => void) | undefined
      const completion = new Promise<import('../src/shared/results').ExecutionCompleted>(resolve => { resolveCompletion = resolve })
      const stop = window.offlineApi.execution.onCompleted(value => resolveCompletion?.(value))
      try {
        const draft = { name: 'Hold', method: 'GET' as const, urlTemplate: base + '/hold' }
        const accepted = await window.offlineApi.execution.send(w, null, draft, null)
        const busy = await window.offlineApi.execution.send(w, null, draft, null)
        const deleted = await window.offlineApi.workspaces.delete(w)
        return { accepted, busy, deleted, completion: await completion }
      } finally { stop() }
    }, { w: workspace, base: fixture.url })
    expect(lifecycle.accepted.ok).toBe(true); expect(lifecycle.busy).toMatchObject({ ok: false, error: { code: 'REQUEST_BUSY' } })
    expect(lifecycle.deleted.ok).toBe(true); expect(lifecycle.completion.result).toMatchObject({ code: 'CANCELLED' })
    const replacement = await page.evaluate(async base => {
      const created = await window.offlineApi.workspaces.create('Reload fixture')
      if (!created.ok || !created.data.selectedWorkspaceId) throw new Error('Workspace creation failed')
      const w = created.data.selectedWorkspaceId
      window.offlineApi.execution.onCompleted(() => {})
      const accepted = await window.offlineApi.execution.send(w, null, { name: 'Hold', method: 'GET', urlTemplate: base + '/hold' }, null)
      return { w, accepted }
    }, fixture.url)
    expect(replacement.accepted.ok).toBe(true)
    await page.reload()
    const afterReload = await page.evaluate(async ({ w, base }) => {
      window.offlineApi.execution.onCompleted(() => {})
      return window.offlineApi.execution.send(w, null, { name: 'After reload', method: 'GET', urlTemplate: base + '/echo' }, null)
    }, { w: replacement.w, base: fixture.url })
    expect(afterReload.ok).toBe(true)
    expect(rendererRemoteRequests).toEqual([])
    await application.close()
    closed = true
    await expect.poll(() => new Promise<number>((resolve, reject) => fixture.server.getConnections((error, count) => error ? reject(error) : resolve(count)))).toBe(0)
  } finally {
    if (!closed) await application.close()
    await fixture.close(); await tls.close(); rmSync(directory, { recursive: true, force: true })
  }
})
