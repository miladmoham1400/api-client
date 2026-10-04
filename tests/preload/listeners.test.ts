import { expect, it } from 'vitest'
import { z } from 'zod'
import { subscribeValidated } from '../../src/preload/listeners'

it('validates payloads, strips event objects and unsubscribes exactly once', () => {
  const listeners: ((event: unknown, payload: unknown) => void)[] = []
  const received: unknown[] = []
  let removals = 0
  const unsubscribe = subscribeValidated(z.strictObject({ value: z.string() }),
    listener => listeners.push(listener),
    listener => { expect(listener).toBe(listeners[0]); removals++ },
    payload => received.push(payload)
  )
  const listener = listeners[0]
  if (!listener) throw new Error('Missing registered listener')
  listener({ sender: 'never forwarded' }, { value: 'valid' })
  listener({}, { value: 3 })
  listener({}, { value: 'bad', script: '' })
  expect(received).toEqual([{ value: 'valid' }])
  unsubscribe()
  unsubscribe()
  listener({}, { value: 'late' })
  expect(removals).toBe(1)
  expect(received).toHaveLength(1)
})
