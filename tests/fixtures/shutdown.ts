import type { ElectronApplication } from '@playwright/test'

/** Forced fixture teardown only. Never count this as normal-close/persistence evidence. */
export async function shutdown(application: ElectronApplication): Promise<void> {
  if (application.process().exitCode !== null) return
  const closed = application.waitForEvent('close')
  // An AppImage runtime is a parent launcher: killing it alone leaves Electron alive.
  // Exit the isolated Electron fixture itself so the launcher can also clean up.
  await application.evaluate(({ app }) => { setImmediate(() => app.exit(0)) })
  await closed
}
