import { Box, Button, Flex, Input, Text, VStack } from '@chakra-ui/react'
import { LIMITS } from '../../../shared/primitives'
import { updateRow, removeRow, moveRow, getRows, type RowGroup } from './fields-state'
import type { RequestController } from './controller'

export function RowsEditor({ controller: c, group }: { controller: RequestController; group: RowGroup }) {
  const label = group === 'queryRows' ? 'Param' : group === 'body.rows' ? 'Form' : 'Header', rows = getRows(c.draft, group)
  function error(path: string) { return c.validation[path] ? <Text id={`${path}-error`} role="alert" fontSize="sm" color="red.fg">{path}: {c.validation[path]}</Text> : null }
  return <VStack align="stretch" gap="3">
    <Text fontSize="sm" color="fg.muted">Rows keep their order and duplicate keys. Disabled rows are saved. Maximum 200 rows; 10,000 characters per key/value.</Text>
    {rows.map((row, index) => {
      const path = `${group}[${index}]`
      return <Box key={row.id} role="group" aria-label={`${label} row ${index + 1}`} borderWidth="1px" borderRadius="sm" p="2">
        <Flex gap="2" align="center" flexWrap="wrap" mb="2">
          <label><input type="checkbox" aria-label={`${label} ${index + 1} enabled`} checked={row.enabled} disabled={c.busy} onChange={event => { if (c.draft) c.setDraft(updateRow(c.draft, group, row.id, { enabled: event.target.checked })) }} /> Enabled</label>
          <Button size="xs" variant="outline" aria-label={`Move ${label.toLowerCase()} ${index + 1} up`} disabled={c.busy || index === 0} onClick={() => { if (c.draft) c.setDraft(moveRow(c.draft, group, row.id, -1)) }}>Move up</Button>
          <Button size="xs" variant="outline" aria-label={`Move ${label.toLowerCase()} ${index + 1} down`} disabled={c.busy || index === rows.length - 1} onClick={() => { if (c.draft) c.setDraft(moveRow(c.draft, group, row.id, 1)) }}>Move down</Button>
          <Button size="xs" variant="outline" aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} disabled={c.busy} onClick={() => { if (c.draft) c.setDraft(removeRow(c.draft, group, row.id)) }}>Remove</Button>
        </Flex>
        <Flex gap="2"><Input aria-label={`${label} ${index + 1} key`} placeholder="Key" value={row.key} disabled={c.busy} aria-invalid={!!c.validation[`${path}.key`]} aria-describedby={c.validation[`${path}.key`] ? `${path}.key-error` : undefined} onChange={event => { if (c.draft) c.setDraft(updateRow(c.draft, group, row.id, { key: event.target.value })) }} /><Input aria-label={`${label} ${index + 1} value`} placeholder="Value" value={row.value} disabled={c.busy} aria-invalid={!!c.validation[`${path}.value`]} aria-describedby={c.validation[`${path}.value`] ? `${path}.value-error` : undefined} onChange={event => { if (c.draft) c.setDraft(updateRow(c.draft, group, row.id, { value: event.target.value })) }} /></Flex>
        {error(`${path}.key`)}{error(`${path}.value`)}{error(`${path}.id`)}
      </Box>
    })}
    {rows.length === 0 && <Text color="fg.muted">No {group === 'queryRows' ? 'params' : group === 'body.rows' ? 'form fields' : 'headers'}.</Text>}
    {error(group)}
    <Button alignSelf="start" disabled={!c.draft || c.busy || rows.length >= LIMITS.rowsPerGroup} onClick={() => { void c.addRow(group) }}>Add {label.toLowerCase()}</Button>
  </VStack>
}
export function SettingsEditor({ controller: c }: { controller: RequestController }) {
  const path = 'timeoutMs'
  return <VStack align="stretch" gap="3">
    <Box><label htmlFor="request-timeout">Overall timeout (ms)</label><Input id="request-timeout" type="number" min={100} max={300000} step={1} value={Number.isNaN(c.draft?.timeoutMs) ? '' : c.draft?.timeoutMs ?? ''} disabled={!c.draft || c.busy} aria-invalid={!!c.validation[path]} aria-describedby={c.validation[path] ? 'timeout-error' : 'timeout-help'} onChange={event => { if (c.draft) c.setDraft({ ...c.draft, timeoutMs: event.target.value === '' ? Number.NaN : Number(event.target.value) }) }} />
      <Text id="timeout-help" mt="2" fontSize="sm">100–300,000 ms. The timeout covers the entire request, including redirects.</Text>
      {c.validation[path] && <Text id="timeout-error" mt="1" role="alert" color="red.fg">timeoutMs: {c.validation[path]}</Text>}
    </Box>
    <label><input type="checkbox" aria-label="Follow redirects" checked={c.draft?.followRedirects ?? false} disabled={!c.draft || c.busy} onChange={event => { if (c.draft) c.setDraft({ ...c.draft, followRedirects: event.target.checked }) }} /> Follow redirects</label>
    <Text>Secure TLS certificate verification is always enabled.</Text>
  </VStack>
}
