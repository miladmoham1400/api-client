import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { z } from 'zod'
import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'

const manifestSchema = z.strictObject({ workspace: z.uuid(), environment: z.uuid(), request: z.uuid(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')

test('installed Linux app preserves the same synthetic configuration across actual package removal/reinstall', async () => {
  const directory = process.env.API_CLIENT_PRESERVATION_DIR, phase = process.env.API_CLIENT_PRESERVATION_PHASE
  if (!directory || !/^\/tmp\/api-client-task028-preservation-[a-zA-Z0-9]+$/.test(directory)) throw new Error('Dedicated temporary preservation directory required')
  if (phase !== 'seed' && phase !== 'verify') throw new Error('Explicit seed or verify phase required')
  expect(process.platform).toBe('linux')
  expect(process.env.API_CLIENT_OFFLINE_TEST).toBe('1')
  expect(process.env.API_CLIENT_EXECUTABLE).toBe('/opt/offline-api-client/offline-api-client')
  const manifestFile = join(directory, 'preservation.json'), databaseFile = join(directory, 'offline-api-client', 'offline-api-client.sqlite')
  if (phase === 'seed') expect(existsSync(manifestFile)).toBe(false)
  const previous = phase === 'verify' ? manifestSchema.parse(JSON.parse(readFileSync(manifestFile, 'utf8'))) : null
  // Compare before app startup can modify SQLite/WAL; removal/reinstallation must preserve exact bytes.
  if (previous) expect(hash(databaseFile)).toBe(previous.sha256)
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(entry[0]))), XDG_CONFIG_HOME: directory, APPDATA: directory }
  const application = await launchDesktop({ chromiumSandbox: true, env })
  let normallyClosed = false
  try {
    expect(await application.evaluate(({ app }) => ({ packaged: app.isPackaged, directory: app.getPath('userData') }))).toEqual({ packaged: true, directory: join(directory, 'offline-api-client') })
    const page = await application.firstWindow()
    if (phase === 'seed') {
      const ids = await page.evaluate(async () => {
        const api = window.offlineApi, created = await api.workspaces.create('Synthetic uninstall preservation')
        if (!created.ok || !created.data.selectedWorkspaceId) throw new Error('Workspace setup failed')
        const workspace = created.data.selectedWorkspaceId, env = await api.environments.create(workspace, 'Local')
        if (!env.ok || !env.data.environments[0]) throw new Error('Environment setup failed')
        const environment = env.data.environments[0].id
        const variable = await api.variables.upsert(workspace, environment, 'base_url', 'http://127.0.0.1:1', false)
        const selected = await api.environments.select(workspace, environment)
        const saved = await api.requests.create(workspace, { name: 'Preserved saved request', collectionId: null, method: 'GET', urlTemplate: '{{base_url}}/echo' })
        const theme = await api.app.setTheme('dark')
        if (!variable.ok || !selected.ok || !saved.ok || !saved.data.editor || !theme.ok) throw new Error('Saved configuration setup failed')
        return { workspace, environment, request: saved.data.editor.id }
      })
      await application.close(); normallyClosed = true
      writeFileSync(manifestFile, JSON.stringify({ ...ids, sha256: hash(databaseFile) }))
    } else {
      if (!previous) throw new Error('Missing preservation evidence')
      await expect(page.getByLabel('Request name', { exact: true })).toHaveValue('Preserved saved request')
      await expect(page.getByLabel('Request URL', { exact: true })).toHaveValue('{{base_url}}/echo')
      await expect(page.getByLabel('Workspace', { exact: true })).toHaveValue(previous.workspace)
      await expect(page.getByLabel('Environment', { exact: true })).toHaveValue(previous.environment)
      await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('dark')
      const state = await page.evaluate(async ({ workspace, environment, request }) => ({ request: await window.offlineApi.requests.get(workspace, request), variables: await window.offlineApi.variables.list(workspace, environment) }), previous)
      expect(state).toMatchObject({ request: { ok: true, data: { editor: { id: previous.request } } }, variables: { ok: true, data: { items: [{ key: 'base_url', value: 'http://127.0.0.1:1' }] } } })
      await application.close(); normallyClosed = true
    }
  } finally { if (!normallyClosed) await shutdown(application) }
})
