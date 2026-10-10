import { useRef, useState } from 'react'
import { Button, Flex, Text } from '@chakra-ui/react'
import type { RequestController } from '../requests/controller'
import type { GuardTransition } from '../navigation/transition'
import { RequestEditor } from '../requests/editor'
import { ResponseViewer } from '../response/viewer'

type Layout = 'stacked' | 'side'
const clamp = (ratio: number) => Math.max(20, Math.min(80, ratio))

export function RequestResponsePanels({ controller, guard, workspace }: { controller: RequestController; guard: GuardTransition; workspace: string | null }) {
  const [layout, setLayout] = useState<Layout>('stacked')
  const [ratios, setRatios] = useState({ stacked: 55, side: 50 })
  const [dragging, setDragging] = useState(false)
  const split = useRef<HTMLDivElement>(null)
  const ratio = ratios[layout], side = layout === 'side'
  const update = (next: number) => setRatios(previous => ({ ...previous, [layout]: clamp(next) }))
  function resizeResponse(delta: number) {
    const bounds = split.current?.getBoundingClientRect()
    if (!bounds) return
    const available = (side ? bounds.width : bounds.height) - 12
    if (available > 0) update(ratio - delta / available * 100)
  }
  function drag(x: number, y: number) {
    const bounds = split.current?.getBoundingClientRect()
    if (!bounds) return
    const available = (side ? bounds.width : bounds.height) - 12
    if (available > 0) update(((side ? x - bounds.left : y - bounds.top) - 6) / available * 100)
  }
  const tracks = `minmax(0, ${ratio}fr) 12px minmax(0, ${100 - ratio}fr)`
  return <Flex as="main" aria-label="Request and response panels" tabIndex={0} direction="column" flex="1" minW="0" minH="0" p="4" overflow="hidden">
    <Flex gap="3" align="center" mb="2" flexShrink="0" flexWrap="wrap">
      <Button size="sm" variant="outline" aria-label="Side-by-side layout" aria-pressed={side} onClick={() => { setDragging(false); setLayout(current => current === 'stacked' ? 'side' : 'stacked') }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="2" width="14" height="14" rx="2" />{side ? <path d="M9 2v14" /> : <path d="M2 9h14" />}</svg>
        {side ? 'Side by side' : 'Stacked'}
      </Button>
      <Text fontSize="xs" color="fg.muted">Drag the divider to resize panels.</Text>
    </Flex>
    <div ref={split} className={`request-response-split ${side ? 'split-side' : 'split-stacked'}${dragging ? ' split-dragging' : ''}`} style={side ? { gridTemplateColumns: tracks, gridTemplateRows: 'minmax(0, 1fr)' } : { gridTemplateRows: tracks, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div id="request-panel" className="split-pane"><RequestEditor key={workspace ?? 'none'} controller={controller} guard={guard} /></div>
      <div role="separator" tabIndex={0} className="panel-divider" aria-label="Resize request and response panels" aria-orientation={side ? 'vertical' : 'horizontal'} aria-controls="request-panel response-panel" aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(ratio)} aria-valuetext={`Request ${Math.round(ratio)}%, response ${Math.round(100 - ratio)}%`} title="Drag to resize. Arrow keys adjust; Home/End move to the limits."
        onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true) }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) drag(event.clientX, event.clientY) }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false) }}
        onLostPointerCapture={() => setDragging(false)}
        onKeyDown={event => {
          const step = event.shiftKey ? 10 : 2
          const increase = side ? 'ArrowRight' : 'ArrowDown', decrease = side ? 'ArrowLeft' : 'ArrowUp'
          if (![increase, decrease, 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          update(event.key === 'Home' ? 20 : event.key === 'End' ? 80 : ratio + (event.key === increase ? step : -step))
        }}><span aria-hidden="true" /></div>
      <div id="response-panel" className="split-pane"><ResponseViewer controller={controller} resize={resizeResponse} side={side} canGrow={ratio > 20} canShrink={ratio < 80} /></div>
    </div>
  </Flex>
}
