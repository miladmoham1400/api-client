import { launchDesktop } from './fixtures/desktop'
import { shutdown } from './fixtures/shutdown'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'

test('real Electron reports safeStorage capability without exposing synthetic values', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'api-client-secret-capability-'))
  const env = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[0] !== 'ELECTRON_RUN_AS_NODE')), XDG_CONFIG_HOME: directory, APPDATA: directory }
  const application = await launchDesktop({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'No request selected' })).toBeVisible()
    const capability = await application.evaluate(({ safeStorage }) => {
      const available = safeStorage.isEncryptionAvailable(), backend = process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : 'platform'
      const secure = available && !['basic_text', 'unknown'].includes(backend)
      if (!secure) return { available, backend, mode: 'session', roundTrip: null, plaintextAbsent: null }
      const fixture = 'synthetic-electron-secret-fixture', encrypted = safeStorage.encryptString(fixture)
      return { available, backend, mode: 'secure', roundTrip: safeStorage.decryptString(encrypted) === fixture, plaintextAbsent: !encrypted.includes(Buffer.from(fixture)) }
    })
    console.log('Actual safeStorage capability:', capability)
    if (capability.mode === 'secure') { expect(capability.roundTrip).toBe(true); expect(capability.plaintextAbsent).toBe(true) }
    else { expect(capability.roundTrip).toBeNull(); expect(capability.plaintextAbsent).toBeNull() }
    expect(await page.evaluate(() => typeof Reflect.get(window.offlineApi, 'secrets'))).toBe('undefined')
  } finally { await shutdown(application); rmSync(directory, { recursive: true, force: true }) }
})
