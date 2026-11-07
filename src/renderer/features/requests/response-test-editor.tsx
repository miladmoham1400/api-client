import { useEffect, useRef, useState } from 'react'
import { Box, Button, Flex, Text } from '@chakra-ui/react'
import { JsonEditor } from '../../components/json-text'
import { readTestJson, selectedResponseExpectation } from '../../../shared/response-test'
import type { RequestController } from './controller'

export function ResponseTestEditor({ controller: c }: { controller: RequestController }) {
  const selected = c.draft ? selectedResponseExpectation(c.draft) : null
  return <Box as="details" className="response-test-editor">
    <summary>Response test{selected?.expected != null ? ' · configured' : ''}</summary>
    <ExpectedEditor controller={c} />
  </Box>
}
function ExpectedEditor({ controller: c }: { controller: RequestController }) {
  const selected = c.draft ? selectedResponseExpectation(c.draft) : null
  const [text, setText] = useState(selected?.expected ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const previous = useRef({ request: c.saved?.id, variant: c.draft?.selectedBodyVariantId, workspace: c.saved?.workspaceId })
  useEffect(() => {
    const next = { request: c.saved?.id, variant: c.draft?.selectedBodyVariantId, workspace: c.saved?.workspaceId }
    // Binding a newly autosaved request must retain an in-progress expected JSON edit.
    if ((previous.current.request && previous.current.request !== next.request) || previous.current.variant !== next.variant || (previous.current.workspace && previous.current.workspace !== next.workspace)) {
      setText(selected?.expected ?? ''); setError(null); setSaved(false)
    }
    previous.current = next
  }, [c.saved?.id, c.saved?.workspaceId, c.draft?.selectedBodyVariantId, selected?.expected])
  const update = (value: string | null) => {
    const draft = c.draft
    if (!draft) return
    c.setDraft(draft.bodyVariants?.length ? { ...draft, bodyVariants: draft.bodyVariants.map(v => v.id === draft.selectedBodyVariantId ? { ...v, expectedResponse: value } : v) } : { ...draft, expectedResponse: value })
    setError(null); setSaved(true)
  }
  return <Box pt="2">
    <Text fontSize="xs" color="fg.muted" mb="2">Expected JSON for {selected?.bodyName ?? 'Body'}. Checked on every send. Stored locally and omitted from exports.</Text>
    <label htmlFor="expected-response-json">Expected response JSON</label>
    <JsonEditor id="expected-response-json" value={text} minH="120px" disabled={c.busy || !c.draft} aria-invalid={!!error} aria-describedby={error ? 'expected-json-error' : undefined} onChange={e => { setText(e.target.value); setSaved(false); setError(null) }} />
    {error && <Text id="expected-json-error" role="alert" fontSize="xs" color="red.fg">{error}</Text>}
    <Flex gap="2" align="center" mt="2">
      <Button size="xs" disabled={c.busy || !c.draft} onClick={() => { const parsed = readTestJson(text); if ('message' in parsed) setError(parsed.message); else update(text) }}>Save expected JSON</Button>
      <Button size="xs" variant="ghost" disabled={c.busy || selected?.expected == null} onClick={() => { setText(''); update(null) }}>Remove test</Button>
      {saved && <Text role="status" fontSize="xs">{c.dirty ? 'Saving test…' : 'Test saved'}</Text>}
    </Flex>
  </Box>
}
