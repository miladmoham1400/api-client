import { useCallback, useEffect, useRef, useState } from 'react'
import type { RequestDraft } from '../../../shared/requests'
import type { ExecutionCompleted } from '../../../shared/results'

/** Own one subscription and one send attempt; response presentation belongs to the response feature. */
export function useExecution(workspace: string | null, draft: RequestDraft | null, requestId: string | null) {
  const [ready, setReady] = useState(false), [sending, setSending] = useState(false), [executionId, setExecutionId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false), [status, setStatus] = useState<string | null>(null), [error, setError] = useState<string | null>(null)
  const [executionField, setExecutionField] = useState<string | null>(null)
  const [executionResult, setExecutionResult] = useState<ExecutionCompleted['result'] | null>(null)
  const [completedExecutionId, setCompletedExecutionId] = useState<string | null>(null)
  const [sentSnapshot, setSentSnapshot] = useState<{ name: string; method: string; urlTemplate: string; environment: string } | null>(null)
  // Ephemeral draft comparison only: never persisted, logged or sent back through IPC.
  const sentDraft = useRef<string | null>(null)
  const active = useRef<string | null>(null), pending = useRef(false), mounted = useRef(false), generation = useRef(0)
  const cancellationRequested = useRef(false)
  const cancellationRunning = useRef(false)
  const cancellationWaiters = useRef<Array<(settled: boolean) => void>>([])
  const settleCancellation = useCallback((settled: boolean) => {
    cancellationRequested.current = false; cancellationRunning.current = false
    const waiters = cancellationWaiters.current.splice(0)
    for (const resolve of waiters) resolve(settled)
  }, [])
  const cancel = useCallback(async () => {
    const id = active.current
    if (!id || cancellationRunning.current) return
    cancellationRunning.current = true; setCancelling(true)
    try {
      const result = await window.offlineApi.execution.cancel(id)
      if (!result.ok && mounted.current && active.current === id) { setCancelling(false); setError('Cancellation is unavailable. Try again.'); settleCancellation(false) }
    } catch { if (mounted.current && active.current === id) { setCancelling(false); setError('Cancellation is unavailable. Try again.'); settleCancellation(false) } }
  }, [settleCancellation])
  const cancelForTransition = useCallback((): Promise<boolean> => {
    if (!pending.current && !active.current) return Promise.resolve(true)
    cancellationRequested.current = true
    return new Promise(resolve => { cancellationWaiters.current.push(resolve); void cancel() })
  }, [cancel])
  const early = useRef<ExecutionCompleted | null>(null)
  const takeEarly = (): ExecutionCompleted | null => { const event = early.current; early.current = null; return event }
  const complete = useCallback((event: ExecutionCompleted) => {
    if (!mounted.current || event.executionId !== active.current) return
    setExecutionResult(event.result); setCompletedExecutionId(event.executionId)
    active.current = null; pending.current = false; early.current = null; settleCancellation(true)
    setExecutionId(null); setSending(false); setCancelling(false)
    if ('statusCode' in event.result) { setStatus('Request completed'); setError(null) }
    else if (event.result.code === 'CANCELLED') { setStatus('Request cancelled'); setError(null) }
    else { setExecutionField(event.result.field ?? null); setStatus(null); setError(`${event.result.code}: ${event.result.message}${event.result.field ? ` (${event.result.field})` : ''}`) }
  }, [settleCancellation])
  useEffect(() => {
    mounted.current = true
    const stop = window.offlineApi.execution.onCompleted(event => {
      if (active.current === event.executionId) complete(event)
      else if (pending.current && !active.current) early.current = event
    })
    setReady(true)
    return () => {
      mounted.current = false; generation.current++; stop(); settleCancellation(false)
      if (active.current) void window.offlineApi.execution.cancel(active.current).catch(() => {})
      active.current = null; pending.current = false; early.current = null
    }
  }, [complete, settleCancellation])
  useEffect(() => {
    generation.current++; settleCancellation(false)
    sentDraft.current = null; setSentSnapshot(null); setExecutionResult(null); setCompletedExecutionId(null)
    if (active.current) void window.offlineApi.execution.cancel(active.current).catch(() => {})
    active.current = null; pending.current = false; early.current = null
    setExecutionId(null); setSending(false); setCancelling(false); setStatus(null); setError(null); setExecutionField(null)
  }, [workspace, settleCancellation])
  const send = useCallback(async () => {
    if (!ready || !mounted.current || pending.current || !workspace || !draft) return
    const captured = structuredClone(draft), current = generation.current
    sentDraft.current = JSON.stringify(captured); setSentSnapshot({ name: captured.name, method: captured.method, urlTemplate: captured.urlTemplate, environment: 'Selecting…' }); setExecutionResult(null); setCompletedExecutionId(null)
    pending.current = true; early.current = null; setSending(true); setError(null); setExecutionField(null); setStatus('Preparing request…')
    try {
      const environments = await window.offlineApi.environments.list(workspace)
      if (!mounted.current || current !== generation.current) return
      if (!environments.ok) { pending.current = false; settleCancellation(true); setSending(false); setStatus(null); setError('Selected environment is unavailable. Try again.'); return }
      setSentSnapshot({ name: captured.name, method: captured.method, urlTemplate: captured.urlTemplate, environment: environments.data.environments.find(item => item.id === environments.data.activeEnvironmentId)?.name ?? 'None' })
      const accepted = await window.offlineApi.execution.send(workspace, requestId, captured, environments.data.activeEnvironmentId)
      if (!mounted.current || current !== generation.current) {
        if (accepted.ok) void window.offlineApi.execution.cancel(accepted.data.executionId).catch(() => {})
        return
      }
      if (!accepted.ok) { setExecutionField(accepted.error.field ?? null); pending.current = false; early.current = null; settleCancellation(true); setSending(false); setStatus(null); setError(`${accepted.error.code}: ${accepted.error.message}${accepted.error.field ? ` (${accepted.error.field})` : ''}`); return }
      active.current = accepted.data.executionId; setExecutionId(active.current); setStatus('Sending request…')
      const queued = takeEarly()
      if (queued?.executionId === active.current) complete(queued)
      if (cancellationRequested.current) void cancel()
    } catch {
      if (mounted.current && current === generation.current) { pending.current = false; settleCancellation(true); setSending(false); setStatus(null); setError('Request execution is unavailable. Try again.') }
    }
  }, [ready, workspace, draft, requestId, complete, cancel, settleCancellation])
  return { executionField, executionResult, completedExecutionId, sentSnapshot, draftChangedSinceSend: sentDraft.current !== null && JSON.stringify(draft) !== sentDraft.current, sending, cancelling, executionStatus: status, executionError: error, canSend: ready && !!workspace && !!draft?.urlTemplate.trim() && !sending,
    canCancel: executionId !== null && !cancelling, send, cancel, cancelForTransition, isSending: () => pending.current || active.current !== null }
}
