import { z } from 'zod'
import { uuidSchema } from './primitives'
import { resultSchema, type Result } from './results'

export const EXPORT_CHANNEL = 'transfer:export-workspace'
export const exportInputSchema = z.tuple([uuidSchema])
export const exportOutcomeSchema = z.strictObject({ status: z.enum(['saved', 'cancelled']) })
export const exportResultSchema = resultSchema(exportOutcomeSchema)
export type ExportOutcome = z.infer<typeof exportOutcomeSchema>
export interface ExportApi { readonly exportWorkspace: (workspace: string) => Promise<Result<ExportOutcome>> }
