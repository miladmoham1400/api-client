import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

/** Local semantic colors also apply to portalled menus and dialogs. */
export const glassSystem = createSystem(defaultConfig, defineConfig({
  theme: {
    tokens: {
      fonts: {
        body: { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
        heading: { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: { base: '#edf2f8', _dark: '#0b1020' } },
          panel: { value: { base: '#f9fbff', _dark: '#151d31' } },
          subtle: { value: { base: '#e8eef7', _dark: '#182238' } },
          muted: { value: { base: '#e1e8f3', _dark: '#1c2941' } },
          emphasized: { value: { base: '#d8e6fa', _dark: '#25385b' } },
        },
        fg: {
          DEFAULT: { value: { base: '#25324b', _dark: '#e2e9f5' } },
          muted: { value: { base: '#5b6b83', _dark: '#9baac1' } },
          subtle: { value: { base: '#64748b', _dark: '#899bb6' } },
          inverted: { value: { base: '#f8fbff', _dark: '#101725' } },
        },
        border: {
          DEFAULT: { value: { base: '#ccd7e7', _dark: '#2a3851' } },
          muted: { value: { base: '#dbe3ef', _dark: '#223049' } },
          emphasized: { value: { base: '#9eb4d2', _dark: '#435675' } },
        },
      },
    },
  },
}))
