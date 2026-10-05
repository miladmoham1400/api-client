import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules/**', 'out/**', 'dist/**', 'test-results/**', 'playwright-report/**', '.tools/**', 'graphify-out/**'] },
  js.configs.recommended,
  tseslint.configs.recommended
)
