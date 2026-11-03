import { useState } from 'react'
import { TemplateTextarea } from '../../components/template-field'
import { formatJsonBody, type BodyFormat } from './json-format'
import { MultipartEditor } from './multipart'
import { Box, Button, Flex, Input, NativeSelect, Text, VStack } from '@chakra-ui/react'
import { RowsEditor } from './fields'
import { utf8ByteLength } from '../../../shared/primitives'
import type { RequestController } from './controller'
import { JsonEditor } from '../../components/json-text'

export function BodyEditor({ controller: c }: { controller: RequestController }) {
  const [diagnostic, setDiagnostic] = useState<BodyFormat | null>(null)
  const body = c.draft?.body
  const Editor = body?.kind === 'json' ? JsonEditor : TemplateTextarea
  const error = (path: string) => c.validation[path] ? <Text id={`${path}-error`} role="alert" color="red.fg">{path}: {c.validation[path]}</Text> : null
  return <VStack align="stretch" gap="3">
    <Flex gap="2" align="center" className="body-variants">
      {c.draft?.bodyVariants?.length ? <>
        <NativeSelect.Root flex="1"><NativeSelect.Field aria-label="Body variant" value={c.draft.selectedBodyVariantId ?? ''} onChange={e => { setDiagnostic(null); c.setBodyIssue(null); c.selectBodyVariant(e.target.value) }}>{c.draft.bodyVariants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
        <Button size="xs" variant="ghost" disabled={c.busy || c.draft.bodyVariants.length < 2} onClick={c.removeBodyVariant}>Remove body</Button>
      </> : null}
      <Button size="xs" variant="outline" disabled={!c.draft || c.busy || (c.draft.bodyVariants?.length ?? 1) >= 20} onClick={() => { void c.addBodyVariant() }}>+ Body variant</Button>
    </Flex>
    {c.draft?.bodyVariants?.length ? <Input size="sm" title="Rename selected body" placeholder="Body name" aria-label="Body variant name" value={c.draft.bodyVariants.find(v => v.id === c.draft?.selectedBodyVariantId)?.name ?? ''} onChange={e => { if (c.draft) c.setDraft({ ...c.draft, bodyVariants: c.draft.bodyVariants?.map(v => v.id === c.draft?.selectedBodyVariantId ? { ...v, name: e.target.value } : v) }) }} /> : null}
    <Box><label htmlFor="body-mode">Body mode</label><NativeSelect.Root disabled={!c.draft || c.busy}><NativeSelect.Field id="body-mode" value={body?.kind ?? 'unavailable'} onChange={event => { const kind = event.target.value; setDiagnostic(null); c.setBodyIssue(null); if (kind === 'none' || kind === 'json' || kind === 'raw' || kind === 'urlencoded' || kind === 'multipart') c.changeBody(kind) }}>
      {!body && <option value="unavailable">Existing body mode unavailable</option>}<option value="none">None</option><option value="json">JSON</option><option value="raw">Raw</option><option value="urlencoded">URL-encoded form</option><option value="multipart">Multipart form</option>
    </NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root></Box>
    {!body && <details><summary>Body details</summary><Text>Existing saved body is preserved until you select an available mode.</Text></details>}
    {body?.kind === 'multipart' && <MultipartEditor controller={c} />}
    {body?.kind === 'urlencoded' && <><RowsEditor controller={c} group="body.rows" /><details><summary>Body details</summary><Text fontSize="sm">Enabled keys and values resolve variables at send time, then encode once. Content-Type defaults to application/x-www-form-urlencoded.</Text></details></>}
    {body && (body.kind === 'json' || body.kind === 'raw') && <>
      <Box><label htmlFor="body-text">{body.kind === 'json' ? 'JSON source text' : 'Raw body text'}</label><Editor id="body-text" minH="140px" value={body.text} onBlur={() => {
        if (body.kind !== 'json' || !c.draft) return
        const result = formatJsonBody(body.text); setDiagnostic(result); c.setBodyIssue(result.ok ? null : `JSON body problem · Line ${result.line}, column ${result.column}: ${result.message}`)
        if (result.ok && result.text !== body.text) c.setDraft({ ...c.draft, body: { ...body, text: result.text } })
      }} disabled={c.busy} aria-invalid={!!c.validation['body.text'] || (!!diagnostic && !diagnostic.ok)} aria-describedby={diagnostic && !diagnostic.ok ? 'body-syntax-error' : c.validation['body.text'] ? 'body.text-error' : undefined} onChange={event => { setDiagnostic(null); c.setBodyIssue(null); if (c.draft) c.setDraft({ ...c.draft, body: { ...body, text: event.target.value } }) }} />{error('body.text')}</Box>
      <details><summary>Body details</summary><Text fontSize="sm">{utf8ByteLength(body.text).toLocaleString()} UTF-8 bytes · maximum 5 MiB. Only the active mode is saved. Text is sent unchanged; JSON is validated after variable substitution.</Text></details>
      {body.kind === 'raw' && <Box><label htmlFor="body-media-type">Raw media type</label><Input id="body-media-type" value={body.mediaType} disabled={c.busy} aria-invalid={!!c.validation['body.mediaType']} aria-describedby={c.validation['body.mediaType'] ? 'body.mediaType-error' : undefined} onChange={event => { if (c.draft) c.setDraft({ ...c.draft, body: { ...body, mediaType: event.target.value } }) }} />{error('body.mediaType')}</Box>}
    </>}
    {error('body')}
  </VStack>
}
