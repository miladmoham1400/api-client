import { createOwnedHandler } from './guard'
import { Repositories, RepositoryError } from '../db/repositories'
import { themeSchema, themeGetInput, themeSetInput } from '../../shared/theme'
export function createThemeHandlers(getWindow: Parameters<typeof createOwnedHandler>[0], trustedUrl: string, getRepositories: () => Repositories | null) {
  const repositories = () => { const r = getRepositories(); if (!r) throw new RepositoryError('DATABASE_UNAVAILABLE'); return r }
  return {
    get: createOwnedHandler(getWindow, trustedUrl, themeGetInput, themeSchema, () => repositories().getTheme()),
    set: createOwnedHandler(getWindow, trustedUrl, themeSetInput, themeSchema, ([theme]) => repositories().setTheme(theme))
  }
}
