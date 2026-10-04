import { useCallback, useEffect, useRef, useState } from 'react'
import type { RequestDraft, RequestSnapshot } from '../../../shared/requests'
import { requestDraftSchema } from '../../../shared/requests'
import type { Result } from '../../../shared/results'

export function useRequests(workspace: string | null) {
  const [loadedWorkspace, setLoadedWorkspace] = useState(workspace)
  const currentWorkspace = loadedWorkspace === workspace
  const [saved, setSaved] = useState<RequestSnapshot['editor']>(null)
  const [draft, setDraft] = useState<RequestDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const running = useRef(false), generation = useRef(0)
  const dirty = currentWorkspace && draft !== null && (!saved || draft.name !== saved.name || draft.method !== saved.method || draft.urlTemplate !== saved.urlTemplate)
  const apply = useCallback(async (operation: () => Promise<Result<RequestSnapshot>>, refresh = false) => {
    if (running.current) return false
    running.current = true; setBusy(true); setError(null)
    const current = ++generation.current
    try {
      const result = await operation()
      if (current !== generation.current) return false
      if (result.ok && result.data.workspaceId === workspace) {
        const editor = result.data.editor
        setSaved(editor); setDraft(editor ? { name: editor.name, method: editor.method, urlTemplate: editor.urlTemplate } : null)
        if (refresh) setRevision(value => value + 1)
        return true
      }
      setError(!result.ok && result.error.code === 'NOT_FOUND' ? 'Request is no longer available in this workspace.' : 'Request could not be loaded or saved. Your draft has been kept. Try again.')
      return false
    } catch { if (current === generation.current) setError('Request operation unavailable. Your draft has been kept.'); return false }
    finally { if (current === generation.current) { running.current = false; setBusy(false) } }
  }, [workspace])
  useEffect(() => {
    setLoadedWorkspace(workspace); setSaved(null); setDraft(null); setError(null); setBusy(false)
    if (workspace) void apply(() => window.offlineApi.requests.list(workspace))
    return () => { generation.current++; running.current = false }
  }, [apply, workspace])
  const save = useCallback(async () => {
    if (!currentWorkspace || !workspace || !draft) return false
    const parsed = requestDraftSchema.safeParse(draft)
    if (!parsed.success) { setError('Name must contain 1–100 characters after trimming; URL must contain at most 10,000 characters.'); return false }
    return apply(() => saved ? window.offlineApi.requests.save(workspace, saved.id, parsed.data) : window.offlineApi.requests.create(workspace, { ...parsed.data, collectionId: null }), true)
  }, [currentWorkspace, workspace, draft, saved, apply])
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.ctrlKey && event.key.toLowerCase() === 's') { event.preventDefault(); if (!document.querySelector('[role="dialog"][data-state="open"]')) void save() }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [save])
  return {
    saved: currentWorkspace ? saved : null, draft: currentWorkspace ? draft : null, busy: currentWorkspace ? busy : workspace !== null, dirty, error: currentWorkspace ? error : null, revision, setDraft, save,
    create: () => { if (!workspace || busy || dirty) return; setSaved(null); setDraft({ name: 'New request', method: 'GET', urlTemplate: '' }); setError(null) },
    discard: () => { if (!busy) { setDraft(saved ? { name: saved.name, method: saved.method, urlTemplate: saved.urlTemplate } : null); setError(null) } },
    open: (id: string) => { if (workspace && !dirty) void apply(() => window.offlineApi.requests.get(workspace, id)) },
    duplicate: () => { if (workspace && saved && !dirty) void apply(() => window.offlineApi.requests.duplicate(workspace, saved.id), true) },
    delete: () => workspace && saved && !dirty ? apply(() => window.offlineApi.requests.delete(workspace, saved.id), true) : Promise.resolve(false)
  }
}
export type RequestController = ReturnType<typeof useRequests>
