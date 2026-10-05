import { useRef, useState } from 'react'
import { Button, Dialog, Portal, Text } from '@chakra-ui/react'

export function WorkspaceExportDialog({ workspace, close, returnFocus }: { workspace: { id: string; name: string }; close: (status?: 'saved' | 'cancelled') => void; returnFocus: () => HTMLElement | null }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const running = useRef(false), cancel = useRef<HTMLButtonElement>(null)
  async function submit() {
    if (running.current) return
    running.current = true; setBusy(true); setError(null)
    try {
      const result = await window.offlineApi.transfer.exportWorkspace(workspace.id)
      if (result.ok) close(result.data.status)
      else setError(result.error.message)
    } catch { setError('Workspace could not be exported. Your saved data has not been changed. Try again.') }
    finally { running.current = false; setBusy(false) }
  }
  return <Dialog.Root open onOpenChange={({ open }) => { if (!open && !running.current) close() }} initialFocusEl={() => cancel.current} finalFocusEl={returnFocus}>
    <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
      <Dialog.Header><Dialog.Title>Export workspace JSON</Dialog.Title></Dialog.Header>
      <Dialog.Body>
        <Dialog.Description>Export saved configuration for “{workspace.name}”. Unsaved request edits are not included and will be kept.</Dialog.Description>
        <Text mt="3">Sensitive variable values, Auth credential literals, Authorization/Proxy-Authorization/Cookie header values, local file paths/selections and responses are excluded. Omitted credentials and files must be supplied again.</Text>
        <Text mt="3">Ordinary URL, query, body, custom header and plain-variable text can still contain user-entered secrets. Review the JSON before sharing.</Text>
        {error && <Text role="alert" mt="3">{error}</Text>}
      </Dialog.Body>
      <Dialog.Footer><Button ref={cancel} variant="outline" disabled={busy} onClick={() => close()}>Cancel</Button><Button disabled={busy} onClick={() => { void submit() }}>{busy ? 'Exporting…' : 'Choose save location'}</Button></Dialog.Footer>
    </Dialog.Content></Dialog.Positioner></Portal>
  </Dialog.Root>
}
