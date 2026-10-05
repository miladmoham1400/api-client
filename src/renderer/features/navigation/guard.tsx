import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { RequestController } from '../requests/controller'
import { authorizeTransition, type Decision, type Prompt, type GuardTransition } from './transition'

export function useNavigationGuard(controller: RequestController) {
  const current = useRef(controller)
  current.current = controller
  const running = useRef(false)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const answer = useRef<((decision: Decision) => void) | null>(null)
  const neutral = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const choose = useCallback((decision: Decision) => { const resolve = answer.current; answer.current = null; setPrompt(null); resolve?.(decision) }, [])
  useEffect(() => () => { answer.current?.('cancel'); answer.current = null }, [])
  const guard: GuardTransition = useCallback(async (operation, discardAfter = false) => {
    if (running.current || current.current.busy) return false
    running.current = true
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    try {
      const result = await authorizeTransition({
        sending: () => current.current.isSending(),
        dirty: () => current.current.dirty,
        ask: kind => new Promise<Decision>(resolve => { answer.current = resolve; setPrompt(kind) }),
        cancel: () => current.current.cancelForTransition(),
        save: () => current.current.save()
      })
      if (!result.allowed) return false
      // Discard is deferred until the operation succeeds, so a failed target keeps the draft.
      const succeeded = await operation()
      if (succeeded && result.discard && discardAfter) current.current.discard()
      return succeeded
    } finally { running.current = false }
  }, [])
  const close = useCallback(() => guard(async () => true), [guard])
  const dialog = <Dialog.Root open={prompt !== null} onOpenChange={({ open }) => { if (!open) choose(prompt === 'active' ? 'stay' : 'cancel') }} initialFocusEl={() => neutral.current} finalFocusEl={() => trigger.current}>
    <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
      <Dialog.Header><Dialog.Title>{prompt === 'active' ? 'Request in progress' : 'Unsaved request changes'}</Dialog.Title></Dialog.Header>
      <Dialog.Body><Dialog.Description>{prompt === 'active' ? 'Cancel the running request before continuing, or stay in this editor.' : 'Save your request before continuing, discard your edits, or cancel to keep editing.'}</Dialog.Description></Dialog.Body>
      <Dialog.Footer>
        {prompt === 'active' ? <><Button ref={neutral} variant="outline" onClick={() => choose('stay')}>Stay</Button><Button onClick={() => choose('cancel-request')}>Cancel request</Button></> : <><Button ref={neutral} variant="outline" onClick={() => choose('cancel')}>Cancel</Button><Button variant="outline" onClick={() => choose('discard')}>Discard</Button><Button onClick={() => choose('save')}>Save</Button></>}
      </Dialog.Footer>
    </Dialog.Content></Dialog.Positioner></Portal>
  </Dialog.Root>
  return { guard, dialog, close }
}
