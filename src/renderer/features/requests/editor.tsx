import type { GuardTransition } from '../navigation/transition'
import { useEffect, useRef, useState } from 'react'
import { Box, Button, Dialog, Flex, Heading, Input, NativeSelect, Portal, Tabs, Text } from '@chakra-ui/react'
import { httpMethodSchema } from '../../../shared/primitives'
import { AuthEditor } from './auth'
import { BodyEditor } from './body'
import { RowsEditor, SettingsEditor } from './fields'
import type { RequestController } from './controller'

export function RequestEditor({ controller: c, guard }: { controller: RequestController; guard: GuardTransition }) {
  const [deleting, setDeleting] = useState(false)
  const deletionVersion = useRef(0)
  const currentDeleting = useRef(deleting)
  currentDeleting.current = deleting
  const cancel = useRef<HTMLButtonElement>(null), remove = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'Enter' && !event.isComposing && !document.querySelector('[role="dialog"][data-state="open"]')) {
        event.preventDefault(); if (c.canSend && !c.busy) void c.send()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [c.canSend, c.busy, c.send])
  return <Box as="section" aria-label="Request editor" flex="1" minH="220px" overflow="auto">
    <Flex gap="2" align="center" mb="3" flexWrap="wrap">
      <Heading size="md">{c.draft ? 'Request editor' : 'No request selected'}</Heading>
      <Text role="status" fontSize="sm">{c.busy ? 'Loading or saving…' : c.draft ? c.dirty ? 'Unsaved changes' : 'Saved' : 'Select or create a request'}</Text>
      <Button size="sm" disabled={!c.draft || c.busy} onClick={() => { void c.save() }}>Save</Button>
      <Button size="sm" variant="outline" disabled={!c.dirty || c.busy} onClick={c.discard}>Discard edits</Button>
      <Button size="sm" variant="outline" disabled={!c.saved || c.busy} onClick={() => { void guard(c.duplicate) }}>Duplicate saved request</Button>
      <Button ref={remove} size="sm" variant="outline" disabled={!c.saved || c.busy} onClick={() => { deletionVersion.current++; setDeleting(true) }}>Delete request</Button>
    </Flex>
    {c.error && <Text role="alert" mb="3">{c.error}</Text>}
    {c.draft && <Box mb="3"><label htmlFor="request-name">Request name</label><Input id="request-name" value={c.draft.name} aria-invalid={!!c.validation.name} aria-describedby={c.validation.name ? "request-name-error" : undefined} disabled={c.busy} onChange={event => { if (c.draft) c.setDraft({ ...c.draft, name: event.target.value }) }} />{c.validation.name && <Text id="request-name-error" role="alert" color="fg.error">name: {c.validation.name}</Text>}</Box>}
    <Flex gap="2" mb="3">
      <NativeSelect.Root width="110px" flexShrink="0" disabled={!c.draft || c.busy}><NativeSelect.Field aria-label="HTTP method" value={c.draft?.method ?? ''} onChange={event => { if (c.draft) c.setDraft({ ...c.draft, method: httpMethodSchema.parse(event.target.value) }) }}>
        {!c.draft && <option value="">Method</option>}{httpMethodSchema.options.map(method => <option key={method} value={method}>{method}</option>)}
      </NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
      <Input aria-label="Request URL" placeholder="Request URL" aria-invalid={!!c.validation.urlTemplate} aria-describedby={c.validation.urlTemplate ? "request-url-error" : undefined} value={c.draft?.urlTemplate ?? ''} disabled={!c.draft || c.busy} onChange={event => { if (c.draft) c.setDraft({ ...c.draft, urlTemplate: event.target.value }) }} />
      <Button disabled={!c.canSend || c.busy} onClick={() => { void c.send() }}>Send</Button><Button disabled={!c.canCancel} variant="outline" onClick={() => { void c.cancel() }}>{c.cancelling ? 'Cancelling…' : 'Cancel'}</Button>
    </Flex>
    {c.executionStatus && <Text role="status" mb="3">{c.executionStatus}</Text>}
    {c.executionError && <Text role="alert" mb="3">{c.executionError}</Text>}
    {c.validation.urlTemplate && <Text id="request-url-error" role="alert" color="fg.error">urlTemplate: {c.validation.urlTemplate}</Text>}
    {c.dirty && <Text fontSize="sm" mb="3">Navigation asks whether to save or discard edits. Nothing is saved automatically.</Text>}
    <Tabs.Root defaultValue="params" size="sm"><Tabs.List aria-label="Request fields">{['Params', 'Headers', 'Body', 'Auth', 'Settings'].map(name => <Tabs.Trigger key={name} value={name.toLowerCase()}>{name}</Tabs.Trigger>)}</Tabs.List>
      <Tabs.Content value="params"><RowsEditor controller={c} group="queryRows" /></Tabs.Content>
      <Tabs.Content value="headers"><RowsEditor controller={c} group="headerRows" /></Tabs.Content>
      <Tabs.Content value="settings"><SettingsEditor controller={c} /></Tabs.Content>
      <Tabs.Content value="body"><BodyEditor controller={c} /></Tabs.Content>
      <Tabs.Content value="auth"><AuthEditor controller={c} /></Tabs.Content>
    </Tabs.Root>
    <Dialog.Root open={deleting} onOpenChange={({ open }) => { if (!c.busy) setDeleting(open) }} initialFocusEl={() => cancel.current} finalFocusEl={() => remove.current?.disabled ? document.querySelector<HTMLButtonElement>('[data-create-request]') : remove.current}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content><Dialog.Header><Dialog.Title>Delete request</Dialog.Title></Dialog.Header><Dialog.Body><Dialog.Description>Delete “{c.saved?.name}”? This permanently removes the saved request and its owned credentials. This cannot be undone.</Dialog.Description>{c.error && <Text role="alert">{c.error}</Text>}</Dialog.Body><Dialog.Footer><Button ref={cancel} disabled={c.busy} variant="outline" onClick={() => setDeleting(false)}>Cancel</Button><Button disabled={c.busy} onClick={() => { const version = deletionVersion.current; void guard(() => currentDeleting.current && version === deletionVersion.current ? c.delete() : Promise.resolve(false)).then(ok => { if (ok) setDeleting(false) }) }}>Delete permanently</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </Box>
}
