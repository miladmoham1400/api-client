type PanelDividerProps = {
  orientation: 'horizontal' | 'vertical'
  label: string
  controls: string
  min: number
  max: number
  value: number
  valueText: string
  step: number
  onResize: (value: number) => void
  onDrag: (x: number, y: number) => void
  onDraggingChange: (dragging: boolean) => void
}

export function PanelDivider({ orientation, label, controls, min, max, value, valueText, step, onResize, onDrag, onDraggingChange }: PanelDividerProps) {
  const vertical = orientation === 'vertical'
  const increase = vertical ? 'ArrowRight' : 'ArrowDown'
  const decrease = vertical ? 'ArrowLeft' : 'ArrowUp'
  return <div role="separator" tabIndex={0} className="panel-divider" aria-label={label} aria-orientation={orientation}
    aria-controls={controls} aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-valuetext={valueText}
    data-tooltip="Drag to resize. Arrow keys adjust; Home/End move to the limits."
    onPointerDown={event => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.focus()
      event.currentTarget.setPointerCapture(event.pointerId)
      onDraggingChange(true)
    }}
    onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) onDrag(event.clientX, event.clientY) }}
    onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    onLostPointerCapture={() => onDraggingChange(false)}
    onKeyDown={event => {
      if (![increase, decrease, 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const amount = step * (event.shiftKey ? 5 : 1)
      onResize(event.key === 'Home' ? min : event.key === 'End' ? max : value + (event.key === increase ? amount : -amount))
    }}><span aria-hidden="true" /></div>
}
