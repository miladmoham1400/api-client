import { createContext, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react'
import { Input, Textarea } from '@chakra-ui/react'
import { jsonTokens, type JsonToken } from './json-tokens'

const Names = createContext<readonly string[]>([])
export function VariableNamesProvider({ workspace, children }: { workspace: string | null; children: ReactNode }) {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    let alive = true, stamp = 0, last = 0
    setNames([])
    const refresh = () => {
      if (!workspace || Date.now() - last < 200) return
      last = Date.now(); const current = ++stamp
      void window.offlineApi.variables.list(workspace, null).then(result => {
        if (alive && current === stamp && result.ok && result.data.workspaceId === workspace) setNames(result.data.effective.map(v => v.key).sort())
      }).catch(() => {})
    }
    refresh(); document.addEventListener('focusin', refresh); window.addEventListener('focus', refresh)
    return () => { alive = false; document.removeEventListener('focusin', refresh); window.removeEventListener('focus', refresh) }
  }, [workspace])
  return <Names.Provider value={names}>{children}</Names.Provider>
}
export function templateParts(text: string) {
  return text.split(/(\{\{\s*[A-Za-z_][A-Za-z0-9_]{0,63}\s*\}\})/g)
}
function VariableSpans({ text }: { text: string }) {
  const names = useContext(Names)
  return templateParts(text).map((part, i) => /^\{\{/.test(part) ? <span key={i} className={names.includes(part.slice(2, -2).trim()) ? 'template-variable' : 'template-variable template-unknown'}>{part}</span> : part)
}
function ColoredTokens({ tokens }: { tokens: JsonToken[] }) {
  return tokens.map((t, i) => <span key={i} className={`json-${t.kind}`}><VariableSpans text={t.text} /></span>)
}
function useCompletion(value: string) {
  const names = useContext(Names), element = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [cursor, setCursor] = useState(0), [focused, setFocused] = useState(false), [dismissed, setDismissed] = useState(false), [index, setIndex] = useState(0)
  const start = value.lastIndexOf('{{', cursor), prefix = start < 0 ? '' : value.slice(start + 2, cursor)
  const valid = focused && !dismissed && start >= 0 && cursor >= start + 2 && /^\s*[A-Za-z_0-9]*$/.test(prefix) && !prefix.includes('}')
  const options = valid ? names.filter(name => name.toLowerCase().includes(prefix.trim().toLowerCase())).slice(0, 8) : []
  const selected = Math.min(index, Math.max(0, options.length - 1))
  const updateCursor = () => { setCursor(element.current?.selectionStart ?? 0); setDismissed(false); setIndex(0) }
  const accept = (name: string) => {
    const input = element.current
    if (!input) return
    const end = value.indexOf('}}', cursor), replaceEnd = end >= cursor && /^[A-Za-z_0-9\s]*$/.test(value.slice(cursor, end)) ? end + 2 : cursor
    input.focus(); input.setSelectionRange(start, replaceEnd)
    document.execCommand('insertText', false, `{{${name}}}`)
    setDismissed(true)
  }
  const keyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
    if (options.length && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key) && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      if (event.key === 'Escape') setDismissed(true)
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') setIndex((selected + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
      else accept(options[selected]!)
    }
  }
  const menu = options.length ? <div className="template-suggestions" role="listbox" aria-label="Variable suggestions">{options.map((name, i) => <button key={name} type="button" role="option" aria-selected={selected === i} onMouseDown={e => e.preventDefault()} onClick={() => accept(name)}><span>{'{{'}{name}{'}}'}</span><small>variable</small></button>)}</div> : null
  return { element, updateCursor, keyDown, menu, focus: () => { setFocused(true); updateCursor() }, blur: () => setFocused(false) }
}

export function TemplateInput(props: ComponentProps<typeof Input>) {
  const value = typeof props.value === 'string' ? props.value : '', c = useCompletion(value), backdrop = useRef<HTMLDivElement>(null)
  const colored = props.type !== 'password' && value.includes('{{')
  return <div className={`template-field template-input${colored ? ' has-template' : ''}`}>
    {colored && <div ref={backdrop} className="template-backdrop" aria-hidden="true"><VariableSpans text={value} /></div>}
    <Input {...props} ref={node => { c.element.current = node }} data-template-editor className={`template-native ${props.className ?? ''}`} onFocus={e => { c.focus(); props.onFocus?.(e) }} onBlur={e => { c.blur(); props.onBlur?.(e) }} onSelect={e => { c.updateCursor(); props.onSelect?.(e) }} onKeyDown={e => { c.keyDown(e); if (!e.defaultPrevented) props.onKeyDown?.(e) }} onScroll={e => { if (backdrop.current) backdrop.current.scrollLeft = e.currentTarget.scrollLeft; props.onScroll?.(e) }} />
    {c.menu}
  </div>
}
export function TemplateTextarea({ syntax = 'text', ...props }: ComponentProps<typeof Textarea> & { value: string; syntax?: 'text' | 'json' }) {
  const c = useCompletion(props.value), backdrop = useRef<HTMLPreElement>(null), gutter = useRef<HTMLPreElement>(null)
  const tokens = useMemo(() => syntax === 'json' ? jsonTokens(props.value) : [{ text: props.value, kind: 'plain' as const }], [props.value, syntax])
  const highlighted = tokens.some(t => t.kind !== 'plain') || (props.value.length <= 65536 && props.value.includes('{{'))
  const syncScroll = (input: HTMLTextAreaElement) => {
    // Match the native viewport, excluding its horizontal scrollbar, before scrolling.
    // Otherwise the decorative layers clamp early at the bottom of long JSON.
    for (const layer of [gutter.current, backdrop.current]) if (layer) {
      layer.style.height = `${input.clientHeight + 2}px`
      layer.scrollTop = input.scrollTop
    }
    if (backdrop.current) backdrop.current.scrollLeft = input.scrollLeft
  }
  return <div className={`template-field json-editor${syntax === 'json' ? ' has-line-numbers' : ''}`}>
    {syntax === 'json' && <pre ref={gutter} className="json-line-numbers" aria-hidden="true">{Array.from({ length: props.value.split('\n').length }, (_, i) => i + 1).join('\n')}</pre>}
    <pre ref={backdrop} className="json-editor-backdrop" aria-hidden="true">{highlighted && <><ColoredTokens tokens={tokens} />{'\n'}</>}</pre>
    <Textarea {...props} wrap={syntax === 'json' ? 'off' : props.wrap} ref={node => { c.element.current = node }} className={`json-editor-input${highlighted ? ' json-editor-highlighted' : ''}`} spellCheck={false} autoCapitalize="off" autoCorrect="off" onFocus={e => { c.focus(); props.onFocus?.(e) }} onBlur={e => { c.blur(); props.onBlur?.(e) }} onSelect={e => { c.updateCursor(); props.onSelect?.(e) }} onKeyDown={e => {
      c.keyDown(e); if (!e.defaultPrevented) props.onKeyDown?.(e)
      if (!e.defaultPrevented && syntax === 'json' && e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !e.nativeEvent.isComposing) { e.preventDefault(); document.execCommand('insertText', false, '  ') }
    }} onScroll={e => { syncScroll(e.currentTarget); props.onScroll?.(e) }} />
    {c.menu}
  </div>
}
