import { startFixture } from './http'

export interface ReceivedRequest {
  method: string; url: string; headers: { name: string; value: string }[]; bodyBase64: string; bodyLength: number
}
export interface FixtureRoute { status: number; location?: string; headers?: Record<string, string>; body?: Buffer }
export async function startRedirectFixture(tls = false) {
  const routes = new Map<string, FixtureRoute>(), received: ReceivedRequest[] = []
  const fixture = await startFixture(tls, (request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const body = Buffer.concat(chunks), headers = []
      for (let index = 0; index < request.rawHeaders.length; index += 2) headers.push({ name: request.rawHeaders[index]!, value: request.rawHeaders[index + 1]! })
      const record = { method: request.method ?? '', url: request.url ?? '', headers, bodyBase64: body.toString('base64'), bodyLength: body.length }
      received.push(record)
      const route = routes.get(new URL(request.url ?? '/', fixture.url).pathname)
      if (route) {
        response.writeHead(route.status, { 'Content-Type': 'text/plain', ...route.headers, ...(route.location === undefined ? {} : { Location: route.location }) })
        response.end(route.body ?? 'original redirect'); return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(record))
    })
  })
  return { ...fixture, routes, received }
}
