import { z } from 'zod'
import { LIMITS, fieldPathSchema, formatFieldPath, limitedText, uuidSchema, utf8ByteLength } from './primitives'

export const errorCodeSchema = z.enum([
  'FOLDER_EXPORT_UNAVAILABLE', 'EXPORT_WRITE_FAILED', 'VALIDATION', 'NOT_FOUND', 'OWNERSHIP', 'DATABASE_UNAVAILABLE', 'DATABASE_WRITE_FAILED',
  'VARIABLE_MISSING', 'SECRET_UNAVAILABLE', 'FILE_REQUIRED', 'FILE_CHANGED', 'FILE_TOO_LARGE',
  'REQUEST_BUSY', 'INVALID_URL', 'INVALID_HEADER', 'AUTH_CONFLICT', 'CONTENT_TYPE_CONFLICT',
  'UNSUPPORTED_SCHEME', 'TIMEOUT', 'CANCELLED', 'DNS_FAILURE', 'CONNECTION_REFUSED', 'TLS_FAILURE',
  'NETWORK_FAILURE', 'RESPONSE_TOO_LARGE', 'DECOMPRESSION_FAILURE', 'REDIRECT_LIMIT',
  'REDIRECT_DOWNGRADE', 'INVALID_IMPORT', 'UNSUPPORTED_FORMAT_VERSION', 'IMPORT_TOO_LARGE'
])
export const domainErrorSchema = z.strictObject({
  code: errorCodeSchema, message: z.string().min(1), field: fieldPathSchema.optional(), retryable: z.boolean()
})
export type ErrorCode = z.infer<typeof errorCodeSchema>
export type DomainError = z.infer<typeof domainErrorSchema>
export type ExecutionError = DomainError
export type Result<T> = { ok: true; data: T } | { ok: false; error: DomainError }
export function resultSchema<T extends z.ZodType>(dataSchema: T) {
  return z.discriminatedUnion('ok', [
    z.strictObject({ ok: z.literal(true), data: dataSchema }),
    z.strictObject({ ok: z.literal(false), error: domainErrorSchema })
  ])
}

// Never relay Zod messages/received payloads: unknown fields or credentials may be embedded.
export function validationError(error: z.ZodError, argumentTuple = false): DomainError {
  const path = error.issues[0]?.path ?? []
  const field = formatFieldPath(argumentTuple && typeof path[0] === 'number' ? path.slice(1) : path)
  return {
    code: 'VALIDATION', message: 'Invalid input', retryable: false,
    ...(field === undefined ? {} : { field })
  }
}

export const httpResponseSchema = z.strictObject({
  statusCode: z.number().int().min(100).max(599), statusMessage: z.string(),
  finalUrl: z.string().refine(value => {
    try {
      const url = new URL(value)
      return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname && !url.username && !url.password && !url.hash
    } catch { return false }
  }, 'Invalid response URL'),
  redirectCount: z.number().int().min(0).max(LIMITS.redirectHops),
  durationMs: z.number().nonnegative(), bodySizeBytes: z.number().int().min(0).max(LIMITS.decodedResponseBytes),
  headers: z.array(z.strictObject({ name: z.string(), value: z.string() })),
  body: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('text'), text: z.string().refine(value => utf8ByteLength(value) <= LIMITS.decodedResponseBytes, 'Response exceeds byte limit'), charset: z.literal('utf-8') }),
    z.strictObject({ kind: z.literal('binary'), sizeBytes: z.number().int().min(0).max(LIMITS.decodedResponseBytes), reason: z.string().min(1) })
  ])
}).superRefine((response, ctx) => {
  if (response.body.kind === 'binary' && response.body.sizeBytes !== response.bodySizeBytes) {
    ctx.addIssue({ code: 'custom', message: 'Inconsistent binary body size', path: ['body', 'sizeBytes'] })
  }
})
export const executionAcceptedSchema = z.strictObject({ executionId: uuidSchema })
export const executionCompletedSchema = z.strictObject({ executionId: uuidSchema, result: z.union([httpResponseSchema, domainErrorSchema]) })
// Reveal is intentionally separate from the masked list contract.
export const revealedValueSchema = z.strictObject({ value: limitedText() })
export type HttpResponse = z.infer<typeof httpResponseSchema>
export type ExecutionCompleted = z.infer<typeof executionCompletedSchema>
