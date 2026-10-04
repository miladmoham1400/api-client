import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { include: ['tests/shared/**/*.test.ts'], environment: 'node' } })
