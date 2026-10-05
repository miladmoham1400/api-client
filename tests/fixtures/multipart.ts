import busboy from 'busboy'
import { createServer, type IncomingMessage } from 'node:http'
import { once } from 'node:events'

export interface MultipartPart { name: string; value?: string; filename?: string; bytes?: string }
export interface MultipartCapture { method: string; url: string; contentType: string; contentLength: string; length: number; parts: MultipartPart[] }
export async function parseMultipart(request: IncomingMessage): Promise<MultipartCapture> {
  const parts: MultipartPart[] = []
  let length = 0
  request.on('data', (chunk: Buffer) => { length += chunk.length })
  const parser = busboy({ headers: request.headers, defParamCharset: 'utf8', preservePath: true })
  parser.on('field', (name, value) => parts.push({ name, value }))
  parser.on('file', (name, stream, info) => {
    const part: MultipartPart = { name, filename: info.filename }, bytes: Buffer[] = []
    parts.push(part)
    stream.on('data', (chunk: Buffer) => bytes.push(chunk))
    stream.on('end', () => { part.bytes = Buffer.concat(bytes).toString('base64') })
  })
  const done = once(parser, 'close'); request.pipe(parser); await done
  return { method: request.method ?? '', url: request.url ?? '', contentType: request.headers['content-type'] ?? '', contentLength: request.headers['content-length'] ?? '', length, parts }
}
export async function startMultipartFixture() {
  const captures: MultipartCapture[] = []
  const server = createServer((request, response) => {
    if (request.method === 'GET') { response.end('rewritten'); return }
    void parseMultipart(request).then(capture => {
      captures.push(capture)
      if (/^\/redirect-(307|308|303|302|301)$/.test(request.url ?? '')) {
        response.writeHead(Number(request.url!.slice(-3)), { Location: '/echo' }); response.end()
      } else { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(capture)) }
    }).catch(() => { response.destroy() })
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Fixture unavailable')
  return { server, captures, url: `http://127.0.0.1:${address.port}`, async close() { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) } }
}
