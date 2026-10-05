import type { Readable } from 'node:stream'
import type { DomainError } from '../../shared/results'

export interface BodyStream { readonly stream: Readable; close(): void }
/** Private, replayable source: open validates all files before transport creates a socket. */
export interface StreamingBody { open(): BodyStream }
export class BodyError extends Error {
  constructor(readonly error: DomainError) { super('Request body unavailable') }
}
