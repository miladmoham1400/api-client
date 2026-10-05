import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib'
import { LIMITS } from '../../src/shared/primitives'

// Synthetic, public fixture key/certificate only; never use these for deployed services.
export const tlsFixture = {
  key: readFileSync(join(process.cwd(), 'tests/fixtures/tls-test-only.key')),
  cert: readFileSync(join(process.cwd(), 'tests/fixtures/tls-test-only.crt'))
}
function respond(request: IncomingMessage, response: ServerResponse): void {
  const path = new URL(request.url ?? '/', 'http://fixture').pathname
  if (path === '/status/401' || path === '/status/500') { response.writeHead(Number(path.slice(-3)), { 'Content-Type': 'text/plain' }); response.end('synthetic HTTP error'); return }
  if (path === '/delay') { const timer = setTimeout(() => { response.writeHead(200, { 'Content-Type': 'text/plain' }); response.end('delayed fixture') }, 2000); response.on('close', () => clearTimeout(timer)); return }
  if (path === '/html') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<script>window.syntheticResponseExecuted=true</script>'); return }
  if (path === '/hold') { response.writeHead(200, { 'Content-Type': 'text/plain' }); response.write('waiting'); return }
  if (path === '/reset') { request.socket.destroy(); return }
  if (path === '/truncated') { response.writeHead(200, { 'Content-Length': '100', 'Content-Encoding': 'gzip' }); response.write(gzipSync(Buffer.from('valid partial stream')).subarray(0, 5)); setImmediate(() => response.destroy()); return }
  if (path === '/upgrade') { response.writeHead(101, { Connection: 'Upgrade', Upgrade: 'synthetic' }); response.end(); return }
  if (path === '/redirect') { response.writeHead(302, { Location: '/echo' }); response.end('original redirect'); return }
  if (path === '/status') { response.writeHead(503, { 'Content-Type': 'text/plain', 'Set-Cookie': ['fixture=a', 'fixture=b'] }); response.end('service unavailable'); return }
  if (path === '/empty') { response.writeHead(204, { 'Content-Encoding': 'gzip' }); response.end(); return }
  if (path === '/not-modified') { response.writeHead(304, { 'Content-Encoding': 'br' }); response.end(); return }
  if (path === '/encoded-large') { response.writeHead(200, { 'Content-Encoding': 'unsupported' }); response.end(Buffer.alloc(LIMITS.encodedResponseBytes + 1)); return }
  if (path === '/bomb') { response.writeHead(200, { 'Content-Encoding': 'gzip' }); response.end(gzipSync(Buffer.alloc(LIMITS.decodedResponseBytes + 1, 65))); return }
  if (path === '/at-limit') { response.writeHead(200, { 'Content-Type': 'application/octet-stream' }); response.end(Buffer.alloc(LIMITS.decodedResponseBytes)); return }
  if (path.startsWith('/corrupt/')) { response.writeHead(200, { 'Content-Encoding': path.slice(9) }); response.end('invalid compression'); return }
  if (['/gzip', '/deflate', '/br'].includes(path)) {
    const encoding = path.slice(1), bytes = Buffer.from('{"message":"سلام"}')
    response.writeHead(200, { 'Content-Type': 'application/json; charset="UTF-8"', 'Content-Encoding': encoding })
    response.end(encoding === 'gzip' ? gzipSync(bytes) : encoding === 'deflate' ? deflateSync(bytes) : brotliCompressSync(bytes)); return
  }
  const cases: Record<string, { bytes: Buffer; headers: Record<string, string> }> = {
    '/binary': { bytes: Buffer.from([0, 255, 1]), headers: { 'Content-Type': 'application/octet-stream' } },
    '/charset': { bytes: Buffer.from([0xe9]), headers: { 'Content-Type': 'text/plain; charset=iso-8859-1' } },
    '/unknown-encoding': { bytes: Buffer.from('looks textual'), headers: { 'Content-Encoding': 'synthetic' } },
    '/missing-type': { bytes: Buffer.from('سلام'), headers: {} },
    '/nul': { bytes: Buffer.from([65, 0, 66]), headers: {} },
    '/invalid-utf8': { bytes: Buffer.from([0xff]), headers: { 'Content-Type': 'text/plain' } },
    '/xml': { bytes: Buffer.from('<fixture/>'), headers: { 'Content-Type': 'application/fixture+xml' } },
    '/json': { bytes: Buffer.from('{"fixture":true}'), headers: { 'Content-Type': 'application/fixture+json' } }
  }
  const value = cases[path]
  if (value) { response.writeHead(200, value.headers); response.end(value.bytes); return }
  const chunks: Buffer[] = []
  request.on('data', (chunk: Buffer) => chunks.push(chunk))
  request.on('end', () => {
    const bytes = Buffer.concat(chunks)
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ method: request.method, url: request.url, rawHeaders: request.rawHeaders, bodyBase64: bytes.toString('base64'), bodyLength: bytes.length }))
  })
}
export async function startFixture(tls = false, handler: (request: IncomingMessage, response: ServerResponse) => void = respond): Promise<{ server: Server; url: string; close: () => Promise<void> }> {
  const server = tls ? createHttpsServer(tlsFixture, handler) : createServer(handler)
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve() }) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture address')
  return { server, url: `${tls ? 'https' : 'http'}://127.0.0.1:${address.port}`, close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections() }) }
}
