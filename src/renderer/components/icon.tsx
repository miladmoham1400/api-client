import type { CSSProperties } from 'react'
const paths = {
  copy: 'M9 9h11v12H9ZM4 15H2V2h12v3',
  send: 'm5 12 14-8-5 16-3-6-6-2Zm6 2 8-10',
  plus: 'M12 5v14M5 12h14',
  import: 'M4 4h7l2 3h7v13H4ZM2 12h11m-3-3 3 3-3 3',
  export: 'M14 3h7v7m0-7L10 14M10 4H4v16h16v-6',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  info: 'M12 11v6m0-10v.01',
  response: 'M8 5 2 12l6 7m8-14 6 7-6 7m-3-16-2 18',
  search: 'm16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  stop: 'M7 7h10v10H7Z',
} as const
export function Icon({ name, size = 16, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>{name === 'info' && <circle cx="12" cy="12" r="9" />}<path d={paths[name]} /></svg>
}
