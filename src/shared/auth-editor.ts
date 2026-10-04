import { z } from 'zod'
import { limitedText } from './primitives'
const credential = z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('value'), value: limitedText() }), z.strictObject({ kind: z.literal('keep') })])
export const authDraftSchema = z.discriminatedUnion('mode', [z.strictObject({ mode: z.literal('none') }), z.strictObject({ mode: z.literal('bearer'), token: credential }), z.strictObject({ mode: z.literal('basic'), username: credential, password: credential })])
const metadata = z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('value'), value: limitedText() }), z.strictObject({ kind: z.literal('stored'), hasValue: z.boolean(), storageMode: z.enum(['secure', 'session']) })])
export const authEditorSchema = z.discriminatedUnion('mode', [z.strictObject({ mode: z.literal('none') }), z.strictObject({ mode: z.literal('bearer'), token: metadata }), z.strictObject({ mode: z.literal('basic'), username: metadata, password: metadata })])
export type AuthDraft = z.infer<typeof authDraftSchema>
export type AuthEditor = z.infer<typeof authEditorSchema>
export function authDraft(source: AuthDraft | AuthEditor): AuthDraft {
  const copy = (value: z.infer<typeof metadata> | z.infer<typeof credential>): z.infer<typeof credential> => value.kind === 'value' ? { ...value } : { kind: 'keep' }
  return source.mode === 'none' ? { mode: 'none' } : source.mode === 'bearer' ? { mode: 'bearer', token: copy(source.token) } : { mode: 'basic', username: copy(source.username), password: copy(source.password) }
}
