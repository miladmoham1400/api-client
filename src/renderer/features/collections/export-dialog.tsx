import { GlassSelect as NativeSelect } from '../../components/glass-select'
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Portal, Text } from '@chakra-ui/react'
import { Icon } from '../../components/icon'
import type { RequestController } from '../requests/controller'

export function CollectionExportControl({ workspace, controller }: { workspace: string | null; controller: RequestController }) {
  const [open, setOpen] = useState(false), trigger = useRef<HTMLButtonElement>(null)
  return <>
    <Button ref={trigger} size="sm" variant="ghost" aria-label="Export Postman collection" data-tooltip="Export Postman collection" disabled={!workspace || controller.busy} onClick={() => setOpen(true)}><Icon name="export" size={14} />Export</Button>
    {open && workspace && <PostmanExportDialog workspace={workspace} controller={controller} close={() => setOpen(false)} returnFocus={() => trigger.current} />}
  </>
}
export function PostmanExportDialog({ workspace, collection, controller, close, returnFocus }: { workspace: string; collection?: { id: string; name: string }; controller: RequestController; close: () => void; returnFocus: () => HTMLElement | null }) {
  const [items, setItems] = useState<{ id: string; name: string }[]>(collection ? [collection] : []), [selected, setSelected] = useState(collection?.id ?? '')
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const cancel = useRef<HTMLButtonElement>(null), running = useRef(false)
  useEffect(() => {
    if (collection) return
    let alive = true
    void window.offlineApi.collections.list(workspace).then(result => { if (!alive) return; if (!result.ok) { setError('Collections unavailable.'); return }; setItems(result.data.collections); setSelected(result.data.collections[0]?.id ?? '') }).catch(() => { if (alive) setError('Collections unavailable.') })
    return () => { alive = false }
  }, [workspace, collection])
  const submit = async () => {
    if (!selected || running.current) return
    running.current = true; setBusy(true); setError(null)
    try {
      if ((controller.dirty || controller.saving) && !await controller.save()) { setError('Current edits could not be saved. Correct them before exporting.'); return }
      const result = await window.offlineApi.transfer.exportPostmanCollection(workspace, selected)
      if (!result.ok) setError(result.error.message)
      else close()
    } catch { setError('Collection could not be exported. Your saved data is unchanged.') }
    finally { running.current = false; setBusy(false) }
  }
  return <Dialog.Root open onOpenChange={({ open }) => { if (!open && !running.current) close() }} initialFocusEl={() => cancel.current} finalFocusEl={returnFocus}>
    <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
      <Dialog.Header><Dialog.Title>Export Postman collection</Dialog.Title></Dialog.Header>
      <Dialog.Body>
        <Dialog.Description>Export one complete collection and its nested folders as Postman Collection v2.1 JSON. Pending valid request edits are saved first.</Dialog.Description>
        <NativeSelect.Root mt="3" disabled={busy}><NativeSelect.Field aria-label="Collection to export" value={selected} onChange={e => { setSelected(e.target.value) }}>{items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
        {!items.length && <Text mt="2" fontSize="sm">Create a collection first; root requests are not part of a collection.</Text>}
        <Text mt="3" fontSize="sm">Auth credential literals, credential headers, sensitive variable values, local file paths/selections and responses are omitted. Body variants become request examples. Only workspace-level variables are included; environment values, timeout and redirect settings are not transferred.</Text>
        <Text mt="2" fontSize="sm">Ordinary URL/query/body/plain-variable text can contain secrets. Review the JSON before sharing.</Text>
        {error && <Text role="alert" mt="3">{error}</Text>}
      </Dialog.Body>
      <Dialog.Footer><Button ref={cancel} variant="outline" disabled={busy} onClick={close}>Cancel</Button><Button disabled={!selected || busy} onClick={() => { void submit() }}>{busy ? 'Exporting…' : 'Choose save location'}</Button></Dialog.Footer>
    </Dialog.Content></Dialog.Positioner></Portal>
  </Dialog.Root>
}
