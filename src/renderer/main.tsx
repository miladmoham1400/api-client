import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Box, Button, Dialog, Flex, Heading, Input, NativeSelect, Portal, Tabs, Text, VStack } from '@chakra-ui/react'
import type { Bootstrap } from '../shared/desktop-api'
import { LocalProvider } from './theme/provider'
import './shell.css'
import { useWorkspaces } from './features/workspaces/use-workspaces'
import { WorkspaceControls } from './features/workspaces/controls'

type Startup = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Bootstrap }

function Shell() {
  const [startup, setStartup] = useState<Startup>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const closeButton = useRef<HTMLButtonElement>(null)
  const workspaces = useWorkspaces(startup.status === 'ready' && startup.data.database.status === 'ready')
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const result = await window.offlineApi.app.getBootstrap()
        if (active) setStartup(result.ok ? { status: 'ready', data: result.data } : { status: 'error' })
      } catch {
        if (active) setStartup({ status: 'error' })
      }
    }
    void load()
    return () => { active = false }
  }, [attempt])

  if (startup.status === 'loading') return <VStack p="8" align="start" role="status"><Heading>Offline API Client</Heading><Text>Opening local workspace storage…</Text></VStack>
  if (startup.status === 'error') return <VStack p="8" align="start"><Box role="alert"><Heading>Client unavailable</Heading><Text>Local startup information could not be loaded. Try again or restart the app.</Text></Box><Button onClick={() => { setStartup({ status: 'loading' }); setAttempt(value => value + 1) }}>Retry startup</Button></VStack>
  if (startup.data.database.status === 'unavailable') return <VStack p="8" align="start" role="alert"><Heading>Database unavailable</Heading><Text>{startup.data.database.message}</Text><Text overflowWrap="anywhere">Database location: {startup.data.database.path}</Text></VStack>

  return <Flex direction="column" h="100dvh" bg="bg" color="fg">
    <Flex as="header" gap="3" p="3" borderBottomWidth="1px" align="center" flexWrap="wrap">
      <Heading size="md" mr="2">Offline API Client</Heading>
      <WorkspaceControls controller={workspaces} placement="top" />
      <NativeSelect.Root width="190px" disabled><NativeSelect.Field aria-label="Environment"><option>Environments unavailable</option></NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
      <Button disabled variant="outline" size="sm">Variables</Button>
      <Button disabled variant="outline" size="sm">System theme</Button>
      <Dialog.Root initialFocusEl={() => closeButton.current}>
        <Dialog.Trigger asChild><Button size="sm" variant="ghost">About this shell</Button></Dialog.Trigger>
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
          <Dialog.Header><Dialog.Title>Local desktop shell</Dialog.Title></Dialog.Header>
          <Dialog.Body><Dialog.Description>Workspaces can be created, renamed, selected and deleted locally. Request editing, sending and variables are not available yet. No sample data has been created or requests sent. Appearance follows your system.</Dialog.Description></Dialog.Body>
          <Dialog.Footer><Dialog.CloseTrigger asChild><Button ref={closeButton}>Close</Button></Dialog.CloseTrigger></Dialog.Footer>
        </Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>
    </Flex>
    <Flex flex="1" minH="0">
      <VStack as="aside" aria-label="Collections and requests" align="stretch" gap="4" w="250px" minW="210px" p="4" overflow="auto" borderRightWidth="1px">
        <Heading size="sm">Workspace</Heading>
        <WorkspaceControls controller={workspaces} placement="sidebar" />
        <Heading size="sm">Collections</Heading><Button disabled variant="outline" size="sm">Create Collection</Button>
        <Heading size="sm">Root requests</Heading><Button disabled variant="outline" size="sm">Create Request</Button>
      </VStack>
      <Flex as="main" direction="column" flex="1" minW="0" minH="0" p="4" gap="3" overflow="auto">
        <Box as="section" aria-label="Request editor" flex="1" minH="220px" overflow="auto">
          <Flex justify="space-between" align="center" mb="3"><Heading size="md">No request selected</Heading><Button disabled size="sm">Save</Button></Flex>
          <Flex gap="2" mb="3">
            <NativeSelect.Root width="110px" flexShrink="0" disabled><NativeSelect.Field aria-label="HTTP method"><option>Method</option></NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
            <Input disabled aria-label="Request URL" placeholder="Request URL" />
            <Button disabled>Send</Button><Button disabled variant="outline">Cancel</Button>
          </Flex>
          <Tabs.Root defaultValue="params" size="sm">
            <Tabs.List aria-label="Request fields">{['Params', 'Headers', 'Body', 'Auth', 'Settings'].map(name => <Tabs.Trigger key={name} value={name.toLowerCase()}>{name}</Tabs.Trigger>)}</Tabs.List>
            {['Params', 'Headers', 'Body', 'Auth', 'Settings'].map(name => <Tabs.Content key={name} value={name.toLowerCase()}><Text color="fg.muted">Request editing is not available yet.</Text></Tabs.Content>)}
          </Tabs.Root>
        </Box>
        <Box as="section" aria-label="Response" borderWidth="1px" borderRadius="md" p="4" h="260px" minH="180px" maxH="60vh" flexShrink="0" overflow="auto" resize="vertical">
          <Flex justify="space-between" mb="3" align="center"><Heading size="sm">Response</Heading><Text fontSize="sm" color="fg.muted">Status — · Duration — · Size —</Text></Flex>
          <Tabs.Root defaultValue="body" size="sm">
            <Flex justify="space-between" align="center"><Tabs.List aria-label="Response views"><Tabs.Trigger value="body">Body</Tabs.Trigger><Tabs.Trigger value="headers">Headers</Tabs.Trigger></Tabs.List><Button disabled size="xs" variant="outline">Raw / Pretty</Button></Flex>
            <Tabs.Content value="body"><Text>No response. Request execution is not available yet.</Text></Tabs.Content>
            <Tabs.Content value="headers"><Text>No response headers.</Text></Tabs.Content>
          </Tabs.Root>
        </Box>
      </Flex>
    </Flex>
    <Box as="footer" borderTopWidth="1px" px="4" py="2"><Text fontSize="xs" color="fg.muted">Local storage ready · No request execution</Text></Box>
  </Flex>
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing renderer root')
createRoot(root).render(<StrictMode><LocalProvider><Shell /></LocalProvider></StrictMode>)
