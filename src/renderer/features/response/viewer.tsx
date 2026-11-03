import { useMemo, useState } from 'react'
import { Badge, Box, Button, Flex, Tabs, Text } from '@chakra-ui/react'
import { Icon } from '../../components/icon'
import { JSONTree } from 'react-json-tree'
import type { RequestController } from '../requests/controller'
import { prettyJson } from './format'
import { HtmlPreview } from './html-preview'

export function ResponseViewer({ controller: c }: { controller: RequestController }) {
  const result = c.executionResult
  return <Box className="response-panel glass-panel" as="section" aria-label="Response" tabIndex={0} borderWidth="1px" borderRadius="md" p="3" h="100%" minH="0" minW="0" overflow="auto">
    {!result && <Box className="response-empty"><span className="empty-icon"><Icon name="response" size={28} /></span><Text className="empty-title">{c.sending ? "Sending request" : "Your response, right here"}</Text><Text color="fg.muted" fontSize="sm">{c.sending ? 'Waiting for response…' : c.executionError ? 'Request could not be started. No HTTP response.' : 'Send a request to view its response.'}</Text><span className="shortcut-hint"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to send</span></Box>}
    {result && ('statusCode' in result ? <HttpView key={c.completedExecutionId} response={result} /> : <Text>{result.code === 'CANCELLED' ? 'Cancelled. No HTTP response.' : 'Transport failed. No HTTP response.'}</Text>)}
    {c.sentSnapshot && <Box as="details" mt="3" fontSize="xs" color="fg.muted" overflowWrap="anywhere">
      <summary>{c.draftChangedSinceSend ? 'Request details · edited since send' : 'Request details'}</summary>
      <Text>{c.sentSnapshot.name} · {c.sentSnapshot.method} {c.sentSnapshot.urlTemplate}</Text>
      <Text>Environment: {c.sentSnapshot.environment}</Text>
    </Box>}
  </Box>
}

function HttpView({ response: r }: { response: Extract<NonNullable<RequestController['executionResult']>, { statusCode: number }> }) {
  const [copyState, setCopyState] = useState('')
  const [mode, setMode] = useState<'raw' | 'pretty' | 'html'>('pretty')
  const raw = r.body.kind === 'text' ? r.body.text : ''
  const pretty = useMemo(() => prettyJson(raw), [raw])
  const data: unknown = useMemo(() => pretty.ok ? JSON.parse(raw) as unknown : null, [pretty, raw])
  const type = r.headers.find(header => header.name.toLowerCase() === 'content-type')?.value ?? 'Not provided'
  const html = /(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(type) || /^\s*(?:<!doctype html|<html[\s>])/i.test(raw)
  return <>
    <Flex gap="2" align="center" flexWrap="wrap" mb="2" aria-label="Response metrics">
      <Badge colorPalette={r.statusCode >= 400 ? 'red' : r.statusCode >= 300 ? 'yellow' : 'green'} title="HTTP status">{r.statusCode} {r.statusMessage}</Badge>
      <Badge colorPalette="blue" title="Duration">{r.durationMs.toFixed(1)} ms</Badge>
      <Badge colorPalette="purple" title="Decoded body size">{r.bodySizeBytes.toLocaleString()} B</Badge>
      {r.body.kind === 'text' && <Button size="xs" variant="ghost" ml="auto" aria-label="Copy response" title="Copy raw response" onClick={() => { void window.offlineApi.app.copyResponse(raw).then(result => setCopyState(result.ok ? 'Copied' : 'Copy failed')).catch(() => setCopyState('Copy failed')) }}><Icon name="copy" size={13} /></Button>}
      {copyState && <Text role="status" fontSize="xs">{copyState}</Text>}
    </Flex>
    <Tabs.Root defaultValue="body" size="sm">
      <Tabs.List aria-label="Response views"><Tabs.Trigger value="body">Body</Tabs.Trigger><Tabs.Trigger value="headers">Headers</Tabs.Trigger><Tabs.Trigger value="details">Details</Tabs.Trigger></Tabs.List>
      <Tabs.Content value="body">
        {r.body.kind === 'binary' ? <Box><Text>Binary response · {r.body.sizeBytes} bytes</Text><Text overflowWrap="anywhere">Content-Type: {type}</Text><Text>{r.body.reason}</Text></Box> : <>
          <Flex className="response-modes" gap="1" mb="2">{(['pretty', 'raw', ...(html ? ['html'] as const : [])] as const).map(value => <Button key={value} size="xs" variant={mode === value ? 'solid' : 'ghost'} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'html' ? 'HTML' : value === 'raw' ? 'Raw' : 'Pretty'}</Button>)}</Flex>
          {mode === 'html' ? <HtmlPreview text={raw} /> : mode === 'pretty' && pretty.ok ? <Box aria-label="Response body JSON" fontFamily="mono" fontSize="sm" overflowWrap="anywhere">
            <JSONTree data={data} hideRoot labelRenderer={(path, _type, expanded, expandable) => expandable ? <button type="button" aria-label={`Toggle ${String(path[0])}`} aria-expanded={expanded} style={{ cursor: 'pointer', font: 'inherit', color: 'inherit' }}>{String(path[0])}:</button> : <span>{String(path[0])}:</span>} shouldExpandNodeInitially={(_path, _data, level) => raw.length < 32 * 1024 && level < 32} collectionLimit={raw.length < 32 * 1024 ? 1000 : 50} invertTheme={false} theme={{
              base00: 'var(--chakra-colors-bg)', base01: 'var(--chakra-colors-bg-subtle)', base02: 'var(--chakra-colors-border)', base03: 'var(--chakra-colors-fg-muted)',
              base04: 'var(--chakra-colors-fg-muted)', base05: 'var(--chakra-colors-fg)', base06: 'var(--chakra-colors-fg)', base07: 'var(--chakra-colors-fg)',
              base08: 'var(--chakra-colors-red-fg)', base09: 'var(--chakra-colors-orange-fg)', base0A: 'var(--chakra-colors-yellow-fg)', base0B: 'var(--chakra-colors-green-fg)',
              base0C: 'var(--chakra-colors-cyan-fg)', base0D: 'var(--chakra-colors-blue-fg)', base0E: 'var(--chakra-colors-purple-fg)', base0F: 'var(--chakra-colors-red-fg)',
            }} />
          </Box> : <>
            {mode === 'pretty' && !pretty.ok && /json/i.test(type) && <Text fontSize="xs" color="fg.muted" mb="2">{pretty.message}</Text>}
            <Box as="pre" className="json-response" aria-label="Response body text" fontFamily="mono" fontSize="sm" whiteSpace="pre-wrap" overflowWrap="anywhere">{raw}</Box>
          </>}
        </>}
      </Tabs.Content>
      <Tabs.Content value="headers"><Box as="pre" aria-label="Raw response headers" fontFamily="mono" fontSize="sm" whiteSpace="pre-wrap" overflowWrap="anywhere">{r.headers.length ? r.headers.map(header => `${header.name}: ${header.value}`).join('\n') : 'No response headers.'}</Box></Tabs.Content>
      <Tabs.Content value="details"><Text fontSize="sm" overflowWrap="anywhere">Final URL: {r.finalUrl} · Redirect hops: {r.redirectCount}</Text><Text fontSize="sm">Content-Type: {type}</Text></Tabs.Content>
    </Tabs.Root>
  </>
}
