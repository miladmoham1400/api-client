import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkspaceSnapshot } from '../../../shared/workspaces'
import type { Result } from '../../../shared/results'

export function useWorkspaces(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const generation = useRef(0)
  const apply = useCallback(async (operation: () => Promise<Result<WorkspaceSnapshot>>) => {
    if (running.current) return false
    running.current = true
    setBusy(true)
    setError(null)
    const current = ++generation.current
    try {
      const result = await operation()
      if (current !== generation.current) return false
      if (result.ok) { setSnapshot(result.data); return true }
      setError(result.error.code === 'NOT_FOUND' ? 'Workspace no longer exists. Reload workspaces.' : result.error.code === 'VALIDATION' ? 'Invalid workspace input. Names must contain 1–100 characters after trimming.' : 'Workspace data could not be loaded or saved. Your current view has been kept. Try again.')
      return false
    } catch {
      if (current === generation.current) setError('Workspace operation unavailable. Try again.')
      return false
    } finally {
      if (current === generation.current) { running.current = false; setBusy(false) }
    }
  }, [])
  const reload = useCallback(() => apply(() => window.offlineApi.workspaces.list()), [apply])
  useEffect(() => {
    if (!enabled) return
    void reload()
    return () => { generation.current++; running.current = false }
  }, [enabled, reload])
  return { snapshot, busy, error, apply, reload }
}
export type WorkspaceController = ReturnType<typeof useWorkspaces>
