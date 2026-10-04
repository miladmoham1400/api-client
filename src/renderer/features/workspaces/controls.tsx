import { useRef, useState } from 'react'
import { Box, Button, Dialog, Input, Menu, NativeSelect, Portal, Text } from '@chakra-ui/react'
import { nameSchema } from '../../../shared/primitives'
import type { WorkspaceController } from './use-workspaces'

type Editing = { kind: 'create' } | { kind: 'rename' | 'delete'; id: string; name: string }

export function WorkspaceControls({ controller, placement }: { controller: WorkspaceController; placement: 'top' | 'sidebar' }) {
  const { snapshot, busy, error, apply, reload } = controller
  const selected = snapshot?.workspaces.find(workspace => workspace.id === snapshot.selectedWorkspaceId)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [name, setName] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const create = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLButtonElement>(null)
  const selector = useRef<HTMLSelectElement>(null)
  function open(next: Editing) {
    setName(next.kind === 'create' ? '' : next.name)
    setFieldError(null)
    setEditing(next)
  }
  async function submit() {
    if (!editing || busy) return
    if (editing.kind !== 'delete' && !nameSchema.safeParse(name).success) {
      setFieldError('Enter a name with 1–100 characters after trimming.')
      input.current?.focus()
      return
    }
    const target = editing
    const success = await apply(() => target.kind === 'create' ? window.offlineApi.workspaces.create(name) : target.kind === 'rename' ? window.offlineApi.workspaces.rename(target.id, name) : window.offlineApi.workspaces.delete(target.id))
    if (success) setEditing(null)
  }
  const title = editing?.kind === 'delete' ? 'Delete workspace' : editing?.kind === 'rename' ? 'Rename workspace' : 'Create workspace'
  return <>
    {placement === 'top' ? <>
      <NativeSelect.Root width="210px" disabled={!snapshot || busy}>
        <NativeSelect.Field ref={selector} aria-label="Workspace" value={snapshot?.selectedWorkspaceId ?? ''} onChange={event => { void apply(() => window.offlineApi.workspaces.select(event.target.value || null)) }}>
          <option value="">{snapshot ? 'No workspace selected' : 'Loading workspaces…'}</option>
          {snapshot?.workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </NativeSelect.Field><NativeSelect.Indicator />
      </NativeSelect.Root>
      <Menu.Root><Menu.Trigger asChild><Button ref={menu} disabled={!selected || busy} size="sm" variant="outline" aria-label="Workspace menu">Workspace menu</Button></Menu.Trigger>
        <Portal><Menu.Positioner><Menu.Content>
          <Menu.Item value="rename" onClick={() => { if (selected) open({ kind: 'rename', id: selected.id, name: selected.name }) }}>Rename workspace</Menu.Item>
          <Menu.Item value="delete" onClick={() => { if (selected) open({ kind: 'delete', id: selected.id, name: selected.name }) }}>Delete workspace</Menu.Item>
        </Menu.Content></Menu.Positioner></Portal>
      </Menu.Root>
    </> : <>
      <Text fontSize="sm" color="fg.muted" overflowWrap="anywhere">{selected?.name ?? (snapshot ? 'No workspace selected' : 'Loading workspaces…')}</Text>
      <Button ref={create} disabled={!snapshot || busy} onClick={() => open({ kind: 'create' })}>Create Workspace</Button>
      {busy && <Text role="status" fontSize="sm">Updating workspaces…</Text>}
      {error && <Box role="alert"><Text fontSize="sm">{error}</Text><Button variant="outline" size="sm" disabled={busy} onClick={() => { void reload() }}>Reload workspaces</Button></Box>}
      <Text fontSize="sm">Collection and request editing are not available yet.</Text>
    </>}
    <Dialog.Root open={editing !== null} onOpenChange={({ open: isOpen }) => { if (!isOpen && !busy) setEditing(null) }}
      initialFocusEl={() => editing?.kind === 'delete' ? cancel.current : input.current}
      finalFocusEl={() => placement === 'sidebar' ? create.current : selected ? menu.current : selector.current}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
        <Dialog.Header><Dialog.Title>{title}</Dialog.Title></Dialog.Header>
        <Dialog.Body>
          {editing?.kind === 'delete' ? <Dialog.Description>Delete “{editing.name}”? This permanently removes its collections, requests, environments, variables and stored secrets. This cannot be undone.</Dialog.Description> : <>
            <Dialog.Description mb="3">Names are trimmed and may contain 1–100 characters. Duplicate names are allowed.</Dialog.Description>
            <label htmlFor={`workspace-name-${placement}`}>Workspace name</label>
            <Input ref={input} id={`workspace-name-${placement}`} value={name} disabled={busy} aria-invalid={fieldError !== null} aria-describedby={fieldError ? `workspace-name-error-${placement}` : undefined} onChange={event => { setName(event.target.value); setFieldError(null) }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() } }} />
            {fieldError && <Text id={`workspace-name-error-${placement}`} role="alert" color="fg.error">{fieldError}</Text>}
          </>}
          {error && <Text role="alert" mt="3">{error}</Text>}
        </Dialog.Body>
        <Dialog.Footer>
          <Button ref={cancel} variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
          <Button disabled={busy} colorPalette={editing?.kind === 'delete' ? 'red' : undefined} onClick={() => { void submit() }}>{busy ? 'Saving…' : editing?.kind === 'delete' ? 'Delete permanently' : editing?.kind === 'rename' ? 'Save name' : 'Create workspace'}</Button>
        </Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </>
}
