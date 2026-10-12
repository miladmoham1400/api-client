import { defineConfig } from '@playwright/test'

// TASK-037 diagnostic-only config: runs task037-evidence/*.diag.spec.ts, never part of the project suite.
export default defineConfig({ testDir: '.', testMatch: '**/*.diag.spec.ts', workers: 1, timeout: 60_000, reporter: 'list' })
