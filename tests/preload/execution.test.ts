import { afterEach, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createExecutionApi } from '../../src/preload/execution'

afterEach(() => vi.useRealTimers())
it('requires subscription, returns validated acceptance before start, strips events and removes listeners idempotently', async () => {
  vi.useFakeTimers()
  const id = randomUUID(), listeners = new Set<(event: unknown, payload: unknown) => void>(), received: unknown[] = []
  let accepted = false
  const invoke = vi.fn(async () => ({ ok: true, data: { executionId: id } }))
  const api = createExecutionApi(invoke, () => {
    expect(accepted).toBe(true)
    for (const listener of listeners) listener({ secretEvent: true }, { executionId: id, result: { code: 'NETWORK_FAILURE', message: 'Network request failed', retryable: true } })
  }, listener => listeners.add(listener), listener => listeners.delete(listener), async () => ({ ok: true, data: null }))
  const args = [randomUUID(), null, { name: 'Fixture', method: 'GET', urlTemplate: 'http://localhost/' }, null] as const
  expect(await api.send(...args)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } }); expect(invoke).not.toHaveBeenCalled()
  const stop = api.onCompleted(value => received.push(value)), stopOther = api.onCompleted(() => {})
  expect(listeners.size).toBe(2)
  expect(await api.send(...args)).toEqual({ ok: true, data: { executionId: id } }); accepted = true
  expect(received).toEqual([])
  await vi.runAllTimersAsync()
  expect(received).toEqual([{ executionId: id, result: { code: 'NETWORK_FAILURE', message: 'Network request failed', retryable: true } }])
  for (const listener of listeners) listener({}, { executionId: id, result: 'invalid' })
  expect(received).toHaveLength(1)
  stop(); stop(); expect(listeners.size).toBe(1)
  stopOther(); expect(listeners.size).toBe(0)
  expect(await api.send(...args)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
})
it('rejects malformed input/output and invocation failures without acknowledging a start', async () => {
  const ack = vi.fn(), invoke = vi.fn(async (): Promise<unknown> => ({ ok: true, data: { executionId: 'bad' } }))
  const api = createExecutionApi(invoke, ack, () => {}, () => {}, async () => ({ ok: true, data: null })), stop = api.onCompleted(() => {})
  const args = [randomUUID(), null, { name: 'Fixture', method: 'GET', urlTemplate: 'http://localhost/' }, null] as const
  expect(await api.send('bad', args[1], args[2], args[3])).toMatchObject({ ok: false, error: { code: 'VALIDATION' } }); expect(invoke).not.toHaveBeenCalled()
  expect(await api.send(...args)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  invoke.mockRejectedValue(new Error('synthetic secret /private/path'))
  const result = await api.send(...args)
  expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } }); expect(JSON.stringify(result)).not.toContain('synthetic')
  expect(ack).not.toHaveBeenCalled(); stop()
})

it('cancel validates IDs and its result, sanitizes failures and requires no completion subscription', async () => {
  const invokeCancel = vi.fn(async (): Promise<unknown> => ({ ok: true, data: null }))
  const api = createExecutionApi(async () => null, () => {}, () => {}, () => {}, invokeCancel)
  expect(await api.cancel('invalid')).toMatchObject({ ok: false, error: { code: 'VALIDATION' } }); expect(invokeCancel).not.toHaveBeenCalled()
  const id = randomUUID()
  expect(await api.cancel(id)).toEqual({ ok: true, data: null }); expect(invokeCancel).toHaveBeenCalledWith(id)
  invokeCancel.mockResolvedValue({ ok: true, data: 'invalid' })
  expect(await api.cancel(id)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  invokeCancel.mockRejectedValue(new Error('synthetic secret /private/path'))
  expect(JSON.stringify(await api.cancel(id))).not.toContain('synthetic')
})
