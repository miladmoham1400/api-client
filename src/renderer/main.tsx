import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, ChakraProvider, defaultSystem, Heading, Text, VStack } from '@chakra-ui/react'

function App() {
  const [ready, setReady] = useState(false)
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
