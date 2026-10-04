import { z } from 'zod'

const MiB = 1024 * 1024
export const LIMITS = Object.freeze({
  nameCharacters: 100,
  rowsPerGroup: 200,
  variablesPerScope: 100,
  fieldCharacters: 10_000,
  textBodyBytes: 5 * MiB,
  fileBytes: 20 * MiB,
  selectedFileBytes: 50 * MiB,
  requestPayloadBytes: 55 * MiB,
  encodedResponseBytes: 10 * MiB,
  decodedResponseBytes: 10 * MiB,
  importBytes: 10 * MiB,
  collections: 100,
  environments: 50,
  requests: 1_000,
  timeoutMinMs: 100,
  timeoutMaxMs: 300_000,
  timeoutDefaultMs: 30_000,
  redirectHops: 5
})

// Shared code uses web-standard primitives, never Electron, Node or filesystem APIs.
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export function limitedText(maxCharacters = LIMITS.fieldCharacters) {
  return z.string().refine(value => Array.from(value).length <= maxCharacters, 'Text exceeds character limit')
}

export const uuidSchema = z.uuid().transform(value => value.toLowerCase())
export const timestampSchema = z.iso.datetime()
export const nameSchema = z.string().trim().refine(
  value => Array.from(value).length >= 1 && Array.from(value).length <= LIMITS.nameCharacters,
  'Name must contain 1–100 characters'
)
export const variableKeySchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/, 'Invalid variable key')
export const timeoutSchema = z.number().int().min(LIMITS.timeoutMinMs).max(LIMITS.timeoutMaxMs)
export const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
export const textBodySchema = z.string().refine(value => utf8ByteLength(value) <= LIMITS.textBodyBytes, 'Body exceeds byte limit')
export const mediaTypeSchema = limitedText().regex(
  /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+(?:\s*;\s*[!#$%&'*+.^_`|~0-9A-Za-z-]+=(?:[!#$%&'*+.^_`|~0-9A-Za-z-]+|"[^"\r\n]*"))*$/,
  'Invalid media type'
)

export const fieldPathSchema = z.string().max(500).regex(
  /^[A-Za-z_][A-Za-z0-9_]*(?:(?:\.[A-Za-z_][A-Za-z0-9_]*)|(?:\[(?:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]))*$/,
  'Invalid field path'
)
export type FieldPath = z.infer<typeof fieldPathSchema>
export type UUID = z.infer<typeof uuidSchema>

export function formatFieldPath(path: readonly PropertyKey[]): FieldPath | undefined {
  let result = ''
  for (const segment of path) {
    if (typeof segment === 'number' && Number.isSafeInteger(segment) && segment >= 0) result += `[${segment}]`
    else if (typeof segment === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) result += `${result ? '.' : ''}${segment}`
    else return undefined
  }
  const parsed = fieldPathSchema.safeParse(result)
  return parsed.success ? parsed.data : undefined
}

// A stable row ID can survive reorder; numeric Zod issue paths identify the submitted snapshot.
export function rowFieldPath(group: FieldPath, rowId: UUID, field: string): FieldPath {
  return fieldPathSchema.parse(`${fieldPathSchema.parse(group)}[${uuidSchema.parse(rowId)}].${field}`)
}

export function uniqueIds<T extends z.ZodType<{ id: string }>>(schema: T, max: number) {
  return z.array(schema).max(max).superRefine((rows, ctx) => {
    const seen = new Set<string>()
    rows.forEach((row, index) => {
      if (seen.has(row.id)) ctx.addIssue({ code: 'custom', message: 'Duplicate ID', path: [index, 'id'] })
      seen.add(row.id)
    })
  })
}
