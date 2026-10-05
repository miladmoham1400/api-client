import { Box, Button, Flex, Input, NativeSelect, Text, VStack } from '@chakra-ui/react'
import { LIMITS } from '../../../shared/primitives'
import type { RequestController } from './controller'

export function MultipartEditor({ controller: c }: { controller: RequestController }) {
  const body = c.draft?.body
  if (body?.kind !== 'multipart') return null
  const rows = body.rows
  const error = (path: string) => c.validation[path] || c.executionField === path ? <Text id={`${path}-error`} role="alert" color="red.fg">{c.validation[path] ?? c.executionError}</Text> : null
  return <VStack align="stretch" gap="3">
    <Text fontSize="sm">Enabled fields retain order and duplicate keys. Keys and text values resolve variables at send time. Content-Type and boundary are generated automatically; remove an explicit Content-Type header.</Text>
    <Text fontSize="sm">Files: 20 MiB each, 50 MiB total; complete payload: 55 MiB. Saved files require selection again after reopening. Maximum 200 rows.</Text>
    {rows.map((row, index) => {
      const path = `body.rows[${index}]`
      const update = (key: string, enabled: boolean) => c.changeMultipart(rows.map(item => item.id === row.id ? { ...item, key, enabled } : item))
      const move = (direction: -1 | 1) => { const next = [...rows]; next.splice(index, 1); next.splice(index + direction, 0, row); c.changeMultipart(next) }
      return <Box key={row.id} role="group" aria-label={`Multipart row ${index + 1}`} borderWidth="1px" borderRadius="sm" p="2">
        <Flex gap="2" align="center" flexWrap="wrap" mb="2">
          <label><input type="checkbox" aria-label={`Multipart ${index + 1} enabled`} checked={row.enabled} disabled={c.busy} onChange={event => update(row.key, event.target.checked)} /> Enabled</label>
          <NativeSelect.Root width="100px" disabled={c.busy}><NativeSelect.Field aria-label={`Multipart ${index + 1} type`} value={row.kind} onChange={event => c.changeMultipart(rows.map(item => item.id !== row.id ? item : event.target.value === 'text' ? { id: row.id, key: row.key, enabled: row.enabled, kind: 'text', value: '' } : { id: row.id, key: row.key, enabled: row.enabled, kind: 'file' }))}><option value="text">Text</option><option value="file">File</option></NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
          <Button size="xs" variant="outline" aria-label={`Move multipart ${index + 1} up`} disabled={c.busy || index === 0} onClick={() => move(-1)}>Move up</Button>
          <Button size="xs" variant="outline" aria-label={`Move multipart ${index + 1} down`} disabled={c.busy || index === rows.length - 1} onClick={() => move(1)}>Move down</Button>
          <Button size="xs" variant="outline" aria-label={`Remove multipart ${index + 1}`} disabled={c.busy} onClick={() => c.changeMultipart(rows.filter(item => item.id !== row.id))}>Remove</Button>
        </Flex>
        <Flex gap="2" align="center" flexWrap="wrap">
          <Input aria-label={`Multipart ${index + 1} key`} placeholder="Key" value={row.key} disabled={c.busy} aria-invalid={!!c.validation[`${path}.key`]} aria-describedby={c.validation[`${path}.key`] ? `${path}.key-error` : undefined} onChange={event => update(event.target.value, row.enabled)} />
          {row.kind === 'text' ? <Input aria-label={`Multipart ${index + 1} value`} placeholder="Value" value={row.value} disabled={c.busy} aria-invalid={!!c.validation[`${path}.value`]} aria-describedby={c.validation[`${path}.value`] ? `${path}.value-error` : undefined} onChange={event => c.changeMultipart(rows.map(item => item.id === row.id && item.kind === 'text' ? { ...item, value: event.target.value } : item))} /> : <>
            <Button size="sm" disabled={c.busy} aria-label={`Choose multipart ${index + 1} file`} aria-describedby={c.validation[`${path}.fileId`] ? `${path}.fileId-error` : undefined} onClick={() => { void c.chooseFile(row.id) }}>{row.fileId ? 'Replace file' : 'Choose file'}</Button>
            <Text fontSize="sm">{row.fileName ?? 'No file selected'}{row.fileSize === undefined ? '' : ` (${row.fileSize.toLocaleString()} bytes)`}{!row.fileId && row.fileName ? ' — select again' : ''}</Text>
          </>}
        </Flex>
        {error(`${path}.key`)}{error(`${path}.value`)}{error(`${path}.fileId`)}{error(`${path}.id`)}
      </Box>
    })}
    {rows.length === 0 && <Text>No multipart fields.</Text>}{error('body.rows')}
    <Flex gap="2"><Button disabled={c.busy || rows.length >= LIMITS.rowsPerGroup} onClick={() => { void c.addRow('body.rows', 'text') }}>Add multipart text</Button><Button disabled={c.busy || rows.length >= LIMITS.rowsPerGroup} onClick={() => { void c.addRow('body.rows', 'file') }}>Add multipart file</Button></Flex>
  </VStack>
}
