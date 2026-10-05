import { z } from 'zod'
import { LIMITS, limitedText, uuidSchema } from './primitives'
import { resultSchema, type Result } from './results'

export const uploadSelectionSchema = z.strictObject({
  fileId: uuidSchema, name: limitedText(), size: z.number().int().min(0).max(LIMITS.fileBytes)
})
export type UploadSelection = z.infer<typeof uploadSelectionSchema>
export const FILE_CHANNELS = Object.freeze({ chooseUpload: 'files:choose-upload', releaseUpload: 'files:release-upload' })
export const fileInputs = {
  chooseUpload: z.tuple([uuidSchema]), releaseUpload: z.tuple([uuidSchema, uuidSchema])
}
export const uploadResultSchema = resultSchema(uploadSelectionSchema.nullable())
export const releaseResultSchema = resultSchema(z.null())
export interface FileApi {
  readonly chooseUpload: (workspace: string) => Promise<Result<UploadSelection | null>>
  readonly releaseUpload: (workspace: string, fileId: string) => Promise<Result<null>>
}
