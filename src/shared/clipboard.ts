import { z } from 'zod'
import { utf8ByteLength, LIMITS } from './primitives'
import { resultSchema, type Result } from './results'
export const COPY_RESPONSE_CHANNEL = 'response:copy-text'
export const copyResponseInput = z.tuple([z.string().refine(v => utf8ByteLength(v) <= LIMITS.decodedResponseBytes)])
export const copyResponseResult = resultSchema(z.null())
export interface ResponseCopyApi { copyResponse(text: string): Promise<Result<null>> }
