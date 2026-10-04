import { randomUUID } from 'node:crypto'
import type { MaterializationService } from './materialization'
import { executeWithRedirects } from '../http/redirects'
import type { MaterializedRequest } from '../http/materialize'
import type { RequestDraft } from '../../shared/requests'
import { executionCompletedSchema, type ExecutionCompleted, type HttpResponse, type Result } from '../../shared/results'

type Transport = (snapshot: MaterializedRequest, signal: AbortSignal, startedAt: number) => Promise<Result<HttpResponse>>
interface ActiveExecution { id: string; workspace: string; snapshot: MaterializedRequest; controller: AbortController; startedAt: number; started: boolean }

export class ExecutionService {
  private active: ActiveExecution | null = null
  constructor(private readonly materializer: Pick<MaterializationService, 'capture'>, private readonly completed: (completion: ExecutionCompleted) => void, private readonly transport: Transport = executeWithRedirects) {}
  send(workspace: string, request: string | null, draft: RequestDraft, environment: string | null): Result<{ executionId: string }> {
    if (this.active) return { ok: false, error: { code: 'REQUEST_BUSY', message: 'A request is already running', retryable: false } }
    const captured = this.materializer.capture(workspace, request, draft, environment)
    if (!captured.ok) return captured
    const id = randomUUID()
    this.active = { id, workspace, snapshot: captured.data, controller: new AbortController(), startedAt: performance.now(), started: false }
    return { ok: true, data: { executionId: id } }
  }
  // Private preload acknowledgement: acceptance has arrived before network I/O can start.
  start(id: string): void {
    const execution = this.active
    if (!execution || execution.id !== id || execution.started) return
    execution.started = true
    void Promise.resolve().then(() => this.transport(execution.snapshot, execution.controller.signal, execution.startedAt))
      .then(result => this.finish(execution, result))
      .catch(() => this.finish(execution, { ok: false, error: { code: 'NETWORK_FAILURE', message: 'Network request failed', retryable: true } }))
  }
  private finish(execution: ActiveExecution, result: Result<HttpResponse>): void {
    if (this.active !== execution) return
    const completion = executionCompletedSchema.safeParse({ executionId: execution.id, result: result.ok ? result.data : result.error })
    this.active = null
    this.completed(completion.success ? completion.data : { executionId: execution.id, result: { code: 'NETWORK_FAILURE', message: 'Invalid HTTP response', retryable: false } })
  }
  abortWorkspace(workspace: string): void { if (this.active?.workspace === workspace) this.abort() }
  abort(): void {
    const execution = this.active
    if (!execution) return
    execution.controller.abort()
    this.finish(execution, { ok: false, error: { code: 'CANCELLED', message: 'Request cancelled', retryable: false } })
  }
}
