export type Decision = 'save' | 'discard' | 'cancel' | 'cancel-request' | 'stay'
export type Prompt = 'dirty' | 'active'
export type GuardTransition = (operation: () => Promise<boolean>, discardAfter?: boolean) => Promise<boolean>

/** No target operation or persisted selection is touched until every guard succeeds. */
export async function authorizeTransition(state: {
  sending(): boolean
  dirty(): boolean
  ask(prompt: Prompt): Promise<Decision>
  cancel(): Promise<boolean>
  save(): Promise<boolean>
}): Promise<{ allowed: boolean; discard: boolean }> {
  if (state.sending()) {
    if (await state.ask('active') !== 'cancel-request' || !await state.cancel()) return { allowed: false, discard: false }
  }
  if (state.dirty()) {
    const decision = await state.ask('dirty')
    if (decision === 'save') return { allowed: await state.save(), discard: false }
    if (decision === 'discard') return { allowed: true, discard: true }
    return { allowed: false, discard: false }
  }
  return { allowed: true, discard: false }
}
