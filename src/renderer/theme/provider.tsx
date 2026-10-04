import { useEffect, type ReactNode } from 'react'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'

/** System appearance only; saved theme preferences belong to TASK-026. */
export function LocalProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.classList.toggle('dark', system.matches)
      document.documentElement.classList.toggle('light', !system.matches)
      document.documentElement.style.colorScheme = system.matches ? 'dark' : 'light'
    }
    apply()
    system.addEventListener('change', apply)
    return () => system.removeEventListener('change', apply)
  }, [])
  return <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
}
