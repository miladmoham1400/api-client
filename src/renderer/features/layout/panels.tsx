import { RequestTabs } from '../requests/tabs'
import type { GuardTransition } from '../navigation/transition'
import { useRef, useState } from 'react'
import { Button, Flex } from '@chakra-ui/react'
import type { RequestController } from '../requests/controller'
import { RequestEditor } from '../requests/editor'
import { ResponseViewer } from '../response/viewer'
import { PanelDivider } from './divider'

type Layout = 'stacked' | 'side'
const clamp = (ratio: number) => Math.max(20, Math.min(80, ratio))

export function RequestResponsePanels({ controller, workspace, guard }: { controller: RequestController; workspace: string | null; guard: GuardTransition }) {
  const [layout, setLayout] = useState<Layout>('side')
  const [ratios, setRatios] = useState({ stacked: 55, side: 50 })
  const [dragging, setDragging] = useState(false)
  const split = useRef<HTMLDivElement>(null)
  const ratio = ratios[layout], side = layout === 'side'
  const update = (next: number) => setRatios(previous => ({ ...previous, [layout]: clamp(next) }))
  function drag(x: number, y: number) {
    const bounds = split.current?.getBoundingClientRect()
    if (!bounds) return
    const available = (side ? bounds.width : bounds.height) - 12
    if (available > 0) update(((side ? x - bounds.left : y - bounds.top) - 6) / available * 100)
  }
  const tracks = `minmax(0, ${ratio}fr) 12px minmax(0, ${100 - ratio}fr)`
  return <Flex as="main" className="panels-workspace" aria-label="Request and response panels" tabIndex={0} direction="column" flex="1" minW="0" minH="0" p="4" overflow="hidden">
    <Flex className="panels-toolbar" gap="2" align="center" mb="2" flexShrink="0" minW="0">
      <RequestTabs controller={controller} guard={guard} />
      <Button size="xs" variant="ghost" data-tooltip="Toggle panel layout" aria-label="Side-by-side layout" aria-pressed={side} onClick={() => { setDragging(false); setLayout(current => current === 'stacked' ? 'side' : 'stacked') }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="2" width="14" height="14" rx="2" />{side ? <path d="M9 2v14" /> : <path d="M2 9h14" />}</svg>
      </Button>
    </Flex>
    <div role="tabpanel" id="request-tab-content" aria-labelledby={controller.saved ? `request-tab-${controller.saved.id}` : undefined} ref={split} className={`request-response-split ${side ? 'split-side' : 'split-stacked'}${dragging ? ' split-dragging' : ''}`} style={side ? { gridTemplateColumns: tracks, gridTemplateRows: 'minmax(0, 1fr)' } : { gridTemplateRows: tracks, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div id="request-panel" className="split-pane"><RequestEditor key={workspace ?? 'none'} controller={controller} /></div>
      <PanelDivider orientation={side ? 'vertical' : 'horizontal'} label="Resize request and response panels" controls="request-panel response-panel"
        min={20} max={80} value={ratio} valueText={`Request ${Math.round(ratio)}%, response ${Math.round(100 - ratio)}%`}
        step={2} onResize={update} onDrag={drag} onDraggingChange={setDragging} />
      <div id="response-panel" className="split-pane"><ResponseViewer controller={controller} /></div>
    </div>
  </Flex>
}
