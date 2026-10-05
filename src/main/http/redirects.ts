import { LIMITS } from '../../shared/primitives'
import type { ErrorCode, HttpResponse, Result } from '../../shared/results'
import type { MaterializedRequest } from './materialize'
import { executeSingleHop } from './transport'

type SingleHop = (snapshot: MaterializedRequest, signal: AbortSignal, startedAt: number) => Promise<Result<HttpResponse>>
const redirectStatuses = new Set([301, 302, 303, 307, 308])
const credentialHeaders = new Set(['authorization', 'proxy-authorization', 'cookie'])
function fail(code: ErrorCode, message: string): Result<never> { return { ok: false, error: { code, message, retryable: false } } }

/** Capture private replay bytes; callers and individual hops cannot mutate the next send. */
function replayPlan(source: MaterializedRequest, url: string, method = source.method, stripCredentials = false): MaterializedRequest {
  const dropBody = method === 'GET' && source.method !== 'GET'
  const bytes = dropBody ? null : source.bodyBytes
  const headers = source.headers.filter(header => {
    const name = header.name.toLowerCase()
    if (stripCredentials && credentialHeaders.has(name)) return false
    return !dropBody || (!name.startsWith('content-') && !['transfer-encoding', 'trailer', 'expect'].includes(name))
  }).map(header => Object.freeze({ ...header }))
  return Object.freeze({ method, url, ...(!dropBody && source.streamingBody ? { streamingBody: source.streamingBody } : {}), headers: Object.freeze(headers), timeoutMs: source.timeoutMs, followRedirects: false,
    get bodyBytes() { return bytes === null ? null : Buffer.from(bytes) }
  })
}

/** Optional, bounded redirects over the native transport. Never rematerialize variables or credentials. */
export async function executeWithRedirects(snapshot: MaterializedRequest, signal: AbortSignal, startedAt = performance.now(), singleHop: SingleHop = executeSingleHop): Promise<Result<HttpResponse>> {
  const follow = snapshot.followRedirects
  let plan = replayPlan(snapshot, snapshot.url), count = 0
  for (;;) {
    if (signal.aborted) return fail('CANCELLED', 'Request cancelled')
    const result = await singleHop(plan, signal, startedAt)
    if (!result.ok) return result
    const response = result.data
    const location = response.headers.find(header => header.name.toLowerCase() === 'location')?.value
    if (!follow || !redirectStatuses.has(response.statusCode) || location === undefined) return { ok: true, data: { ...response, redirectCount: count } }
    if (count === LIMITS.redirectHops) return fail('REDIRECT_LIMIT', 'Redirect limit of 5 hops exceeded')
    let target: URL
    try {
      if (!location.trim() || /[\r\n]/.test(location) || location.includes('#')) return fail('INVALID_URL', 'Invalid redirect target')
      target = new URL(location, plan.url)
    } catch { return fail('INVALID_URL', 'Invalid redirect target') }
    if (!['http:', 'https:'].includes(target.protocol)) return fail('UNSUPPORTED_SCHEME', 'Redirect target must use HTTP or HTTPS')
    if (!target.hostname || target.username || target.password || target.hash) return fail('INVALID_URL', 'Invalid redirect target')
    const current = new URL(plan.url)
    if (current.protocol === 'https:' && target.protocol === 'http:') return fail('REDIRECT_DOWNGRADE', 'HTTPS to HTTP redirect is not allowed')
    const rewrite = response.statusCode === 303 && plan.method !== 'HEAD' || (response.statusCode === 301 || response.statusCode === 302) && plan.method === 'POST'
    plan = replayPlan(plan, target.href, rewrite ? 'GET' : plan.method, current.origin !== target.origin)
    count++
  }
}
