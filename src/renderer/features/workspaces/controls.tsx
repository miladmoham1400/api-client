import { WorkspaceExportDialog } from './export-dialog'
import type { GuardTransition } from '../navigation/transition'
import { useRef, useState } from 'react'
import { Box, Button, Dialog, Input, Menu, NativeSelect, Portal, Text } from '@chakra-ui/react'
import { nameSchema } from '../../../shared/primitives'
import type { WorkspaceController } from './use-workspaces'

type Editing = { kind: 'create' } | { kind: 'rename' | 'delete'; id: string; name: string }

export function WorkspaceControls({ controller, placement, guard, locked = false }: { guard: GuardTransition; controller: WorkspaceController; placement: 'top' | 'sidebar'; locked?: boolean }) {
  const { snapshot, busy, error, apply, reload } = controller
  const selected = snapshot?.workspaces.find(workspace => workspace.id === snapshot.selectedWorkspaceId)
  const [exportTarget, setExportTarget] = useState<{ id: string; name: string } | null>(null)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const currentEditing = useRef(editing)
  currentEditing.current = editing
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
    const operation = () => currentEditing.current === target ? apply(() => target.kind === 'create' ? window.offlineApi.workspaces.create(name) : target.kind === 'rename' ? window.offlineApi.workspaces.rename(target.id, name) : window.offlineApi.workspaces.delete(target.id)) : Promise.resolve(false)
    const success = target.kind === 'rename' ? await operation() : await guard(operation)
    if (success) setEditing(null)
  }
  const title = editing?.kind === 'delete' ? 'Delete workspace' : editing?.kind === 'rename' ? 'Rename workspace' : 'Create workspace'
  return <>
    {placement === 'top' ? <>
      <NativeSelect.Root width="210px" disabled={!snapshot || busy || locked}>
        <NativeSelect.Field ref={selector} aria-label="Workspace" value={snapshot?.selectedWorkspaceId ?? ''} onChange={event => { const id = event.target.value || null; if (id !== snapshot?.selectedWorkspaceId) void guard(() => apply(() => window.offlineApi.workspaces.select(id))) }}>
          <option value="">{snapshot ? 'No workspace selected' : 'Loading workspaces…'}</option>
          {snapshot?.workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </NativeSelect.Field><NativeSelect.Indicator />
      </NativeSelect.Root>
      <Menu.Root><Menu.Trigger asChild><Button ref={menu} disabled={!selected || busy || locked} size="sm" variant="outline" aria-label="Workspace menu">Workspace menu</Button></Menu.Trigger>
        <Portal><Menu.Positioner><Menu.Content>
          <Menu.Item value="export" onClick={() => { if (selected) { setExportStatus(null); setExportTarget({ id: selected.id, name: selected.name }) } }}>Export workspace JSON</Menu.Item>
          <Menu.Item value="rename" onClick={() => { if (selected) open({ kind: 'rename', id: selected.id, name: selected.name }) }}>Rename workspace</Menu.Item>
          <Menu.Item value="delete" onClick={() => { if (selected) open({ kind: 'delete', id: selected.id, name: selected.name }) }}>Delete workspace</Menu.Item>
        </Menu.Content></Menu.Positioner></Portal>
      </Menu.Root>
    </> : <>
      <Text fontSize="sm" color="fg.muted" overflowWrap="anywhere">{selected?.name ?? (snapshot ? 'No workspace selected' : 'Loading workspaces…')}</Text>
      <Button ref={create} disabled={!snapshot || busy || locked} onClick={() => open({ kind: 'create' })}>Create Workspace</Button>
      {busy && <Text role="status" fontSize="sm">Updating workspaces…</Text>}
      {error && <Box role="alert"><Text fontSize="sm">{error}</Text><Button variant="outline" size="sm" disabled={busy} onClick={() => { void guard(reload, true) }}>Reload workspaces</Button></Box>}
    </>}
    {placement === 'top' && exportStatus && <Text role="status" fontSize="sm">{exportStatus}</Text>}
    {exportTarget && <WorkspaceExportDialog workspace={exportTarget} returnFocus={() => menu.current} close={status => { setExportTarget(null); if (status) setExportStatus(status === 'saved' ? 'Workspace exported.' : 'Export cancelled.') }} />}
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
