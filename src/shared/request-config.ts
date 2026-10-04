import { z } from 'zod'
import { LIMITS, httpMethodSchema, limitedText, mediaTypeSchema, textBodySchema, timeoutSchema, uniqueIds, uuidSchema } from './primitives'

export const textRowSchema = z.strictObject({
  id: uuidSchema, key: limitedText(), value: limitedText(), enabled: z.boolean()
})
export const textRowsSchema = uniqueIds(textRowSchema, LIMITS.rowsPerGroup)
const multipartTextRowSchema = textRowSchema.extend({ kind: z.literal('text') })
const fileMetadata = {
  id: uuidSchema, key: limitedText(), kind: z.literal('file'), enabled: z.boolean(),
  fileName: limitedText().optional(), fileSize: z.number().int().nonnegative().optional()
}
export const runtimeMultipartRowSchema = z.discriminatedUnion('kind', [
  multipartTextRowSchema,
  z.strictObject({ ...fileMetadata, fileId: uuidSchema.optional() })
])
export const storedMultipartRowSchema = z.discriminatedUnion('kind', [
  multipartTextRowSchema, z.strictObject(fileMetadata)
])
export const exportMultipartRowSchema = z.discriminatedUnion('kind', [
  multipartTextRowSchema, z.strictObject({ ...fileMetadata, requiresSelection: z.literal(true) })
])

const commonBodies = [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({ kind: z.literal('json'), text: textBodySchema }),
  z.strictObject({ kind: z.literal('raw'), text: textBodySchema, mediaType: mediaTypeSchema }),
  z.strictObject({ kind: z.literal('urlencoded'), rows: textRowsSchema })
] as const
export const runtimeBodySchema = z.discriminatedUnion('kind', [
  ...commonBodies,
  z.strictObject({ kind: z.literal('multipart'), rows: uniqueIds(runtimeMultipartRowSchema, LIMITS.rowsPerGroup) })
])
export const storedBodySchema = z.discriminatedUnion('kind', [
  ...commonBodies,
  z.strictObject({ kind: z.literal('multipart'), rows: uniqueIds(storedMultipartRowSchema, LIMITS.rowsPerGroup) })
])
export const exportBodySchema = z.discriminatedUnion('kind', [
  ...commonBodies,
  z.strictObject({ kind: z.literal('multipart'), rows: uniqueIds(exportMultipartRowSchema, LIMITS.rowsPerGroup) })
])

export const runtimeAuthSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('none') }),
  z.strictObject({ mode: z.literal('bearer'), tokenTemplate: limitedText() }),
  z.strictObject({ mode: z.literal('basic'), usernameTemplate: limitedText(), passwordTemplate: limitedText() })
])
// Only placeholders/whitespace can remain outside the secret store, including empty omissions.
export const credentialTemplateSchema = limitedText().refine(
  value => /^(?:\s|\{\{\s*[A-Za-z_][A-Za-z0-9_]{0,63}\s*\}\})*$/.test(value),
  'Credential must contain only placeholders and whitespace'
)
export const storedCredentialSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('template'), template: credentialTemplateSchema }),
  z.strictObject({ kind: z.literal('secret'), secretId: uuidSchema })
])
export const storedAuthSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('none') }),
  z.strictObject({ mode: z.literal('bearer'), token: storedCredentialSchema }),
  z.strictObject({ mode: z.literal('basic'), username: storedCredentialSchema, password: storedCredentialSchema })
])
export const exportAuthSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('none') }),
  z.strictObject({ mode: z.literal('bearer'), tokenTemplate: credentialTemplateSchema, requiresCredentials: z.boolean() }),
  z.strictObject({ mode: z.literal('basic'), usernameTemplate: credentialTemplateSchema, passwordTemplate: credentialTemplateSchema, requiresCredentials: z.boolean() })
])
const configFields = {
  configVersion: z.literal(1), method: httpMethodSchema, urlTemplate: limitedText(),
  queryRows: textRowsSchema, headerRows: textRowsSchema,
  timeoutMs: timeoutSchema, followRedirects: z.boolean()
}
export const runtimeRequestConfigSchema = z.strictObject({ ...configFields, body: runtimeBodySchema, auth: runtimeAuthSchema })
export const storedRequestConfigSchema = z.strictObject({ ...configFields, body: storedBodySchema, auth: storedAuthSchema })
const credentialHeader = /^(?:authorization|proxy-authorization|cookie)$/i
export const exportRequestConfigSchema = z.strictObject({ ...configFields, body: exportBodySchema, auth: exportAuthSchema }).superRefine((config, ctx) => {
  config.headerRows.forEach((row, index) => {
    if (credentialHeader.test(row.key.trim()) && (row.enabled || row.value !== '')) {
      ctx.addIssue({ code: 'custom', message: 'Credential header must be empty and disabled', path: ['headerRows', index] })
    }
  })
})
export type TextRow = z.infer<typeof textRowSchema>
export type RuntimeBody = z.infer<typeof runtimeBodySchema>
export type StoredBody = z.infer<typeof storedBodySchema>
export type ExportBody = z.infer<typeof exportBodySchema>
export type RuntimeAuth = z.infer<typeof runtimeAuthSchema>
export type StoredAuth = z.infer<typeof storedAuthSchema>
export type ExportAuth = z.infer<typeof exportAuthSchema>
export type RuntimeRequestConfig = z.infer<typeof runtimeRequestConfigSchema>
export type StoredRequestConfig = z.infer<typeof storedRequestConfigSchema>
export type ExportRequestConfig = z.infer<typeof exportRequestConfigSchema>

export function createDefaultRequestConfig(): RuntimeRequestConfig {
  return {
    configVersion: 1, method: 'GET', urlTemplate: '', queryRows: [], headerRows: [],
    body: { kind: 'none' }, auth: { mode: 'none' },
    timeoutMs: LIMITS.timeoutDefaultMs, followRedirects: false
  }
}
