import type { ElectronApplication } from '@playwright/test'

/** Test teardown only. Normal close decisions are exercised explicitly in navigation.spec.ts. */
export async function shutdown(application: ElectronApplication): Promise<void> {
  if (application.process().exitCode !== null) return
  const closed = application.waitForEvent('close')
  // Force termination of the isolated fixture, never count this as normal-close evidence.
  application.process().kill('SIGKILL')
  await closed
}
