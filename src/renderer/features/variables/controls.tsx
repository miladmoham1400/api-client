import { useEffect, useRef, useState } from 'react'
import { Box, Button, Dialog, Flex, Input, NativeSelect, Portal, Text, VStack } from '@chakra-ui/react'
import type { EnvironmentSnapshot, VariableSnapshot } from '../../../shared/variable-management'
import { nameSchema, variableKeySchema, limitedText } from '../../../shared/primitives'
import type { Result } from '../../../shared/results'

export function VariableControls({ workspace }: { workspace: string | null }) {
  const [env, setEnv] = useState<EnvironmentSnapshot | null>(null), [vars, setVars] = useState<VariableSnapshot | null>(null)
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<string | null>(null), [envName, setEnvName] = useState(''), [confirm, setConfirm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null), [key, setKey] = useState(''), [value, setValue] = useState(''), [sensitive, setSensitive] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const trigger = useRef<HTMLButtonElement>(null), keyInput = useRef<HTMLInputElement>(null), running = useRef(false), generation = useRef(0)
  function clearEditor() { setEditing(null); setKey(''); setValue(''); setSensitive(false); setRevealed({}) }
  useEffect(() => {
    let active = true
    if (workspace) {
      setBusy(true); running.current = true
      void window.offlineApi.environments.list(workspace).then(result => { if (active) { if (result.ok) setEnv(result.data); else setError('Environments could not be loaded.') } }).catch(() => { if (active) setError('Environments unavailable.') }).finally(() => { if (active) { setBusy(false); running.current = false } })
    }
    return () => { active = false; generation.current++ }
  }, [workspace])
  async function apply(operation: () => Promise<Result<EnvironmentSnapshot | VariableSnapshot>>, nextScope = scope) {
    if (!workspace || running.current) return false
    running.current = true; setBusy(true); setError(null)
    const token = ++generation.current
    try {
      const result = await operation()
      if (token !== generation.current) return false
      if (!result.ok) { setError(result.error.code === 'VALIDATION' ? 'Check the name, key/value limits and duplicate keys in this scope.' : result.error.message); return false }
      if ('items' in result.data) setVars(result.data)
      else {
        setEnv(result.data)
        if (nextScope && nextScope !== result.data.activeEnvironmentId) nextScope = result.data.activeEnvironmentId
        setScope(nextScope); setConfirm(false); clearEditor()
        if (open) { const listed = await window.offlineApi.variables.list(workspace, nextScope); if (token !== generation.current) return false; if (listed.ok) setVars(listed.data); else setError('Variables could not be loaded.') }
      }
      return true
    } catch { if (token === generation.current) setError('Local variable operation unavailable. Your entries have been kept.'); return false }
    finally { if (token === generation.current) { setBusy(false); running.current = false } }
  }
  async function show() { if (!workspace) return; clearEditor(); setScope(null); setOpen(true); await apply(() => window.offlineApi.variables.list(workspace, null), null) }
  async function reveal(id: string, edit: boolean) {
    if (!workspace || running.current) return
    const item = vars?.items.find(v => v.id === id); if (!item) return
    if (edit && item.isSensitive && !item.hasValue) { setEditing(id); setKey(item.key); setValue(''); setSensitive(true); setRevealed({}); return }
    running.current = true; setBusy(true); setError(null); const token = ++generation.current
    try {
      const result = await window.offlineApi.variables.reveal(workspace, id)
      if (token !== generation.current) return
      if (result.ok) { if (edit) { setEditing(id); setKey(item.key); setValue(result.data.value); setSensitive(item.isSensitive); setRevealed({}) } else setRevealed(v => ({ ...v, [id]: result.data.value })) }
      else setError(result.error.message)
    } catch { if (token === generation.current) setError('Value unavailable. Re-enter it.') }
    finally { if (token === generation.current) { setBusy(false); running.current = false } }
  }
  const active = env?.environments.find(e => e.id === env.activeEnvironmentId)
  async function save() {
    if (!workspace) return
    if (!variableKeySchema.safeParse(key).success || !limitedText().safeParse(value).success) { setError('Key must use letters, digits or underscore, begin with a letter/underscore and contain at most 64 characters. Value limit: 10,000 characters.'); keyInput.current?.focus(); return }
    if (await apply(() => window.offlineApi.variables.upsert(workspace, scope, key, value, sensitive, editing))) clearEditor()
  }
  return <>
    <NativeSelect.Root width="190px" disabled={!workspace || !env || busy}><NativeSelect.Field aria-label="Environment" value={env?.activeEnvironmentId ?? ''} onChange={event => { const id = event.target.value || null; setEnvName(env?.environments.find(e => e.id === id)?.name ?? ''); if (workspace) void apply(() => window.offlineApi.environments.select(workspace, id)) }}><option value="">None</option>{env?.environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
    <Button ref={trigger} disabled={!workspace || !env || busy} variant="outline" size="sm" onClick={() => { void show() }}>Variables</Button>
    {error && !open && <Text role="alert" fontSize="sm">{error}</Text>}
    <Dialog.Root open={open} onOpenChange={({ open: next }) => { if (!busy) { setOpen(next); if (!next) { clearEditor(); setError(null); setVars(null); setConfirm(false) } } }} initialFocusEl={() => keyInput.current} finalFocusEl={() => trigger.current}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content maxW="760px"><Dialog.Header><Dialog.Title>Environments and variables</Dialog.Title></Dialog.Header><Dialog.Body maxH="65vh" overflow="auto"><VStack align="stretch" gap="3">
        {error && <Text role="alert">{error}</Text>}
        <Text fontWeight="bold">Environments</Text>
        <label htmlFor="environment-name">Environment name</label><Input id="environment-name" value={envName} disabled={busy} onChange={event => setEnvName(event.target.value)} />
        <Flex gap="2" flexWrap="wrap"><Button disabled={busy} onClick={() => { if (!workspace) return; if (!nameSchema.safeParse(envName).success) { setError('Environment name must contain 1–100 characters after trimming.'); return }; void apply(() => window.offlineApi.environments.create(workspace, envName)) }}>Create environment</Button><Button disabled={busy || !active} onClick={() => { if (!workspace || !active) return; if (!nameSchema.safeParse(envName).success) { setError('Environment name must contain 1–100 characters after trimming.'); return }; void apply(() => window.offlineApi.environments.rename(workspace, active.id, envName)) }}>Rename selected environment</Button><Button disabled={busy || !active} onClick={() => setConfirm(true)}>Delete selected environment</Button></Flex>
        <NativeSelect.Root disabled={busy}><NativeSelect.Field aria-label="Managed environment" value={env?.activeEnvironmentId ?? ''} onChange={event => { const id = event.target.value || null; setEnvName(env?.environments.find(e => e.id === id)?.name ?? ''); if (workspace) void apply(() => window.offlineApi.environments.select(workspace, id)) }}><option value="">None</option>{env?.environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
        {confirm && active && <Box borderWidth="1px" p="2"><Text>Delete “{active.name}” and its variables? This cannot be undone. The selected environment becomes None.</Text><Button disabled={busy} onClick={() => setConfirm(false)}>Cancel environment deletion</Button><Button disabled={busy} onClick={() => { if (workspace) void apply(() => window.offlineApi.environments.delete(workspace, active.id), null) }}>Confirm environment deletion</Button></Box>}
        <label htmlFor="variable-scope">Variable scope</label><NativeSelect.Root disabled={busy}><NativeSelect.Field id="variable-scope" value={scope ?? ''} onChange={event => { const next = event.target.value || null; setScope(next); clearEditor(); setVars(null); if (workspace) void apply(() => window.offlineApi.variables.list(workspace, next), next) }}><option value="">Workspace</option>{active && <option value={active.id}>Selected environment: {active.name}</option>}</NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
        <Text fontSize="sm">Sensitive designation protects marked values at rest; ordinary URL/body/header/plain-variable text can contain plaintext. Use sensitive variables for credentials.</Text>
        <Text fontSize="sm">{env?.storageMode === 'secure' ? 'Secure storage available.' : 'Session only: re-enter after restart'}</Text>
        {!vars ? <Text role="status">Loading variables…</Text> : vars.items.length === 0 ? <Text>No variables in this scope.</Text> : vars.items.map(item => <Box key={item.id} borderWidth="1px" p="2" role="group" aria-label={`Variable ${item.key}`}><Text>{item.key}: {item.isSensitive ? revealed[item.id] ?? item.maskedDisplay : item.value}</Text>{item.isSensitive && <Text fontSize="sm">{!item.hasValue ? 'Missing sensitive value: re-enter it.' : item.storageMode === 'session' ? 'Session only: re-enter after restart' : 'Securely stored'}</Text>}<Flex gap="2"><Button size="xs" disabled={busy} onClick={() => { void reveal(item.id, true) }}>{item.isSensitive && !item.hasValue ? 'Re-enter' : 'Edit'} {item.key}</Button>{item.isSensitive && <Button size="xs" disabled={busy || !item.hasValue} onClick={() => { if (revealed[item.id] !== undefined) setRevealed(v => { const next = { ...v }; delete next[item.id]; return next }); else void reveal(item.id, false) }}>{revealed[item.id] !== undefined ? 'Hide' : 'Reveal'} {item.key}</Button>}<Button size="xs" disabled={busy} onClick={() => { if (workspace) void apply(() => window.offlineApi.variables.delete(workspace, item.id)).then(ok => { if (ok) clearEditor() }) }}>Delete {item.key}</Button></Flex></Box>)}
        <label htmlFor="variable-key">Variable key</label><Input ref={keyInput} id="variable-key" value={key} disabled={busy || editing !== null} onChange={event => setKey(event.target.value)} />
        <label htmlFor="variable-value">Variable value</label><Input id="variable-value" type={sensitive ? 'password' : 'text'} value={value} disabled={busy} onChange={event => setValue(event.target.value)} />
        <label><input type="checkbox" aria-label="Sensitive variable" checked={sensitive} disabled={busy} onChange={event => setSensitive(event.target.checked)} /> Sensitive</label>
        <Flex gap="2"><Button disabled={busy} onClick={() => { void save() }}>{editing ? 'Save variable' : 'Add variable'}</Button><Button disabled={busy} variant="outline" onClick={clearEditor}>Clear variable editor</Button></Flex>
        <Text fontWeight="bold">Effective values (selected environment overrides workspace)</Text>{vars?.effective.map(item => <Text key={item.key} fontSize="sm">{item.key}: {item.isSensitive ? item.maskedDisplay : item.value} — {item.environmentId ? 'Selected environment' : 'Workspace'}</Text>)}
      </VStack></Dialog.Body><Dialog.Footer><Button disabled={busy} onClick={() => { setOpen(false); clearEditor(); setVars(null); setError(null); setConfirm(false) }}>Close variables</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </>
}
