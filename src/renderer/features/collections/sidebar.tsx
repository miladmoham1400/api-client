import type { GuardTransition } from '../navigation/transition'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Button, Dialog, Flex, Heading, Input, Menu, NativeSelect, Portal, Text, VStack } from '@chakra-ui/react'
import type { Grouping } from '../../../shared/collections'
import type { Result } from '../../../shared/results'
import type { RequestController } from '../requests/controller'
import { nameSchema } from '../../../shared/primitives'

type Editing = { kind: 'create' } | { kind: 'rename' | 'delete'; id: string; name: string }

/** Mounted with a workspace key so a switch never displays the prior workspace's rows. */
export function CollectionSidebar({ workspaceId, requestController, guard }: { guard: GuardTransition; workspaceId: string | null; requestController: RequestController }) {
  const locked = requestController.busy
  const [snapshot, setSnapshot] = useState<Grouping | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const currentEditing = useRef(editing)
  currentEditing.current = editing
  const [name, setName] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const generation = useRef(0)
  const running = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const create = useRef<HTMLButtonElement>(null)
  const returnId = useRef<string | null>(null)
  const triggers = useRef(new Map<string, HTMLButtonElement>())
  const apply = useCallback(async (operation: () => Promise<Result<Grouping>>) => {
    if (running.current) return false
    running.current = true; setBusy(true); setError(null)
    const current = ++generation.current
    try {
      const result = await operation()
      if (current !== generation.current) return false
      if (result.ok && result.data.workspaceId === workspaceId) { setSnapshot(result.data); return true }
      setError(!result.ok && result.error.code === 'NOT_FOUND' ? 'This collection, request or workspace is no longer available. Reload collections.' : 'Collection changes could not be loaded or saved. Your current view has been kept. Try again.')
      return false
    } catch {
      if (current === generation.current) setError('Collection operation unavailable. Try again.')
      return false
    } finally {
      if (current === generation.current) { running.current = false; setBusy(false) }
    }
  }, [workspaceId])
  // A Save refresh is a background read, not a user mutation. It must not lock out
  // the guarded delete that follows Save. A newer read/mutation invalidates its reply.
  const reload = useCallback(async () => {
    if (!workspaceId || running.current) return
    const current = ++generation.current
    try {
      const result = await window.offlineApi.collections.list(workspaceId)
      if (current !== generation.current) return
      if (result.ok && result.data.workspaceId === workspaceId) { setSnapshot(result.data); setError(null) }
      else setError('Collections could not be loaded. Your current view has been kept. Try again.')
    } catch { if (current === generation.current) setError('Collection operation unavailable. Try again.') }
  }, [workspaceId])
  useEffect(() => { void reload() }, [reload, requestController.revision])
  useEffect(() => () => { generation.current++; running.current = false }, [])
  function open(next: Editing) { returnId.current = next.kind === 'create' ? null : next.id; setEditing(next); setName(next.kind === 'create' ? '' : next.name); setFieldError(null) }
  async function submit() {
    if (!editing || !workspaceId || busy) return
    if (editing.kind !== 'delete' && !nameSchema.safeParse(name).success) { setFieldError('Enter a name with 1–100 characters after trimming.'); input.current?.focus(); return }
    const target = editing
    const operation = () => currentEditing.current === target ? apply(() => target.kind === 'create' ? window.offlineApi.collections.create(workspaceId, name) : target.kind === 'rename' ? window.offlineApi.collections.rename(workspaceId, target.id, name) : window.offlineApi.collections.delete(workspaceId, target.id)) : Promise.resolve(false)
    if (target.kind === 'delete' ? await guard(operation, true) : await operation()) setEditing(null)
  }
  function requests(collectionId: string | null) {
    const rows = snapshot?.requests.filter(request => request.collectionId === collectionId) ?? []
    return rows.length ? rows.map(request => <Box key={request.id} role="group" aria-label={`Request: ${request.name}`} p="2" borderWidth="1px" borderRadius="sm">
      <Button variant="ghost" size="sm" whiteSpace="normal" h="auto" py="2" disabled={locked || busy} onClick={() => { if (request.id !== requestController.saved?.id) void guard(() => requestController.open(request.id)) }}>{request.name}</Button>
      <NativeSelect.Root size="sm" disabled={busy || locked || requestController.dirty || requestController.sending || !workspaceId}>
        <NativeSelect.Field aria-label={`Collection for ${request.name}`} value={request.collectionId ?? ''} onChange={event => {
          const destination = event.target.value || null
          if (workspaceId) void apply(() => window.offlineApi.requests.move(workspaceId, request.id, destination))
        }}>
          <option value="">Workspace root</option>
          {snapshot?.collections.map((collection, index) => <option key={collection.id} value={collection.id}>{collection.name} (collection {index + 1})</option>)}
        </NativeSelect.Field><NativeSelect.Indicator />
      </NativeSelect.Root>
    </Box>) : <Text fontSize="sm" color="fg.muted">{collectionId ? 'No requests in this collection' : 'No root requests'}</Text>
  }
  const title = editing?.kind === 'delete' ? 'Delete collection' : editing?.kind === 'rename' ? 'Rename collection' : 'Create collection'
  return <>
    <Heading size="sm">Collections</Heading>
    <Button ref={create} disabled={!snapshot || busy || locked} variant="outline" size="sm" onClick={() => open({ kind: 'create' })}>Create Collection</Button>
    {!workspaceId ? <Text fontSize="sm" color="fg.muted">Select a workspace to manage collections.</Text> : !snapshot && !error ? <Text role="status" fontSize="sm">Loading collections…</Text> : null}
    {busy && snapshot && <Text role="status" fontSize="sm">Updating collections…</Text>}
    {error && <Box role="alert"><Text fontSize="sm">{error}</Text><Button size="sm" disabled={busy} onClick={reload}>Reload collections</Button></Box>}
    {snapshot && snapshot.collections.length === 0 && <Text fontSize="sm" color="fg.muted">No collections</Text>}
    {snapshot?.collections.map((collection, index) => <VStack key={collection.id} role="group" aria-label={`Collection ${index + 1}: ${collection.name}`} align="stretch" gap="2">
      <Flex align="center" gap="2"><Heading size="sm" minW="0" flex="1" overflowWrap="anywhere">{collection.name}</Heading>
        <Menu.Root><Menu.Trigger asChild><Button ref={element => { if (element) triggers.current.set(collection.id, element); else triggers.current.delete(collection.id) }} size="xs" variant="outline" disabled={busy || locked} aria-label={`Actions for collection ${index + 1}: ${collection.name}`}>Actions</Button></Menu.Trigger>
          <Portal><Menu.Positioner><Menu.Content>
            <Menu.Item value="rename" onClick={() => open({ kind: 'rename', id: collection.id, name: collection.name })}>Rename collection</Menu.Item>
            <Menu.Item value="delete" onClick={() => open({ kind: 'delete', id: collection.id, name: collection.name })}>Delete collection</Menu.Item>
          </Menu.Content></Menu.Positioner></Portal>
        </Menu.Root>
      </Flex>
      {requests(collection.id)}
    </VStack>)}
    <Heading size="sm">Root requests</Heading>
    {snapshot && requests(null)}
    <Button data-create-request disabled={!workspaceId || !snapshot || busy || locked} variant="outline" size="sm" onClick={() => { void guard(async () => requestController.create()) }}>Create Request</Button>
    <Dialog.Root open={editing !== null} onOpenChange={({ open: isOpen }) => { if (!isOpen && !busy) setEditing(null) }}
      initialFocusEl={() => editing?.kind === 'delete' ? cancel.current : input.current}
      finalFocusEl={() => returnId.current ? triggers.current.get(returnId.current) ?? create.current : create.current}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
        <Dialog.Header><Dialog.Title>{title}</Dialog.Title></Dialog.Header>
        <Dialog.Body>
          {editing?.kind === 'delete' ? <Dialog.Description>Delete “{editing.name}”? Its saved requests will move to workspace root. The requests will not be deleted.</Dialog.Description> : <>
            <Dialog.Description mb="3">Names are trimmed and may contain 1–100 characters. Duplicate names are allowed.</Dialog.Description>
            <label htmlFor="collection-name">Collection name</label>
            <Input ref={input} id="collection-name" value={name} disabled={busy} aria-invalid={fieldError !== null} aria-describedby={fieldError ? 'collection-name-error' : undefined} onChange={event => { setName(event.target.value); setFieldError(null) }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() } }} />
            {fieldError && <Text id="collection-name-error" role="alert" color="red.fg">{fieldError}</Text>}
          </>}
          {error && <Text role="alert" mt="3">{error}</Text>}
        </Dialog.Body>
        <Dialog.Footer><Button ref={cancel} variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy} onClick={() => { void submit() }}>{busy ? 'Saving…' : editing?.kind === 'delete' ? 'Delete collection' : editing?.kind === 'rename' ? 'Save name' : 'Create collection'}</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </>
}
