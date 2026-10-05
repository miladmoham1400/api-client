import { BodyError, type BodyStream } from './body'
import { request as httpRequest, type ClientRequest, type IncomingMessage, type RequestOptions } from 'node:http'
import type { ConnectionOptions } from 'node:tls'
import { request as httpsRequest } from 'node:https'
import { Transform, Writable, type Duplex } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib'
import { isUtf8 } from 'node:buffer'
import { LIMITS } from '../../shared/primitives'
import { httpResponseSchema, type DomainError, type ErrorCode, type HttpResponse, type Result } from '../../shared/results'
import type { MaterializedRequest } from './materialize'

export function transportError(error: unknown): DomainError {
  if (error instanceof BodyError) return error.error
  const code = error && typeof error === 'object' ? Reflect.get(error, 'code') : undefined
  const mapped: ErrorCode = code === 'ENOTFOUND' || code === 'EAI_AGAIN' ? 'DNS_FAILURE'
    : code === 'ECONNREFUSED' ? 'CONNECTION_REFUSED'
    : code === 'EPROTO' || typeof code === 'string' && (/^(ERR_TLS_|ERR_SSL_|CERT_|DEPTH_|SELF_SIGNED_|UNABLE_TO_)/.test(code)) ? 'TLS_FAILURE'
    : 'NETWORK_FAILURE'
  const message = mapped === 'DNS_FAILURE' ? 'Host name could not be resolved'
    : mapped === 'CONNECTION_REFUSED' ? 'Connection was refused'
    : mapped === 'TLS_FAILURE' ? 'TLS certificate or handshake verification failed' : 'Network request failed'
  return { code: mapped, message, retryable: mapped !== 'TLS_FAILURE' }
}
function failure(code: ErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message, retryable: false } }
}

function classify(bytes: Buffer, contentType: string | undefined, unsupportedEncoding: boolean): HttpResponse['body'] {
  const binary = (reason: string): HttpResponse['body'] => ({ kind: 'binary', sizeBytes: bytes.length, reason })
  if (unsupportedEncoding) return binary('Unsupported content encoding')
  const charset = /(?:^|;)\s*charset\s*=\s*(?:"([^"]*)"|([^;\s]*))/i.exec(contentType ?? '')
  if (charset && !['utf-8', 'utf8'].includes((charset[1] ?? charset[2] ?? '').toLowerCase())) return binary('Unsupported charset')
  const type = contentType?.split(';')[0]?.trim().toLowerCase()
  if (type && !type.startsWith('text/') && !['application/json', 'application/xml', 'application/javascript'].includes(type) && !type.endsWith('+json') && !type.endsWith('+xml')) return binary('Binary content type')
  if (!isUtf8(bytes)) return binary('Invalid UTF-8')
  if (!contentType && bytes.includes(0)) return binary('Binary content without Content-Type')
  return { kind: 'text', text: bytes.toString('utf8'), charset: 'utf-8' }
}

type RequestFactory = (url: URL, options: RequestOptions & ConnectionOptions, callback: (response: IncomingMessage) => void) => ClientRequest
const nativeRequest: RequestFactory = (url, options, callback) => (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, options, callback)
/** Main-only HTTP/1.1; factory injection is private test infrastructure, never an IPC option. */
export function executeSingleHop(snapshot: MaterializedRequest, signal: AbortSignal, startedAt = performance.now(), send: RequestFactory = nativeRequest): Promise<Result<HttpResponse>> {
  if (snapshot.followRedirects) return Promise.resolve(failure('VALIDATION', 'Redirect following is not available yet'))
  return new Promise(resolve => {
    let upload: BodyStream | undefined
    let settled = false, request: ClientRequest | undefined, response: IncomingMessage | undefined, decoder: Duplex | undefined
    const finish = (result: Result<HttpResponse>) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abort)
      // Tear down all streams on success as well as failure; agent:false prevents pooled sockets.
      upload?.close()
      response?.destroy(); decoder?.destroy(); request?.destroy()
      resolve(result)
    }
    const abort = () => finish(failure('CANCELLED', 'Request cancelled'))
    if (signal.aborted) { abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    try {
      upload = snapshot.streamingBody?.open()
      if (signal.aborted) { abort(); return }
      const url = new URL(snapshot.url)
      const headers = snapshot.headers.flatMap(header => [header.name, header.value])
      headers.push('Host', url.host, 'Connection', 'close')
      request = send(url, { method: snapshot.method, headers, agent: false, rejectUnauthorized: true }, incoming => {
        if (settled) { incoming.destroy(); return }
        response = incoming
        let encodedBytes = 0, decodedBytes = 0
        const chunks: Buffer[] = []
        const encoding = incoming.headers['content-encoding']?.trim().toLowerCase() ?? ''
        const empty = snapshot.method === 'HEAD' || incoming.statusCode === 204 || incoming.statusCode === 304
        const supported = ['gzip', 'deflate', 'br'].includes(encoding)
        if (!empty) decoder = encoding === 'gzip' ? createGunzip() : encoding === 'deflate' ? createInflate() : encoding === 'br' ? createBrotliDecompress() : undefined
        let limitExceeded = false, decoderFailed = false
        decoder?.once('error', () => { decoderFailed = !limitExceeded && (incoming.complete || !incoming.destroyed) })
        const countEncoded = new Transform({ transform(chunk: Buffer, _encoding, callback) {
          encodedBytes += chunk.length
          if (encodedBytes > LIMITS.encodedResponseBytes) { limitExceeded = true; callback(new Error('Response limit')); return }
          callback(null, chunk)
        } })
        const collect = new Writable({ write(chunk: Buffer, _encoding, callback) {
          decodedBytes += chunk.length
          if (decodedBytes > LIMITS.decodedResponseBytes) { limitExceeded = true; callback(new Error('Response limit')); return }
          chunks.push(chunk); callback()
        } })
        const streams = decoder ? [incoming, countEncoded, decoder, collect] : [incoming, countEncoded, collect]
        void pipeline(streams).then(() => {
          if (settled) return
          const bytes = Buffer.concat(chunks, decodedBytes)
          const raw = incoming.rawHeaders
          const responseHeaders = []
          for (let i = 0; i < raw.length; i += 2) responseHeaders.push({ name: raw[i]!, value: raw[i + 1]! })
          const dto = httpResponseSchema.safeParse({
            statusCode: incoming.statusCode, statusMessage: incoming.statusMessage ?? '', finalUrl: snapshot.url,
            redirectCount: 0, durationMs: Math.max(0, performance.now() - startedAt), bodySizeBytes: bytes.length,
            headers: responseHeaders, body: classify(bytes, incoming.headers['content-type'], !!encoding && encoding !== 'identity' && !supported && !empty)
          })
          finish(dto.success ? { ok: true, data: dto.data } : failure('NETWORK_FAILURE', 'Invalid HTTP response'))
        }).catch((error: unknown) => {
          finish(limitExceeded ? failure('RESPONSE_TOO_LARGE', 'Response exceeds 10 MiB limit') : decoderFailed ? failure('DECOMPRESSION_FAILURE', 'Response decompression failed') : { ok: false, error: transportError(error) })
        })
      })
      request.once('error', error => finish({ ok: false, error: transportError(error) }))
      request.once('upgrade', (_response, socket) => { socket.destroy(); finish(failure('NETWORK_FAILURE', 'Protocol upgrade is not supported')) })
      if (upload) {
        void pipeline(upload.stream, request).catch((error: unknown) => { if (!settled) finish({ ok: false, error: transportError(error) }) })
      } else request.end(snapshot.bodyBytes ?? undefined)
    } catch (error) { finish({ ok: false, error: transportError(error) }) }
  })
}
