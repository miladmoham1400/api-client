import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createOwnedHandler } from '../../src/main/ipc/guard'

function fixture() {
  const frame = { url: 'file:///app/index.html' }
  const contents = { mainFrame: frame }
  const window = { webContents: contents, isDestroyed: () => false }
  let calls = 0
  const handler = createOwnedHandler(() => window, frame.url, z.tuple([]), z.strictObject({ ready: z.literal(true) }), () => {
    calls++
    return { ready: true } as const
  })
  return { handler, frame, contents, window, calls: () => calls }
}
describe('owned IPC handler', () => {
  it('accepts only the actual owned main frame and validates the output', () => {
    const f = fixture()
    expect(f.handler({ sender: f.contents, senderFrame: f.frame })).toEqual({ ok: true, data: { ready: true } })
    expect(f.calls()).toBe(1)
  })
  it('rejects a different sender even with the trusted URL', () => {
    const f = fixture()
    expect(f.handler({ sender: {}, senderFrame: f.frame }).ok).toBe(false)
    expect(f.calls()).toBe(0)
  })
  it('rejects subframes, copied frame metadata, detached frames and navigated frames', () => {
    const f = fixture()
    for (const frame of [{ url: f.frame.url }, null, { url: 'https://untrusted.invalid' }]) {
      expect(f.handler({ sender: f.contents, senderFrame: frame }).ok).toBe(false)
    }
    f.frame.url = 'file:///app/other.html'
    expect(f.handler({ sender: f.contents, senderFrame: f.frame }).ok).toBe(false)
    expect(f.calls()).toBe(0)
  })
  it('rejects closed windows and unexpected payloads before operation execution', () => {
    const f = fixture()
    expect(f.handler({ sender: f.contents, senderFrame: f.frame }, { script: 'synthetic' }).ok).toBe(false)
    f.window.isDestroyed = () => true
    expect(f.handler({ sender: f.contents, senderFrame: f.frame }).ok).toBe(false)
    expect(f.calls()).toBe(0)
  })
  it('rejects absent windows', () => {
    const handler = createOwnedHandler(() => null, 'file:///app/index.html', z.tuple([]), z.boolean(), () => true)
    expect(handler({ sender: {}, senderFrame: null }).ok).toBe(false)
  })
  it('does not forward raw operation exceptions or invalid DTOs', () => {
    const f = fixture()
    const handler = createOwnedHandler(() => f.window, f.frame.url, z.tuple([]), z.literal(true), () => {
      throw new Error('synthetic private path')
    })
    expect(JSON.stringify(handler({ sender: f.contents, senderFrame: f.frame }))).not.toContain('private')
  })
})
