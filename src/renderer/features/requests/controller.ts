import { useCallback, useEffect, useRef, useState } from 'react'
import type { RequestDraft, RequestSnapshot } from '../../../shared/requests'
import { requestDraftSchema } from '../../../shared/requests'
import { initialBodyDrafts, switchBody } from './body-state'
import type { EditableBody } from '../../../shared/requests'
import { copyDraft, fieldErrors, type RowGroup } from './fields-state'
import type { Result } from '../../../shared/results'

export function useRequests(workspace: string | null) {
  const [loadedWorkspace, setLoadedWorkspace] = useState(workspace)
  const currentWorkspace = loadedWorkspace === workspace
  const [saved, setSaved] = useState<RequestSnapshot['editor']>(null)
  const [draft, setDraft] = useState<RequestDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validation, setValidation] = useState<Record<string, string>>({})
  const [revision, setRevision] = useState(0)
  const bodyCache = useRef(initialBodyDrafts())
  const running = useRef(false), generation = useRef(0)
  const dirty = currentWorkspace && draft !== null && (!saved || JSON.stringify(copyDraft(draft)) !== JSON.stringify(copyDraft(saved)))
  const apply = useCallback(async (operation: () => Promise<Result<RequestSnapshot>>, refresh = false, preserveBody = false) => {
    if (running.current) return false
    running.current = true; setBusy(true); setError(null); setValidation({})
    const current = ++generation.current
    try {
      const result = await operation()
      if (current !== generation.current) return false
      if (result.ok && result.data.workspaceId === workspace) {
        const editor = result.data.editor
        setSaved(editor); setDraft(editor ? copyDraft(editor) : null)
        if (!preserveBody) bodyCache.current = initialBodyDrafts(editor?.body ?? undefined)
        if (refresh) setRevision(value => value + 1)
        return true
      }
      if (!result.ok && result.error.field) setValidation({ [result.error.field]: 'Invalid field value.' })
      setError(!result.ok && result.error.code === 'NOT_FOUND' ? 'Request is no longer available in this workspace.' : 'Request could not be loaded or saved. Your draft has been kept. Try again.')
      return false
    } catch { if (current === generation.current) setError('Request operation unavailable. Your draft has been kept.'); return false }
    finally { if (current === generation.current) { running.current = false; setBusy(false) } }
  }, [workspace])
  useEffect(() => {
    setLoadedWorkspace(workspace); setSaved(null); setDraft(null); setError(null); setValidation({}); setBusy(false)
    if (workspace) void apply(() => window.offlineApi.requests.list(workspace))
    return () => { generation.current++; running.current = false }
  }, [apply, workspace])
  const save = useCallback(async () => {
    if (!currentWorkspace || !workspace || !draft) return false
    const parsed = requestDraftSchema.safeParse(draft)
    if (!parsed.success) { setValidation(fieldErrors(draft)); setError('Correct the highlighted fields before saving. Your draft has been kept.'); return false }
    return apply(() => saved ? window.offlineApi.requests.save(workspace, saved.id, parsed.data) : window.offlineApi.requests.create(workspace, { ...parsed.data, collectionId: null }), true, true)
  }, [currentWorkspace, workspace, draft, saved, apply])
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.ctrlKey && event.key.toLowerCase() === 's') { event.preventDefault(); if (!document.querySelector('[role="dialog"][data-state="open"]')) void save() }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [save])
  async function addRow(group: RowGroup) {
    if (!workspace || !draft || running.current || (draft[group]?.length ?? 0) >= 200) return
    running.current = true; setBusy(true); setError(null)
    const current = ++generation.current
    try {
      const result = await window.offlineApi.requests.newRow(workspace)
      if (current !== generation.current) return
      if (result.ok) { setDraft(value => value ? { ...value, [group]: [...(value[group] ?? []), result.data] } : value); setValidation({}) }
      else setError('A row could not be added. Your draft has been kept.')
    } catch { if (current === generation.current) setError('A row could not be added. Try again.') }
    finally { if (current === generation.current) { running.current = false; setBusy(false) } }
  }
  return {
    saved: currentWorkspace ? saved : null, draft: currentWorkspace ? draft : null, busy: currentWorkspace ? busy : workspace !== null, dirty, error: currentWorkspace ? error : null, revision, validation, addRow, changeBody: (kind: EditableBody['kind']) => { if (!draft || busy) return; const result = switchBody(bodyCache.current, draft.body, kind); bodyCache.current = result.cache; setDraft({ ...draft, body: result.body }); setValidation({}) }, setDraft: (value: RequestDraft) => { setDraft(value); setValidation({}) }, save,
    create: () => { if (!workspace || busy || dirty) return; bodyCache.current = initialBodyDrafts(); setSaved(null); setDraft(copyDraft({ name: 'New request', method: 'GET', urlTemplate: '', body: { kind: 'none' }, auth: { mode: 'none' } })); setError(null) },
    discard: () => { if (!busy) { bodyCache.current = initialBodyDrafts(saved?.body ?? undefined); setDraft(saved ? copyDraft(saved) : null); setError(null); setValidation({}) } },
    open: (id: string) => { if (workspace && !dirty) void apply(() => window.offlineApi.requests.get(workspace, id)) },
    duplicate: () => { if (workspace && saved && !dirty) void apply(() => window.offlineApi.requests.duplicate(workspace, saved.id), true) },
    delete: () => workspace && saved && !dirty ? apply(() => window.offlineApi.requests.delete(workspace, saved.id), true) : Promise.resolve(false)
  }
}
export type RequestController = ReturnType<typeof useRequests>
