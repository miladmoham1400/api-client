import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Box, Button, Dialog, Flex, Heading, Portal, Text, VStack } from '@chakra-ui/react'
import type { Bootstrap } from '../shared/desktop-api'
import { LocalProvider } from './theme/provider'
import './shell.css'
import { useWorkspaces } from './features/workspaces/use-workspaces'
import { CollectionSidebar } from './features/collections/sidebar'
import { WorkspaceControls } from './features/workspaces/controls'
import { useRequests } from './features/requests/controller'
import { VariableControls } from './features/variables/controls'
import { ResponseViewer } from './features/response/viewer'
import { RequestEditor } from './features/requests/editor'
import type { WorkspaceController } from './features/workspaces/use-workspaces'

type Startup = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Bootstrap }

function Shell() {
  const [startup, setStartup] = useState<Startup>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
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

  return <Desktop workspaces={workspaces} />
}
function Desktop({ workspaces }: { workspaces: WorkspaceController }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const requests = useRequests(workspaces.snapshot?.selectedWorkspaceId ?? null)
  return <Flex direction="column" h="100dvh" bg="bg" color="fg">
    <Flex as="header" gap="3" p="3" borderBottomWidth="1px" align="center" flexWrap="wrap">
      <Heading size="md" mr="2">Offline API Client</Heading>
      <WorkspaceControls controller={workspaces} locked={requests.dirty || requests.busy || requests.sending} placement="top" />
      <VariableControls key={workspaces.snapshot?.selectedWorkspaceId ?? 'none'} workspace={workspaces.snapshot?.selectedWorkspaceId ?? null} />
      <Button disabled variant="outline" size="sm">System theme</Button>
      <Dialog.Root initialFocusEl={() => closeButton.current}>
        <Dialog.Trigger asChild><Button size="sm" variant="ghost">About this shell</Button></Dialog.Trigger>
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
          <Dialog.Header><Dialog.Title>Local desktop shell</Dialog.Title></Dialog.Header>
          <Dialog.Body><Dialog.Description>Workspaces and collections can be managed locally. Existing saved requests can move between collections and root. Request fields, JSON/raw bodies and timeout/redirect settings support explicit Save. Environments and variables can be managed locally. Auth editing supports explicit Save. Send and Cancel execute the current draft without saving it. Responses are shown as safe text, with raw headers and optional JSON formatting. No sample data or automatic requests are created. Appearance follows your system.</Dialog.Description></Dialog.Body>
          <Dialog.Footer><Dialog.CloseTrigger asChild><Button ref={closeButton}>Close</Button></Dialog.CloseTrigger></Dialog.Footer>
        </Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>
    </Flex>
    <Flex flex="1" minH="0">
      <VStack as="aside" aria-label="Collections and requests" align="stretch" gap="4" w="250px" minW="210px" p="4" overflow="auto" borderRightWidth="1px">
        <Heading size="sm">Workspace</Heading>
        <WorkspaceControls controller={workspaces} locked={requests.dirty || requests.busy || requests.sending} placement="sidebar" />
        <CollectionSidebar key={workspaces.snapshot?.selectedWorkspaceId ?? "none"} workspaceId={workspaces.snapshot?.selectedWorkspaceId ?? null} requestController={requests} />
      </VStack>
      <Flex as="main" direction="column" flex="1" minW="0" minH="0" p="4" gap="3" overflow="auto">
        <RequestEditor key={workspaces.snapshot?.selectedWorkspaceId ?? "none"} controller={requests} />
        <ResponseViewer controller={requests} />
      </Flex>
    </Flex>
    <Box as="footer" borderTopWidth="1px" px="4" py="2"><Text fontSize="xs" color="fg.muted">Local storage ready</Text></Box>
  </Flex>
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing renderer root')
createRoot(root).render(<StrictMode><LocalProvider><Shell /></LocalProvider></StrictMode>)
