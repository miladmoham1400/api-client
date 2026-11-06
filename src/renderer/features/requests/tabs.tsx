import { useEffect, useRef } from 'react'
import type { RequestController } from './controller'
import type { GuardTransition } from '../navigation/transition'
import { httpMethodPalette } from '../../theme/http-method'

export function RequestTabs({ controller: c, guard }: { controller: RequestController; guard: GuardTransition }) {
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [c.saved?.id])
  const select = (id: string) => { if (id !== c.saved?.id) void guard(() => c.open(id)) }
  const close = (id: string | null) => {
    const operation = () => c.closeTab(id)
    // Closing an inactive tab does not navigate away from the active draft/send.
    void ((id === null || id === c.saved?.id) ? guard(operation) : operation()).then(ok => {
      if (ok) list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
    })
  }
  return <div ref={list} className="request-tabs" role="tablist" aria-label="Open requests" aria-orientation="horizontal" onKeyDown={event => {
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') return
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')]
    const index = tabs.indexOf(event.target as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : null
    if (next !== null) { event.preventDefault(); tabs[next]?.focus() }
    if (event.key === 'Delete' && event.target.dataset.requestId) { event.preventDefault(); close(event.target.dataset.requestId) }
  }}>
    {c.openRequests.map((tab, index) => {
      const active = tab.id === c.saved?.id
      const label = `${tab.method} ${tab.name}${c.openRequests.filter(other => other.name === tab.name && other.method === tab.method).length > 1 ? ` · ${tab.id.slice(0, 8)}` : ''}`
      return <div key={tab.id} className="request-tab" data-active={active ? 'true' : 'false'}>
        <button type="button" role="tab" data-request-id={tab.id} id={`request-tab-${tab.id}`} aria-label={label} aria-selected={active} aria-controls="request-tab-content" tabIndex={active || (!c.saved && index === 0) ? 0 : -1} disabled={c.busy} data-tooltip={label} onClick={() => select(tab.id)}>
          <span className="request-tab-method" style={{ color: `var(--chakra-colors-${httpMethodPalette(tab.method)}-fg)` }}>{tab.method}</span><span className="request-tab-name">{active ? c.draft?.name ?? tab.name : tab.name}</span>
          {active && (c.dirty || c.saving) && <span className="request-tab-pending" aria-label="Unsaved changes" />}
        </button>
        <button type="button" className="request-tab-close" aria-label={`Close ${label}`} data-tooltip="Close tab" disabled={c.busy} onClick={() => close(tab.id)}>×</button>
      </div>
    })}
    {!c.saved && c.draft && <div className="request-tab" data-active="true"><button type="button" role="tab" aria-selected="true" aria-controls="request-tab-content" tabIndex={0} disabled>New request<span className="request-tab-pending" /></button><button type="button" className="request-tab-close" aria-label="Close new request" data-tooltip="Close tab" disabled={c.busy} onClick={() => close(null)}>×</button></div>}
  </div>
}
