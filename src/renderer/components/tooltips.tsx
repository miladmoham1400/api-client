import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'

/** One app-owned tooltip layer, including controls inside dialog portals. */
export function AppTooltips() {
  const id = useId()
  const [tip, setTip] = useState<{ text: string; x: number; y: number; above: boolean } | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined, target: HTMLElement | null = null
    let previous: string | null = null
    const hide = () => {
      clearTimeout(timer)
      if (target) {
        if (previous === null) target.removeAttribute('aria-describedby')
        else target.setAttribute('aria-describedby', previous)
      }
      target = null; setTip(null)
    }
    const show = (event: Event) => {
      const next = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tooltip]') : null
      if (next === target) return
      hide()
      if (!next) return
      target = next; previous = next.getAttribute('aria-describedby')
      timer = setTimeout(() => {
        if (!next.isConnected) { hide(); return }
        const rect = next.getBoundingClientRect(), above = rect.top > 80
        next.setAttribute('aria-describedby', [previous, id].filter(Boolean).join(' '))
        setTip({ text: next.dataset.tooltip ?? '', x: Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2)), y: above ? rect.top - 9 : rect.bottom + 9, above })
      }, 400)
    }
    const leave = (event: Event) => {
      if (event instanceof MouseEvent || event instanceof FocusEvent) {
        if (event.relatedTarget instanceof Node && target?.contains(event.relatedTarget)) return
      }
      hide()
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
    document.addEventListener('pointerover', show); document.addEventListener('pointerout', leave)
    document.addEventListener('focusin', show); document.addEventListener('focusout', leave)
    document.addEventListener('keydown', escape); document.addEventListener('pointerdown', hide)
    window.addEventListener('scroll', hide, true); window.addEventListener('resize', hide)
    return () => {
      hide()
      document.removeEventListener('pointerover', show); document.removeEventListener('pointerout', leave)
      document.removeEventListener('focusin', show); document.removeEventListener('focusout', leave)
      document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', hide)
      window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide)
    }
  }, [id])
  return tip && createPortal(<div id={id} role="tooltip" className="app-tooltip" style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.above ? '-100%' : '0'})` }}>{tip.text}</div>, document.body)
}
