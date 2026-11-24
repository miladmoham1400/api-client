import { useEffect, useRef, useState } from 'react'
import { Box, Button, Text } from '@chakra-ui/react'
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
  const previous = useRef({ request: c.saved?.id, variant: c.draft?.selectedBodyVariantId, workspace: c.saved?.workspaceId, expected: selected?.expected })
  useEffect(() => {
    const next = { request: c.saved?.id, variant: c.draft?.selectedBodyVariantId, workspace: c.saved?.workspaceId, expected: selected?.expected }
    // Binding a newly autosaved request must retain an in-progress expected JSON edit.
    if ((previous.current.request && previous.current.request !== next.request) || previous.current.variant !== next.variant || (previous.current.workspace && previous.current.workspace !== next.workspace) || previous.current.expected !== next.expected) {
      setText(next.expected ?? ''); setError(null)
    }
    previous.current = next
  }, [c.saved?.id, c.saved?.workspaceId, c.draft?.selectedBodyVariantId, selected?.expected])
  const update = (value: string | null) => {
    const draft = c.draft
    if (!draft || (selected?.expected ?? null) === value) return
    c.setDraft(draft.bodyVariants?.length ? { ...draft, bodyVariants: draft.bodyVariants.map(v => v.id === draft.selectedBodyVariantId ? { ...v, expectedResponse: value } : v) } : { ...draft, expectedResponse: value })
  }
  const changeText = (value: string) => {
    setText(value)
    setError(null)
    if (!value.trim()) update(null)
    else if (!('message' in readTestJson(value))) update(value)
  }
  return <Box pt="2">
    <Text fontSize="xs" color="fg.muted" mb="2">Expected JSON for {selected?.bodyName ?? 'Body'}. Checked on every send. Stored locally and omitted from exports.</Text>
    <label htmlFor="expected-response-json">Expected response JSON</label>
    <JsonEditor id="expected-response-json" value={text} minH="120px" disabled={c.busy || !c.draft} aria-invalid={!!error} aria-describedby={error ? 'expected-json-error' : undefined}
      onChange={e => changeText(e.currentTarget.value)}
      onBlur={e => {
        const value = e.currentTarget.value
        if (!value.trim()) return
        const parsed = readTestJson(value)
        setError('message' in parsed ? parsed.message : null)
      }} />
    {error && <Text id="expected-json-error" role="alert" fontSize="xs" color="red.fg">{error}</Text>}
    <Button mt="2" size="xs" variant="ghost" disabled={c.busy || !text} onClick={() => changeText('')}>Remove test</Button>
  </Box>
}
