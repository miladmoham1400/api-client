import { createElement, forwardRef } from 'react'
import { NativeSelect, type NativeSelectFieldProps } from '@chakra-ui/react'

const Field = forwardRef<HTMLSelectElement, NativeSelectFieldProps>(function GlassSelectField({ children, ...props }, ref) {
  return <NativeSelect.Field {...props} ref={ref}>
    <button type="button" className="glass-select-button" tabIndex={-1}>
      {createElement('selectedcontent', { className: 'glass-select-value' })}
    </button>
    {children}
  </NativeSelect.Field>
})

export const GlassSelect = { ...NativeSelect, Field }
