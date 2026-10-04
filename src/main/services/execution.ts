import { randomUUID } from 'node:crypto'
import type { MaterializationService } from './materialization'
import { executeWithRedirects } from '../http/redirects'
import type { MaterializedRequest } from '../http/materialize'
import type { RequestDraft } from '../../shared/requests'
import { executionCompletedSchema, type DomainError, type ExecutionCompleted, type HttpResponse, type Result } from '../../shared/results'

type Transport = (snapshot: MaterializedRequest, signal: AbortSignal, startedAt: number) => Promise<Result<HttpResponse>>
interface ActiveExecution {
  id: string; workspace: string; snapshot: MaterializedRequest; controller: AbortController; startedAt: number; started: boolean
  deadline: number; timer: ReturnType<typeof setTimeout> | null; terminal: DomainError | null
}

export class ExecutionService {
  private active: ActiveExecution | null = null
  constructor(private readonly materializer: Pick<MaterializationService, 'capture'>, private readonly completed: (completion: ExecutionCompleted) => void, private readonly transport: Transport = executeWithRedirects) {}
  send(workspace: string, request: string | null, draft: RequestDraft, environment: string | null): Result<{ executionId: string }> {
    if (this.active) return { ok: false, error: { code: 'REQUEST_BUSY', message: 'A request is already running', retryable: false } }
    const captured = this.materializer.capture(workspace, request, draft, environment)
    if (!captured.ok) return captured
    const id = randomUUID()
    const startedAt = performance.now()
    this.active = { id, workspace, snapshot: captured.data, controller: new AbortController(), startedAt, started: false,
      deadline: startedAt + captured.data.timeoutMs, timer: null, terminal: null }
    this.armDeadline(this.active)
    return { ok: true, data: { executionId: id } }
  }
  // Private preload acknowledgement: acceptance has arrived before network I/O can start.
  start(id: string): void {
    const execution = this.active
    if (!execution || execution.id !== id || execution.started) return
    execution.started = true
    if (execution.terminal) { this.finish(execution, { ok: false, error: execution.terminal }); return }
    if (performance.now() >= execution.deadline) { this.terminate(execution, 'TIMEOUT'); return }
    void Promise.resolve().then(() => {
      if (this.active !== execution || execution.terminal) return { ok: false as const, error: execution.terminal ?? this.terminalError('CANCELLED') }
      return this.transport(execution.snapshot, execution.controller.signal, execution.startedAt)
    })
      .then(result => this.finish(execution, result))
      .catch(() => this.finish(execution, { ok: false, error: { code: 'NETWORK_FAILURE', message: 'Network request failed', retryable: true } }))
  }
  private finish(execution: ActiveExecution, result: Result<HttpResponse>): void {
    if (this.active !== execution) return
    if (!execution.terminal && performance.now() >= execution.deadline) { this.terminate(execution, 'TIMEOUT'); return }
    if (execution.terminal) result = { ok: false, error: execution.terminal }
    const completion = executionCompletedSchema.safeParse({ executionId: execution.id, result: result.ok ? result.data : result.error })
    this.clearTimer(execution)
    this.active = null
    this.completed(completion.success ? completion.data : { executionId: execution.id, result: { code: 'NETWORK_FAILURE', message: 'Invalid HTTP response', retryable: false } })
  }
  abortWorkspace(workspace: string): void { if (this.active?.workspace === workspace) this.abort() }
  cancel(id: string): void { if (this.active?.id === id) this.terminate(this.active, performance.now() >= this.active.deadline ? 'TIMEOUT' : 'CANCELLED') }
  abort(): void {
    const execution = this.active
    if (!execution) return
    // Lifecycle teardown also releases an unacknowledged slot; its renderer is disappearing.
    this.terminate(execution, 'CANCELLED')
    if (this.active === execution) this.finish(execution, { ok: false, error: execution.terminal ?? this.terminalError('CANCELLED') })
  }
  private terminalError(code: 'CANCELLED' | 'TIMEOUT'): DomainError {
    return { code, message: code === 'TIMEOUT' ? 'Request exceeded the overall timeout' : 'Request cancelled', retryable: false }
  }
  private terminate(execution: ActiveExecution, code: 'CANCELLED' | 'TIMEOUT'): void {
    if (this.active !== execution || execution.terminal) return
    execution.terminal = this.terminalError(code)
    this.clearTimer(execution)
    execution.controller.abort(execution.terminal)
    // Preserve acceptance-before-completion even if the renderer's acknowledgement is delayed.
    if (execution.started) this.finish(execution, { ok: false, error: execution.terminal })
  }
  private clearTimer(execution: ActiveExecution): void {
    if (execution.timer !== null) clearTimeout(execution.timer)
    execution.timer = null
  }
  private armDeadline(execution: ActiveExecution): void {
    execution.timer = setTimeout(() => {
      execution.timer = null
      if (this.active !== execution || execution.terminal) return
      if (performance.now() < execution.deadline) { this.armDeadline(execution); return }
      this.terminate(execution, 'TIMEOUT')
    }, Math.max(1, Math.ceil(execution.deadline - performance.now())))
  }
}
