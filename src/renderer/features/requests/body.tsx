import { Box, Input, NativeSelect, Text, Textarea, VStack } from '@chakra-ui/react'
import { RowsEditor } from './fields'
import { utf8ByteLength } from '../../../shared/primitives'
import type { RequestController } from './controller'

export function BodyEditor({ controller: c }: { controller: RequestController }) {
  const body = c.draft?.body
  const error = (path: string) => c.validation[path] ? <Text id={`${path}-error`} role="alert" color="fg.error">{path}: {c.validation[path]}</Text> : null
  return <VStack align="stretch" gap="3">
    <Box><label htmlFor="body-mode">Body mode</label><NativeSelect.Root disabled={!c.draft || c.busy}><NativeSelect.Field id="body-mode" value={body?.kind ?? 'unavailable'} onChange={event => { const kind = event.target.value; if (kind === 'none' || kind === 'json' || kind === 'raw' || kind === 'urlencoded') c.changeBody(kind) }}>
      {!body && <option value="unavailable">Existing body mode unavailable</option>}<option value="none">None</option><option value="json">JSON</option><option value="raw">Raw</option><option value="urlencoded">URL-encoded form</option>
    </NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root></Box>
    {!body && <Text>Existing saved body is preserved until you select an available mode.</Text>}
    {body?.kind === 'none' && <Text>No body. Inactive text drafts remain in this editor session; only the active mode is saved.</Text>}
    {body?.kind === 'urlencoded' && <><Text fontSize="sm">Enabled keys and values resolve variables at send time, then encode once. Content-Type defaults to application/x-www-form-urlencoded; only an optional charset is allowed in an override.</Text><RowsEditor controller={c} group="body.rows" /></>}
    {body && (body.kind === 'json' || body.kind === 'raw') && <>
      <Box><label htmlFor="body-text">{body.kind === 'json' ? 'JSON source text' : 'Raw body text'}</label><Textarea id="body-text" minH="140px" value={body.text} disabled={c.busy} aria-invalid={!!c.validation['body.text']} aria-describedby={c.validation['body.text'] ? 'body-text-help body.text-error' : 'body-text-help'} onChange={event => { if (c.draft) c.setDraft({ ...c.draft, body: { ...body, text: event.target.value } }) }} />{error('body.text')}</Box>
      <Text id="body-text-help" fontSize="sm">{utf8ByteLength(body.text).toLocaleString()} UTF-8 bytes; maximum 5 MiB. Text is saved unchanged. Only the active mode is saved.</Text>
      {body.kind === 'json' && <Text fontSize="sm">JSON is validated after variable substitution when sending becomes available. Empty JSON text cannot be sent; it remains distinct from None.</Text>}
      {body.kind === 'raw' && <Box><label htmlFor="body-media-type">Raw media type</label><Input id="body-media-type" value={body.mediaType} disabled={c.busy} aria-invalid={!!c.validation['body.mediaType']} aria-describedby={c.validation['body.mediaType'] ? 'body.mediaType-error' : undefined} onChange={event => { if (c.draft) c.setDraft({ ...c.draft, body: { ...body, mediaType: event.target.value } }) }} />{error('body.mediaType')}</Box>}
    </>}
    {error('body')}
  </VStack>
}
