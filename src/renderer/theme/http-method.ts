import { httpMethodSchema } from '../../shared/primitives'

// Shared semantic palettes keep tree/search badges and the current editor method consistent.
const palettes = {
  GET: 'green',
  POST: 'yellow',
  PUT: 'blue',
  PATCH: 'orange',
  DELETE: 'red',
  HEAD: 'purple',
  OPTIONS: 'cyan',
} as const satisfies Record<(typeof httpMethodSchema.options)[number], string>

export function httpMethodPalette(method: string | undefined) {
  const parsed = httpMethodSchema.safeParse(method)
  return parsed.success ? palettes[parsed.data] : 'gray'
}
