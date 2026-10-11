import { useRef, useState } from 'react'
import { Button, Dialog, Portal, Text } from '@chakra-ui/react'
import type { ImportPreview } from '../../../shared/import'
export function WorkspaceImportDialog({ close, returnFocus }: { close: (name?: string) => void; returnFocus: () => HTMLElement | null }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const running = useRef(false), cancel = useRef<HTMLButtonElement>(null)
  async function operate(action: () => Promise<void>) {
    if (running.current) return
    running.current = true; setBusy(true); setError(null)
    try { await action() } catch { setError('Import unavailable. Your existing workspace has been kept. Try again.') }
    finally { running.current = false; setBusy(false) }
  }
  const dismiss = () => operate(async () => {
    if (preview) {
      const result = await window.offlineApi.transfer.cancelImport(preview.token)
      if (!result.ok && result.error.code !== 'NOT_FOUND') { setError(result.error.message); return }
    }
    close()
  })
  return <Dialog.Root open onOpenChange={({ open }) => { if (!open) void dismiss() }} initialFocusEl={() => cancel.current} finalFocusEl={returnFocus}>
    <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
      <Dialog.Header><Dialog.Title>Import workspace JSON</Dialog.Title></Dialog.Header>
      <Dialog.Body maxH="60vh" overflowY="auto">
        <Dialog.Description>Import Offline API Client format v1 or v2 as a new workspace. Existing workspaces and unsaved edits are kept. No request will be sent.</Dialog.Description>
        {preview ? <>
          <Text mt="3">Workspace: {preview.name}</Text>
          <Text>{preview.collections.length} collections; {preview.folders.length} folders; {preview.environments.length} environments; {preview.requests} requests; {preview.variables} variables.</Text>
          {preview.collections.length > 0 && <Text>Collections: {preview.collections.join(', ')}</Text>}
          {preview.folders.length > 0 && <Text>Folders: {preview.folders.join(', ')}</Text>}
          {preview.environments.length > 0 && <Text>Environments: {preview.environments.join(', ')}</Text>}
          <Text mt="3">Omissions: {preview.missingVariables} sensitive variable values, {preview.missingCredentials} requests requiring credentials, {preview.missingFiles} files requiring selection.</Text>
          <Text mt="3">Supply omitted values and select local files again. The new workspace starts with environment None and no selected request. Your current workspace stays selected.</Text>
        </> : <Text mt="3">Choose a JSON file up to 10 MiB. Its contents are validated before a summary is shown.</Text>}
        {error && <Text role="alert" mt="3">{error}</Text>}
      </Dialog.Body>
      <Dialog.Footer>
        <Button ref={cancel} variant="outline" disabled={busy} onClick={() => { void dismiss() }}>Cancel</Button>
        <Button variant="outline" disabled={busy} onClick={() => { void operate(async () => {
          setPreview(null)
          const result = await window.offlineApi.transfer.chooseImport()
          if (!result.ok) setError(result.error.message)
          else if (result.data.status === 'cancelled') close()
          else setPreview(result.data.preview)
        }) }}>{busy ? 'Working…' : preview ? 'Choose another file' : 'Choose JSON file'}</Button>
        {preview && <Button disabled={busy} onClick={() => { void operate(async () => {
          const result = await window.offlineApi.transfer.importWorkspace(preview.token)
          if (result.ok) close(result.data.name)
          else setError(result.error.message)
        }) }}>Import as new workspace</Button>}
      </Dialog.Footer>
    </Dialog.Content></Dialog.Positioner></Portal>
  </Dialog.Root>
}
