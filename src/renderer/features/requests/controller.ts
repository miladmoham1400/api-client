import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RequestDestination } from '../../../shared/api-library'
import type { RequestDraft, RequestSnapshot } from '../../../shared/requests'
import { requestDraftSchema } from '../../../shared/requests'
import { initialBodyDrafts, switchBody, persistedBody, retainSelections } from './body-state'
import type { EditableBody } from '../../../shared/requests'
import { copyDraft, fieldErrors, getRows, replaceRows, type RowGroup } from './fields-state'
import type { Result } from '../../../shared/results'
import { useExecution } from './execution'

export function useRequests(workspace: string | null) {
  const [loadedWorkspace, setLoadedWorkspace] = useState(workspace)
  const currentWorkspace = loadedWorkspace === workspace
  const [saved, setSaved] = useState<RequestSnapshot['editor']>(null)
  const latestSaved=useRef(saved); latestSaved.current=saved
  const [draft, setDraft] = useState<RequestDraft | null>(null)
  const [path,setPath]=useState('Workspace root')
  const [destination,setDestination] = useState<RequestDestination>({collectionId:null,folderId:null})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validation, setValidation] = useState<Record<string, string>>({})
  const [revision, setRevision] = useState(0)
  const execution = useExecution(workspace, currentWorkspace ? draft : null, currentWorkspace ? saved?.id ?? null : null)
  const bodyCache = useRef(initialBodyDrafts())
  const selections = useRef(new Map<string, string>())
  const releaseSelections = useCallback(() => {
    for (const [id, w] of selections.current) void window.offlineApi.files.releaseUpload(w, id).catch(() => {})
    selections.current.clear()
  }, [])
  const comparison = (value: Parameters<typeof copyDraft>[0]) => {
    const copy = copyDraft(value)
    return JSON.stringify({ ...copy, ...(copy.body ? { body: persistedBody(copy.body) } : {}) })
  }
  const pendingNameFocus=useRef(false)
  const pendingFocus = useRef<Element | null>(null)
  const [focusVersion, setFocusVersion] = useState(0)
  useLayoutEffect(() => {
    if (busy) return
    if(pendingNameFocus.current) { pendingNameFocus.current=false; document.querySelector<HTMLInputElement>('#request-name')?.focus() }
    const focused = pendingFocus.current
    pendingFocus.current = null
    if (focused instanceof HTMLElement && focused.isConnected && !focused.matches(':disabled') &&
      (document.activeElement === document.body || document.activeElement === focused) &&
      !document.querySelector('[role="dialog"][data-state="open"]')) focused.focus()
  }, [busy, focusVersion])
  const running = useRef(false), generation = useRef(0)
  const dirty = currentWorkspace && draft !== null && (!saved || comparison(draft) !== comparison(saved))
  const apply = useCallback(async (operation: () => Promise<Result<RequestSnapshot>>, refresh = false, preserveBody = false) => {
    if (running.current) return false
    running.current = true; setBusy(true); setError(null); setValidation({})
    const current = ++generation.current
    try {
      const result = await operation()
      if (current !== generation.current) return false
      if (result.ok && result.data.workspaceId === workspace) {
        const editor = result.data.editor
        latestSaved.current=editor; setSaved(editor); if(editor) setDestination({collectionId:editor.collectionId,folderId:editor.folderId}); setDraft(previous => editor ? { ...copyDraft(editor), ...(preserveBody ? { body: retainSelections(editor.body ?? undefined, previous?.body) } : {}) } : null)
        if (!preserveBody) { releaseSelections(); bodyCache.current = initialBodyDrafts(editor?.body ?? undefined) }
        if (refresh) setRevision(value => value + 1)
        return true
      }
      if (!result.ok && result.error.field) setValidation({ [result.error.field]: 'Invalid field value.' })
      setError(!result.ok && result.error.code === 'NOT_FOUND' ? 'Request is no longer available in this workspace.' : 'Request could not be loaded or saved. Your draft has been kept. Try again.')
      return false
    } catch { if (current === generation.current) setError('Request operation unavailable. Your draft has been kept.'); return false }
    finally { if (current === generation.current) { running.current = false; setBusy(false) } }
  }, [workspace, releaseSelections])
  useEffect(() => {
    setLoadedWorkspace(workspace); setDestination({collectionId:null,folderId:null}); latestSaved.current=null; setSaved(null); setDraft(null); setError(null); setValidation({}); setBusy(false)
    if (workspace) void apply(() => window.offlineApi.requests.list(workspace))
    return () => { generation.current++; running.current = false; releaseSelections() }
  }, [apply, workspace, releaseSelections])
  const save = useCallback(async () => {
    if (!currentWorkspace || !workspace || !draft) return false
    const parsed = requestDraftSchema.safeParse(draft)
    if (!parsed.success) { setValidation(fieldErrors(draft)); setError('Correct the highlighted fields before saving. Your draft has been kept.'); return false }
    return apply(() => saved ? window.offlineApi.requests.save(workspace, saved.id, parsed.data) : window.offlineApi.requests.create(workspace, { ...parsed.data, ...destination }), true, true)
  }, [currentWorkspace, workspace, draft, saved, apply, destination])
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      // Non-Latin layouts report another character for the S key, so fall back to its physical code.
      const isS = event.key.toLowerCase() === 's' || (event.code === 'KeyS' && !/^[a-z]$/i.test(event.key))
      if (event.ctrlKey && !event.isComposing && isS) {
        event.preventDefault()
        if (document.querySelector('[role="dialog"][data-state="open"]')) return
        const focused = document.activeElement
        void save().then(() => {
          // Restore after React commits the enabled inputs, without stealing a user's new focus.
          pendingFocus.current = focused
          setFocusVersion(value => value + 1)
        })
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [save])
  async function addRow(group: RowGroup, kind: 'text' | 'file' = 'text') {
    if (!workspace || !draft || running.current || (group === 'body.rows' && draft.body?.kind === 'multipart' ? draft.body.rows.length : getRows(draft, group).length) >= 200) return
    running.current = true; setBusy(true); setError(null)
    const current = ++generation.current
    try {
      const result = await window.offlineApi.requests.newRow(workspace)
      if (current !== generation.current) return
      if (result.ok) { setDraft(value => value ? group === 'body.rows' && value.body?.kind === 'multipart' ? { ...value, body: { ...value.body, rows: [...value.body.rows, kind === 'text' ? { ...result.data, kind } : { id: result.data.id, key: '', enabled: true, kind }] } } : replaceRows(value, group, [...getRows(value, group), result.data]) : value); setValidation({}) }
      else setError('A row could not be added. Your draft has been kept.')
    } catch { if (current === generation.current) setError('A row could not be added. Try again.') }
    finally { if (current === generation.current) { running.current = false; setBusy(false) } }
  }
  function changeMultipart(rows: Extract<EditableBody, { kind: 'multipart' }>['rows']) {
    if (!draft || draft.body?.kind !== 'multipart' || busy) return
    const remaining = new Set(rows.flatMap(row => row.kind === 'file' && row.fileId ? [row.fileId] : []))
    for (const row of draft.body.rows) if (row.kind === 'file' && row.fileId && !remaining.has(row.fileId)) {
      selections.current.delete(row.fileId)
      if (workspace) void window.offlineApi.files.releaseUpload(workspace, row.fileId).catch(() => {})
    }
    setDraft({ ...draft, body: { ...draft.body, rows } }); setValidation({})
  }
  async function chooseFile(rowId: string) {
    if (!workspace || !draft || draft.body?.kind !== 'multipart' || running.current) return
    running.current = true; setBusy(true); setError(null)
    const current = ++generation.current
    try {
      const result = await window.offlineApi.files.chooseUpload(workspace)
      if (current !== generation.current) {
        if (result.ok && result.data) void window.offlineApi.files.releaseUpload(workspace, result.data.fileId).catch(() => {})
        return
      }
      if (!result.ok) { setValidation({ [`body.rows[${draft.body.rows.findIndex(row => row.id === rowId)}].fileId`]: result.error.message }); return }
      if (!result.data) return
      const selected = result.data
      selections.current.set(selected.fileId, workspace)
      const old = draft.body.rows.find(row => row.id === rowId)
      if (old?.kind === 'file' && old.fileId) {
        selections.current.delete(old.fileId); void window.offlineApi.files.releaseUpload(workspace, old.fileId).catch(() => {})
      }
      setDraft(value => value?.body?.kind === 'multipart' ? { ...value, body: { ...value.body, rows: value.body.rows.map(row => row.id === rowId && row.kind === 'file' ? { ...row, fileId: selected.fileId, fileName: selected.name, fileSize: selected.size } : row) } } : value)
      setValidation({})
    } catch { if (current === generation.current) setError('File selection unavailable. Your draft has been kept.') }
    finally { if (current === generation.current) { running.current = false; setBusy(false) } }
  }
  return {
    focusName: () => { pendingNameFocus.current=true; setFocusVersion(value => value+1) },
    path, setPath, destination, chooseFile, changeMultipart,
    ...execution,
    saved: currentWorkspace ? saved : null, draft: currentWorkspace ? draft : null, busy: currentWorkspace ? busy : workspace !== null, dirty, error: currentWorkspace ? error : null, revision, validation, addRow, changeBody: (kind: EditableBody['kind']) => { if (!draft || busy) return; const result = switchBody(bodyCache.current, draft.body, kind); bodyCache.current = result.cache; setDraft({ ...draft, body: result.body }); setValidation({}) }, setDraft: (value: RequestDraft) => { setDraft(value); setValidation({}) }, save,
    create: (target: RequestDestination = {collectionId:null,folderId:null}) => { if (!workspace || running.current) return false; releaseSelections(); setDestination(target); bodyCache.current = initialBodyDrafts(); latestSaved.current=null; setSaved(null); setDraft(copyDraft({ name: 'New request', method: 'GET', urlTemplate: '', body: { kind: 'none' }, auth: { mode: 'none' } })); setError(null); setValidation({}); return true },
    syncPlacement: (rows: readonly { id:string; destination:RequestDestination }[]) => {
      const selected=latestSaved.current
      if(selected) {
        const row=rows.find(r => r.id===selected.id)
        if(row) { latestSaved.current={...selected,...row.destination}; setSaved(latestSaved.current); setDestination(row.destination) }
        else { releaseSelections(); latestSaved.current=null; setSaved(null); setDraft(null); bodyCache.current=initialBodyDrafts() }
      }
    },
    discard: () => { if (!busy) { releaseSelections(); bodyCache.current = initialBodyDrafts(latestSaved.current?.body ?? undefined); setDraft(latestSaved.current ? copyDraft(latestSaved.current) : null); setError(null); setValidation({}) } },
    open: (id: string) => workspace ? apply(() => window.offlineApi.requests.get(workspace, id)) : Promise.resolve(false),
    duplicate: () => workspace && saved ? apply(() => window.offlineApi.requests.duplicate(workspace, saved.id), true) : Promise.resolve(false),
    delete: () => workspace && saved ? apply(() => window.offlineApi.requests.delete(workspace, saved.id), true) : Promise.resolve(false)
  }
}
export type RequestController = ReturnType<typeof useRequests>
