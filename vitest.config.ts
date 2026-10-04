import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { include: ['tests/shared/**/*.test.ts', 'tests/main/**/*.test.ts', 'tests/preload/**/*.test.ts'], environment: 'node' } })
