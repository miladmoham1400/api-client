import { z } from 'zod'
import { uuidSchema } from './primitives'
import { libraryRequestMetadataSchema } from './api-library'
import { resultSchema, type Result } from './results'

export const searchInputSchema=z.strictObject({query:z.string().max(200),collectionId:uuidSchema.nullable().optional(),offset:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),limit:z.number().int().min(1).max(100),revision:z.string().regex(/^[a-f0-9]{64}$/).optional()})
  .refine(input => input.offset===0 || input.revision!==undefined,'Continuation requires a revision')
export const searchRowSchema=libraryRequestMetadataSchema.extend({path:z.string().max(2000)})
export const searchPageSchema=z.strictObject({workspaceId:uuidSchema,query:z.string().max(200),collectionId:uuidSchema.nullable(),offset:z.number().int().nonnegative(),limit:z.number().int().min(1).max(100),revision:z.string().regex(/^[a-f0-9]{64}$/),total:z.number().int().nonnegative(),nextOffset:z.number().int().nonnegative().nullable(),rows:z.array(searchRowSchema).max(100)})
  .superRefine((page,ctx) => {
    const end=page.offset+page.rows.length
    if(page.rows.length>page.limit || new Set(page.rows.map(r=>r.id)).size!==page.rows.length || page.rows.some(r=>r.workspaceId!==page.workspaceId || (page.collectionId!==null && r.destination.collectionId!==page.collectionId)) || page.offset>page.total || end>page.total || page.nextOffset!==(end<page.total ? end : null) || (end<page.total && page.rows.length!==page.limit)) ctx.addIssue({code:'custom',message:'Invalid search page'})
  })
export const searchResultSchema=resultSchema(searchPageSchema)
export type SearchInput=z.infer<typeof searchInputSchema>
export type SearchPage=z.infer<typeof searchPageSchema>
export interface RequestSearchApi { readonly search:(workspace:string,input:SearchInput)=>Promise<Result<SearchPage>> }

/** NFC and Latin-only folding; punctuation is always literal, never SQL/regex syntax. */
export function normalizeSearch(value:string) { return value.trim().normalize('NFC').replace(/\p{Script=Latin}/gu,char=>char.toLowerCase()).normalize('NFC') }
export function compareCodePoints(a:string,b:string) {
  const left=Array.from(a),right=Array.from(b)
  for(let i=0;i<Math.min(left.length,right.length);i++) {const d=left[i]!.codePointAt(0)!-right[i]!.codePointAt(0)!;if(d) return d}
  return left.length-right.length
}
