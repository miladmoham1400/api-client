import { useMemo, useState } from 'react'
import { prettyDifferenceJson } from './difference-json'
import { JsonResponse } from '../../components/json-text'
import type { JsonDifference } from '../../../shared/response-test'
import { Badge, Box, Text } from '@chakra-ui/react'
import type { ResponseTestResult } from '../../../shared/response-test'

export function ResponseTestView({ test }: { test: { bodyName: string; result: ResponseTestResult } }) {
  const r = test.result
  return <Box as="section" aria-label="Response test result" className="response-test-result" mb="3" p="3" borderWidth="1px" borderRadius="md">
    <Badge colorPalette={r.outcome === 'passed' ? 'green' : r.outcome === 'changed' ? 'red' : 'yellow'} role="status">{r.outcome === 'passed' ? 'Test passed' : r.outcome === 'changed' ? 'Response changed' : 'Test unavailable'}</Badge>
    <Text fontSize="xs" color="fg.muted" mt="1">{test.bodyName} · expectation captured at send time</Text>
    {r.outcome === 'unavailable' ? <Text fontSize="sm" mt="2">{r.message}</Text> : r.outcome === 'changed' ? <details open style={{ marginTop: 8 }}>
      <summary>{r.differences.length}{r.limited ? '+' : ''} differences</summary>
      {r.differences.map((difference, index) => <Difference key={index} difference={difference} />)}
      {r.limited && <Text fontSize="xs">Showing the first 100 differences.</Text>}
    </details> : null}
  </Box>
}

function Difference({ difference: d }: { difference: JsonDifference }) {
  const [open, setOpen] = useState(false)
  return <details onToggle={event => setOpen(event.currentTarget.open)} style={{ padding: '8px 0', borderBottom: '1px solid var(--chakra-colors-border)' }}>
    <summary style={{ fontFamily: 'var(--chakra-fonts-mono)', fontSize: 12, overflowWrap: 'anywhere' }}>{d.path} · {d.kind}</summary>
    {open && <Box pt="2" minW="0">
      {d.expected !== undefined && <DifferenceValue label="Expected" source={d.expected} color="red.fg" />}
      {d.actual !== undefined && <DifferenceValue label="Received" source={d.actual} color="green.fg" />}
    </Box>}
  </details>
}

function DifferenceValue({ label, source, color }: { label: string; source: string; color: string }) {
  const pretty = useMemo(() => prettyDifferenceJson(source), [source])
  return <Box as="section" aria-label={`${label} JSON`} mb="2" maxH="320px" overflow="auto">
    <Text fontSize="xs" color={color} mb="1">{label}</Text>
    <JsonResponse text={pretty} />
  </Box>
}
