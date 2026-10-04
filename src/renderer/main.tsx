import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, ChakraProvider, defaultSystem, Heading, Text, VStack } from '@chakra-ui/react'

import type { Bootstrap } from '../shared/desktop-api'

function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null)
  useEffect(() => {
    let active = true
    void window.offlineApi.app.getBootstrap().then(result => {
      if (active && result.ok) setBootstrap(result.data)
    })
    return () => { active = false }
  }, [])
  const [ready, setReady] = useState(false)
  if (bootstrap?.database.status === 'unavailable') return (
    <VStack align="start" gap="4" p="8" role="alert">
      <Heading>Database unavailable</Heading>
      <Text>{bootstrap.database.message}</Text>
      <Text>Database location: {bootstrap.database.path}</Text>
    </VStack>
  )
  return (
    <VStack align="start" gap="4" p="8">
      <Heading>Offline API Client</Heading>
      <Text>Local desktop toolchain baseline.</Text>
      <Button onClick={() => setReady(true)}>Check local UI</Button>
      {ready && <Text role="status">Local UI ready</Text>}
    </VStack>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing renderer root')
createRoot(root).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}><App /></ChakraProvider>
  </StrictMode>
)
