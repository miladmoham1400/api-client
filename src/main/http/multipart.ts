import { Readable } from 'node:stream'
import { FormDataEncoder, isFile, type FileLike, type FormDataLike, type FormDataEntryValue } from 'form-data-encoder'
import type { RuntimeRequestConfig } from '../../shared/request-config'
import { LIMITS } from '../../shared/primitives'
import { BodyError, type StreamingBody } from './body'

type Multipart = Extract<RuntimeRequestConfig['body'], { kind: 'multipart' }>
export interface MultipartFile {
  readonly rowId: string; readonly name: string; readonly size: number
  stream(): AsyncIterable<Uint8Array>; close(): void
}
export type MultipartFiles = (source: Multipart) => MultipartFile[]
// An ordered FormDataLike adapter retains interleaved duplicate keys. Encoding is entirely library-owned.
class OrderedForm implements FormDataLike {
  readonly [Symbol.toStringTag] = 'FormData'
  private readonly items: [string, FormDataEntryValue][] = []
  append(name: string, value: unknown) {
    if (typeof value !== 'string' && !isFile(value)) throw new TypeError('Invalid form value')
    // Only our private FileLike instances and resolved strings enter this adapter.
    this.items.push([name, value])
  }
  getAll(name: string) { return this.items.filter(([key]) => key === name).map(([, value]) => value) }
  entries() { return this.items[Symbol.iterator]() }
  [Symbol.iterator]() { return this.entries() }
}
function encoderFor(body: Multipart, files: readonly MultipartFile[], boundary?: string) {
  const form = new OrderedForm(), byRow = new Map(files.map(file => [file.rowId, file]))
  for (const row of body.rows) {
    if (!row.enabled) continue
    if (row.kind === 'text') form.append(row.key, row.value)
    else {
      const file = byRow.get(row.id)
      if (!file) throw new BodyError({ code: 'FILE_REQUIRED', field: 'body.rows', message: 'Select a file again', retryable: false })
      const value: FileLike = { name: file.name, size: file.size, type: 'application/octet-stream', lastModified: 0,
        [Symbol.toStringTag]: 'File', stream: () => file.stream() }
      form.append(row.key, value)
    }
  }
  return boundary ? new FormDataEncoder(form, boundary) : new FormDataEncoder(form)
}
/** Files are injected by main; this module never resolves paths or reads renderer data. */
export function prepareMultipart(source: Multipart, resolved: Multipart, openFiles: MultipartFiles): { body: StreamingBody; headers: { name: string; value: string }[] } {
  const capturedSource = structuredClone(source), capturedBody = structuredClone(resolved)
  const initial = openFiles(capturedSource)
  let boundary: string, contentType: string, contentLength: string
  try {
    const encoder = encoderFor(capturedBody, initial)
    if (encoder.contentLength === undefined || Number(encoder.contentLength) > LIMITS.requestPayloadBytes) throw new BodyError({ code: 'FILE_TOO_LARGE', field: 'body', message: 'Serialized body exceeds 55 MiB', retryable: false })
    boundary = encoder.boundary; contentType = encoder.contentType; contentLength = encoder.contentLength
  } finally { for (const file of initial) file.close() }
  return {
    headers: [{ name: 'Content-Type', value: contentType }, { name: 'Content-Length', value: contentLength }],
    body: Object.freeze({ open() {
      const files = openFiles(capturedSource)
      let closed = false, stream: Readable | undefined
      const close = () => { if (closed) return; closed = true; stream?.destroy(); for (const file of files) file.close() }
      try {
        const encoder = encoderFor(capturedBody, files, boundary)
        if (encoder.contentLength !== contentLength) throw new BodyError({ code: 'FILE_CHANGED', field: 'body.rows', message: 'File changed. Select it again.', retryable: false })
        async function* encode() {
          let length = 0
          try {
            for await (const chunk of encoder) {
              if (closed) return
              length += chunk.byteLength
              if (length > LIMITS.requestPayloadBytes || length > Number(contentLength)) throw new BodyError({ code: 'FILE_TOO_LARGE', field: 'body', message: 'Serialized body exceeds upload limit', retryable: false })
              yield chunk
            }
            if (!closed && length !== Number(contentLength)) throw new BodyError({ code: 'FILE_CHANGED', field: 'body.rows', message: 'File changed. Select it again.', retryable: false })
          } finally { for (const file of files) file.close() }
        }
        stream = Readable.from(encode(), { objectMode: false, highWaterMark: 64 * 1024 })
        return { stream, close }
      } catch (error) { close(); throw error }
    } })
  }
}
