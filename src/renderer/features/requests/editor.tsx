import { TemplateInput } from '../../components/template-field'
import { Icon } from '../../components/icon'
import { httpMethodPalette } from '../../theme/http-method'
import { useEffect, useRef } from 'react'
import { Box, Button, Flex, Heading, Input, NativeSelect, Tabs, Text } from '@chakra-ui/react'
import { httpMethodSchema } from '../../../shared/primitives'
import { AuthEditor } from './auth'
import { BodyEditor } from './body'
import { RowsEditor, SettingsEditor } from './fields'
import type { RequestController } from './controller'

export function RequestEditor({ controller: c }: { controller: RequestController }) {
  const editor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'Enter' && editor.current?.contains(document.activeElement) && !event.isComposing && !document.querySelector('[role="dialog"][data-state="open"]')) {
        event.preventDefault(); if (c.canSend && !c.busy) void c.send()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [c.canSend, c.busy, c.send])
  return <Box ref={editor} className="editor-panel glass-panel" as="section" aria-label="Request editor" tabIndex={0} h="100%" minH="0" minW="0" overflow="auto">
    <Flex className="editor-heading" gap="2" align="center" mb="3" flexWrap="wrap">
      <Heading size="md">{c.draft ? 'Request editor' : 'No request selected'}</Heading>
      <Text className="save-indicator" data-pending={c.dirty || c.saving ? "true" : "false"} role="status" fontSize="sm">{c.saving ? 'Saving…' : c.busy ? 'Loading…' : c.draft ? c.dirty ? 'Unsaved changes' : 'Saved' : 'Select or create a request'}</Text>
    </Flex>
    {c.error && <Text role="alert" mb="3">{c.error}</Text>}
    {c.draft && <Text className="request-breadcrumb" aria-label="Request location" fontSize="sm" color="fg.muted" mb="2" overflowWrap="anywhere">{c.path}</Text>}
    {c.draft && <Box mb="3"><label htmlFor="request-name">Request name</label><Input id="request-name" value={c.draft.name} aria-invalid={!!c.validation.name} aria-describedby={c.validation.name ? "request-name-error" : undefined} disabled={c.busy} onChange={event => { if (c.draft) c.setDraft({ ...c.draft, name: event.target.value }) }} />{c.validation.name && <Text id="request-name-error" role="alert" color="red.fg">name: {c.validation.name}</Text>}</Box>}
    <Flex className="request-address" gap="2" mb="3" flexWrap="wrap">
      <NativeSelect.Root colorPalette={httpMethodPalette(c.draft?.method)} width="110px" flexShrink="0" disabled={!c.draft || c.busy}><NativeSelect.Field color="colorPalette.fg" bg="colorPalette.subtle" fontWeight="semibold" aria-label="HTTP method" value={c.draft?.method ?? ''} onChange={event => { if (c.draft) c.setDraft({ ...c.draft, method: httpMethodSchema.parse(event.target.value) }) }}>
        {!c.draft && <option value="">Method</option>}{httpMethodSchema.options.map(method => <option key={method} value={method} style={{ color: `var(--chakra-colors-${httpMethodPalette(method)}-fg)`, backgroundColor: 'var(--chakra-colors-bg)' }}>{method}</option>)}
      </NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
      <TemplateInput flex="1" minW="140px" aria-label="Request URL" placeholder="Request URL" aria-invalid={!!c.validation.urlTemplate} aria-describedby={c.validation.urlTemplate ? "request-url-error" : undefined} value={c.draft?.urlTemplate ?? ''} disabled={!c.draft || c.busy} onChange={event => { if (c.draft) c.setDraft({ ...c.draft, urlTemplate: event.target.value }) }} />
      <Button className="send-button" disabled={!c.canSend || c.busy} onClick={() => { void c.send() }}><Icon name="send" size={15} />Send</Button><Button className="cancel-button" aria-label={c.cancelling ? "Cancelling…" : "Cancel"} data-tooltip="Cancel request" disabled={!c.canCancel} variant="outline" onClick={() => { void c.cancel() }}><Icon name="stop" size={14} /></Button>
    </Flex>
    {c.executionStatus && <Text role="status" mb="3">{c.executionStatus}</Text>}
    {c.executionError && <Text role="alert" mb="3">{c.executionError}</Text>}
    {c.validation.urlTemplate && <Text id="request-url-error" role="alert" color="red.fg">urlTemplate: {c.validation.urlTemplate}</Text>}
    <Tabs.Root className="editor-tabs" defaultValue="params" size="sm"><Tabs.List aria-label="Request fields">{['Params', 'Headers', 'Body', 'Auth', 'Settings'].map(name => <Tabs.Trigger key={name} value={name.toLowerCase()}>{name}</Tabs.Trigger>)}</Tabs.List>
      <Tabs.Content value="params"><RowsEditor controller={c} group="queryRows" /></Tabs.Content>
      <Tabs.Content value="headers"><RowsEditor controller={c} group="headerRows" /></Tabs.Content>
      <Tabs.Content value="settings"><SettingsEditor controller={c} /></Tabs.Content>
      <Tabs.Content value="body"><BodyEditor controller={c} /></Tabs.Content>
      <Tabs.Content value="auth"><AuthEditor controller={c} /></Tabs.Content>
    </Tabs.Root>
  </Box>
}
