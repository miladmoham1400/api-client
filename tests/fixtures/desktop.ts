import { _electron } from '@playwright/test'

/** Test-only executable override for the exact packaged binary under acceptance. */
export function launchDesktop(options: Parameters<typeof _electron.launch>[0]) {
  const executablePath = process.env.API_CLIENT_EXECUTABLE
  return _electron.launch(executablePath ? { ...options, executablePath, args: [], chromiumSandbox: true } : options)
}
