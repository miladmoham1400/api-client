import { shutdown } from './fixtures/shutdown'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { _electron, expect, test } from '@playwright/test'
import type { RequestDraft } from '../src/shared/requests'
import { startRedirectFixture } from './fixtures/redirects'

test('sandboxed Electron follows redirects, strips credentials permanently and rejects verified HTTPS downgrade', async () => {
  const a = await startRedirectFixture(), b = await startRedirectFixture(), secure = await startRedirectFixture(true)
  const directory = mkdtempSync(join(tmpdir(), 'api-client-redirects-'))
  // Test process trusts only our public fixture certificate in addition to normal roots; no TLS bypass.
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory, NODE_EXTRA_CA_CERTS: join(process.cwd(), 'tests/fixtures/tls-test-only.crt') }
  const application = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await application.firstWindow()
    const workspace = await page.evaluate(async () => {
      const result = await window.offlineApi.workspaces.create('Redirect fixture')
      if (!result.ok || !result.data.selectedWorkspaceId) throw new Error('Missing workspace')
      return result.data.selectedWorkspaceId
    })
    const send = (draft: RequestDraft) => page.evaluate(async ({ w, draft }) => {
      let finish: ((value: import('../src/shared/results').ExecutionCompleted) => void) | undefined
      const completed = new Promise<import('../src/shared/results').ExecutionCompleted>(resolve => { finish = resolve })
      const stop = window.offlineApi.execution.onCompleted(value => finish?.(value))
      try {
        const accepted = await window.offlineApi.execution.send(w, null, draft, null)
        if (!accepted.ok) throw new Error('Send rejected')
        const completion = await completed
        if (completion.executionId !== accepted.data.executionId) throw new Error('Wrong execution completion')
        return completion.result
      } finally { stop() }
    }, { w: workspace, draft })
    a.routes.set('/start', { status: 307, location: b.url + '/return', headers: { 'Set-Cookie': 'fixture=response-only' } })
    b.routes.set('/return', { status: 308, location: a.url + '/echo' })
    const headerRows = [['Authorization', 'Bearer synthetic'], ['Proxy-Authorization', 'Basic synthetic'], ['Cookie', 'fixture=synthetic']].map(([key, value]) => ({ id: randomUUID(), key: key!, value: value!, enabled: true }))
    const text = '原文 سلام', draft: RequestDraft = { name: 'Replay', method: 'POST', urlTemplate: a.url + '/start', followRedirects: true, body: { kind: 'raw', text, mediaType: 'text/plain' }, headerRows }
    expect(await send({ ...draft, followRedirects: false })).toMatchObject({ statusCode: 307, redirectCount: 0, finalUrl: a.url + '/start' })
    a.received.length = 0
    expect(await send(draft)).toMatchObject({ statusCode: 200, redirectCount: 2, finalUrl: a.url + '/echo' })
    expect(a.received[0]?.headers.map(header => header.name.toLowerCase())).toEqual(expect.arrayContaining(['authorization', 'proxy-authorization', 'cookie']))
    for (const request of [b.received[0], a.received[1]]) {
      expect(request).toMatchObject({ method: 'POST', bodyBase64: Buffer.from(text).toString('base64'), bodyLength: Buffer.byteLength(text) })
      expect(request?.headers.filter(header => ['authorization', 'proxy-authorization', 'cookie'].includes(header.name.toLowerCase()))).toEqual([])
    }
    a.received.length = 0
    secure.routes.set('/down', { status: 302, location: a.url + '/echo' })
    expect(await send({ name: 'TLS downgrade', method: 'GET', urlTemplate: secure.url + '/down', followRedirects: true })).toMatchObject({ code: 'REDIRECT_DOWNGRADE' })
    expect(secure.received).toHaveLength(1); expect(a.received).toHaveLength(0)
    secure.routes.set('/start', { status: 303, location: '/echo' })
    expect(await send({ ...draft, urlTemplate: secure.url + '/start' })).toMatchObject({ statusCode: 200, redirectCount: 1, finalUrl: secure.url + '/echo' })
    expect(secure.received.at(-1)).toMatchObject({ method: 'GET', bodyLength: 0 })
    expect(secure.received.at(-1)?.headers.filter(header => header.name.toLowerCase().startsWith('content-'))).toEqual([])
    a.routes.set('/loop', { status: 302, location: '/loop' })
    expect(await send({ name: 'Loop', method: 'GET', urlTemplate: a.url + '/loop', followRedirects: true })).toMatchObject({ code: 'REDIRECT_LIMIT' })
    // A terminal redirect error must release the single execution slot.
    expect(await send({ name: 'After error', method: 'GET', urlTemplate: a.url + '/echo' })).toMatchObject({ statusCode: 200, redirectCount: 0 })
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  } finally { await shutdown(application); await Promise.all([a.close(), b.close(), secure.close()]); rmSync(directory, { recursive: true, force: true }) }
})
