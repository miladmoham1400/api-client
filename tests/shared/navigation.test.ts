import { expect, it, vi } from 'vitest'
import { authorizeTransition } from '../../src/renderer/features/navigation/transition'

function fixture(sending = false, dirty = false) {
  return { sending: () => sending, dirty: () => dirty, ask: vi.fn(async () => 'cancel' as const), cancel: vi.fn(async () => true), save: vi.fn(async () => true) }
}
it('allows a clean idle transition without prompts or saves', async () => {
  const state = fixture()
  expect(await authorizeTransition(state)).toEqual({ allowed: true, discard: false })
  expect(state.ask).not.toHaveBeenCalled(); expect(state.save).not.toHaveBeenCalled()
})
it('Stay preserves execution and never reaches the dirty guard', async () => {
  const state = fixture(true, true)
  expect(await authorizeTransition({ ...state, ask: async () => 'stay' })).toEqual({ allowed: false, discard: false })
  expect(state.cancel).not.toHaveBeenCalled(); expect(state.save).not.toHaveBeenCalled()
})
it('waits for terminal cancellation before offering draft choices', async () => {
  const state = fixture(true, true), order: string[] = []
  let release: ((value: boolean) => void) | undefined
  const transition = authorizeTransition({ ...state, ask: async prompt => { order.push(prompt); return prompt === 'active' ? 'cancel-request' : 'discard' }, cancel: () => new Promise(resolve => { release = resolve }) })
  await Promise.resolve()
  expect(order).toEqual(['active'])
  release?.(true)
  expect(await transition).toEqual({ allowed: true, discard: true })
  expect(order).toEqual(['active', 'dirty'])
})
it('failed cancellation blocks the target and any draft discard', async () => {
  const state = fixture(true, true)
  expect(await authorizeTransition({ ...state, ask: async () => 'cancel-request', cancel: async () => false })).toEqual({ allowed: false, discard: false })
  expect(state.save).not.toHaveBeenCalled()
})
it.each([true, false])('Save authorizes only when persistence succeeds (%s)', async success => {
  const state = fixture(false, true)
  expect(await authorizeTransition({ ...state, ask: async () => 'save', save: async () => success })).toEqual({ allowed: success, discard: false })
})
it('Cancel keeps draft without attempting a Save', async () => {
  const state = fixture(false, true)
  expect(await authorizeTransition(state)).toEqual({ allowed: false, discard: false })
  expect(state.save).not.toHaveBeenCalled()
})
it('rechecks dirty state after cancellation instead of caching it before awaits', async () => {
  let dirty = true
  const state = fixture(true, true)
  expect(await authorizeTransition({ ...state, dirty: () => dirty, ask: async () => 'cancel-request', cancel: async () => { dirty = false; return true } })).toEqual({ allowed: true, discard: false })
})
