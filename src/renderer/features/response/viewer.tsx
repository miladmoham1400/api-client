import { useEffect, useRef, useState } from 'react'
import { Box, Button, Flex, Heading, Tabs, Text } from '@chakra-ui/react'
import type { RequestController } from '../requests/controller'
import { prettyJson, type PrettyResult } from './format'

export function ResponseViewer({ controller: c }: { controller: RequestController }) {
  const panel = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(260)
  useEffect(() => {
    const element = panel.current
    if (!element) return
    const observer = new ResizeObserver(entries => {
      const size = entries[0]?.borderBoxSize[0]?.blockSize
      if (size) setHeight(Math.round(size))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  function resize(delta: number) {
    const element = panel.current
    if (!element) return
    const next = Math.max(180, Math.min(420, Math.round(element.getBoundingClientRect().height) + delta))
    element.style.height = `${next}px`
    setHeight(next)
  }
  const result = c.executionResult
  return <Box ref={panel} as="section" aria-label="Response" tabIndex={0} borderWidth="1px" borderRadius="md" p="4" h={`${height}px`} minH="180px" maxH="60vh" flexShrink="0" overflow="auto" resize="vertical">
    <Flex gap="2" align="center" flexWrap="wrap" mb="2"><Heading size="sm">Response</Heading><Button size="xs" variant="outline" aria-label="Decrease response panel height" disabled={height <= 180} onClick={() => resize(-40)}>Smaller</Button><Button size="xs" variant="outline" aria-label="Increase response panel height" disabled={height >= 420} onClick={() => resize(40)}>Larger</Button></Flex>
    {c.sentSnapshot && <Box fontSize="sm" overflowWrap="anywhere" mb="2">
      <Text>Sent snapshot: {c.sentSnapshot.name} · {c.sentSnapshot.method} {c.sentSnapshot.urlTemplate}</Text>
      <Text>Environment at send: {c.sentSnapshot.environment}</Text>
      {c.draftChangedSinceSend && <Text>The current draft differs from the sent snapshot. This result belongs to the snapshot above.</Text>}
    </Box>}
    {!result && <Text>{c.sending ? 'Waiting for response…' : c.executionError ? 'Request could not be started. No HTTP response.' : 'No response yet. Send a request to view its result.'}</Text>}
    {result && ('statusCode' in result ? <HttpView key={c.completedExecutionId} response={result} /> : <Text>{result.code === 'CANCELLED' ? 'Cancelled. No HTTP response.' : 'Transport failed. No HTTP response.'}</Text>)}
  </Box>
}

function HttpView({ response: r }: { response: Extract<NonNullable<RequestController['executionResult']>, { statusCode: number }> }) {
  const [pretty, setPretty] = useState<PrettyResult | null>(null), [mode, setMode] = useState<'raw' | 'pretty'>('raw')
  const type = r.headers.find(header => header.name.toLowerCase() === 'content-type')?.value ?? 'Not provided'
  return <>
    <Text fontSize="sm">Status {r.statusCode} {r.statusMessage} · Duration {r.durationMs.toFixed(1)} ms · Size {r.bodySizeBytes} bytes (decoded)</Text>
    <Text fontSize="sm" overflowWrap="anywhere">Final URL: {r.finalUrl} · Redirect hops: {r.redirectCount}</Text>
    <Tabs.Root defaultValue="body" size="sm">
      <Tabs.List aria-label="Response views"><Tabs.Trigger value="body">Body</Tabs.Trigger><Tabs.Trigger value="headers">Headers</Tabs.Trigger></Tabs.List>
      <Tabs.Content value="body">
        {r.body.kind === 'binary' ? <Box><Text>Binary response · {r.body.sizeBytes} bytes</Text><Text overflowWrap="anywhere">Content-Type: {type}</Text><Text>{r.body.reason}</Text></Box> : <>
          <Flex gap="2" mb="2"><Button size="xs" variant={mode === 'raw' ? 'solid' : 'outline'} aria-pressed={mode === 'raw'} onClick={() => setMode('raw')}>Raw</Button><Button size="xs" variant={mode === 'pretty' ? 'solid' : 'outline'} aria-pressed={mode === 'pretty'} onClick={() => { if (r.body.kind === 'text') { const formatted = pretty ?? prettyJson(r.body.text); setPretty(formatted); setMode(formatted.ok ? 'pretty' : 'raw') } }}>Pretty</Button></Flex>
          {pretty && !pretty.ok && <Text>{pretty.message}</Text>}
          <Box as="pre" aria-label="Response body text" fontFamily="mono" fontSize="sm" whiteSpace="pre-wrap" overflowWrap="anywhere">{mode === 'pretty' && pretty?.ok ? pretty.text : r.body.text}</Box>
        </>}
      </Tabs.Content>
      <Tabs.Content value="headers"><Box as="pre" aria-label="Raw response headers" fontFamily="mono" fontSize="sm" whiteSpace="pre-wrap" overflowWrap="anywhere">{r.headers.length ? r.headers.map(header => `${header.name}: ${header.value}`).join('\n') : 'No response headers.'}</Box></Tabs.Content>
    </Tabs.Root>
  </>
}
