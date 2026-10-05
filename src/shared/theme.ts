import { z } from 'zod'
import { resultSchema, type Result } from './results'
export const themeSchema = z.enum(['light', 'dark', 'system'])
export type ThemePreference = z.infer<typeof themeSchema>
export const THEME_CHANNELS = Object.freeze({ get: 'app:get-theme', set: 'app:set-theme' })
export const themeGetInput = z.tuple([]), themeSetInput = z.tuple([themeSchema])
export const themeResultSchema = resultSchema(themeSchema)
export interface ThemeApi {
  readonly getTheme: () => Promise<Result<ThemePreference>>
  readonly setTheme: (theme: ThemePreference) => Promise<Result<ThemePreference>>
}
