import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, ChakraProvider, NativeSelect, Text, defaultSystem } from '@chakra-ui/react'
import { themeSchema, type ThemePreference } from '../../shared/theme'
const ThemeContext = createContext<{ preference: ThemePreference; busy: boolean; error: string | null; change: (value: ThemePreference) => Promise<void> } | null>(null)

/** Bundled Chakra v3 class/semantic-token appearance; SQLite owns the preference. */
export function LocalProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>('system'), [busy, setBusy] = useState(true), [error, setError] = useState<string | null>(null)
  const running = useRef(false)
  useEffect(() => {
    let active = true
    void window.offlineApi.app.getTheme().then(result => {
      if (!active) return
      if (result.ok) setPreference(result.data)
      else setError('Theme preference could not be loaded. System appearance is in use; choose a theme to retry.')
    }).catch(() => { if (active) setError('Theme preference could not be loaded. System appearance is in use; choose a theme to retry.') }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = preference === 'dark' || (preference === 'system' && system.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.classList.toggle('light', !dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    }
    apply(); system.addEventListener('change', apply)
    return () => system.removeEventListener('change', apply)
  }, [preference])
  async function change(value: ThemePreference) {
    if (running.current || busy) return
    running.current = true; setBusy(true); setError(null)
    try {
      const result = await window.offlineApi.app.setTheme(value)
      if (result.ok) setPreference(result.data)
      else setError('Theme could not be saved. Your previous preference and draft have been kept. Try again.')
    } catch { setError('Theme could not be saved. Your previous preference and draft have been kept. Try again.') }
    finally { running.current = false; setBusy(false) }
  }
  return <ChakraProvider value={defaultSystem}><ThemeContext.Provider value={{ preference, busy, error, change }}>{children}</ThemeContext.Provider></ChakraProvider>
}
export function ThemeControl() {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('Theme provider missing')
  return <Box>
    <NativeSelect.Root width="140px" size="sm" disabled={theme.busy}>
      <NativeSelect.Field aria-label="Theme" value={theme.preference} aria-describedby={theme.error ? 'theme-error' : undefined} onChange={event => { void theme.change(themeSchema.parse(event.target.value)) }}>
        <option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option>
      </NativeSelect.Field><NativeSelect.Indicator />
    </NativeSelect.Root>
    {theme.error && <Text id="theme-error" role="alert" fontSize="sm" maxW="320px">{theme.error}</Text>}
  </Box>
}
