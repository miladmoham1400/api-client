// TASK-029 manual-check helper only (not app code). Loopback-only, synthetic data.
// HTTP  : http://127.0.0.1:8787   HTTPS (self-signed, must be REJECTED by the app): https://127.0.0.1:8788
import http from 'node:http'
import https from 'node:https'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Buffer } from 'node:buffer'
import { setTimeout } from 'node:timers'
import console from 'node:console'
import { URL as NodeURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, '..', 'tests', 'fixtures')

function handler(req, res) {
  const url = new NodeURL(req.url, 'http://127.0.0.1')
  const chunks = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks)
    const send = (status, type, text) => { res.writeHead(status, { 'content-type': type }); res.end(text) }
    if (url.pathname === '/status/401') return send(401, 'text/plain', 'Unauthorized (test body)')
    if (url.pathname === '/status/500') return send(500, 'text/plain', 'Server error (test body)')
    if (url.pathname === '/html') return send(200, 'text/html', '<h1>Title</h1><script>alert("should not run")</script><img src="http://127.0.0.1:8787/should-not-load.png">')
    if (url.pathname === '/delay') {
      const ms = Math.min(Number(url.searchParams.get('ms') ?? 10000) || 10000, 60000)
      return setTimeout(() => send(200, 'text/plain', `delayed ${ms} ms`), ms)
    }
    send(200, 'application/json', JSON.stringify({
      method: req.method, url: req.url, headers: req.headers,
      bodyBytes: body.length, bodyText: body.toString('utf8').slice(0, 4000)
    }, null, 2))
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} (${body.length} bytes)`)
  })
}

http.createServer(handler).listen(8787, '127.0.0.1', () => console.log('HTTP  listening on http://127.0.0.1:8787'))
https.createServer({ cert: readFileSync(join(fixtures, 'tls-test-only.crt')), key: readFileSync(join(fixtures, 'tls-test-only.key')) }, handler)
  .listen(8788, '127.0.0.1', () => console.log('HTTPS listening on https://127.0.0.1:8788 (self-signed; app must refuse it)'))
