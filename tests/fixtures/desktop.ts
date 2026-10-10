import { _electron } from '@playwright/test'
import { join } from 'node:path'

type LaunchOptions = NonNullable<Parameters<typeof _electron.launch>[0]>

/**
 * Specs isolate app data by pointing APPDATA/XDG_CONFIG_HOME at a temporary directory. Linux honors
 * XDG_CONFIG_HOME, but Electron on Windows resolves appData through the OS known-folder API and ignores
 * APPDATA, so on Windows the equivalent user-data directory is passed explicitly. Production startup is unchanged.
 */
export function isolationArgs(env: LaunchOptions['env']): string[] {
  if (process.platform !== 'win32') return []
  const appData = env?.APPDATA
  if (!appData) throw new Error('Windows desktop tests must set APPDATA to a temporary directory')
  return [`--user-data-dir=${join(appData, 'offline-api-client')}`]
}

/** Test-only executable override for the exact packaged binary under acceptance. */
export function launchDesktop(options: LaunchOptions) {
  const executablePath = process.env.API_CLIENT_EXECUTABLE
  const isolation = isolationArgs(options.env)
  return _electron.launch(executablePath
    ? { ...options, executablePath, args: isolation, chromiumSandbox: true }
    : { ...options, args: [...isolation, ...(options.args ?? [])] })
}
