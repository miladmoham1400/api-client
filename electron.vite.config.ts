import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [
      react(),
      {
        name: 'production-csp',
        apply: 'build',
        transformIndexHtml(html) {
          return html.replace("connect-src 'self' ws://localhost:* ws://127.0.0.1:*", "connect-src 'none'")
        }
      }
    ]
  }
})
