import { LibrarySearch } from '../library/search'
import type { GuardTransition } from '../navigation/transition'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Box, Button, Dialog, Flex, Heading, Input, Menu, NativeSelect, Portal, Text } from '@chakra-ui/react'
import type { LibrarySnapshot } from '../../../shared/library-view'
import type { RequestDestination, WorkspaceTreeState } from '../../../shared/api-library'
import type { RequestController } from '../requests/controller'
import { nameSchema } from '../../../shared/primitives'
import { ancestors, descendants, libraryNodes, pathLabel, visibleNodes, type Node } from '../library/model'

type Editing = {kind:'create-collection'} | {kind:'create-folder';destination:RequestDestination} | {kind:'rename'|'move'|'delete';node:Node}
const TREE_PAGE_SIZE=50
const root:RequestDestination={collectionId:null,folderId:null}
export function CollectionSidebar({workspaceId,requestController,guard}:{guard:GuardTransition;workspaceId:string|null;requestController:RequestController}) {
  const [snapshot,setSnapshot]=useState<LibrarySnapshot|null>(null), [expansion,setExpansion]=useState<WorkspaceTreeState|null>(null)
  const [busy,setBusy]=useState(false), [error,setError]=useState<string|null>(null), [editing,setEditing]=useState<Editing|null>(null)
  const [name,setName]=useState(''), [fieldError,setFieldError]=useState<string|null>(null), [destination,setDestination]=useState('')
  const generation=useRef(0), running=useRef(false), alive=useRef(true), loadedExpansion=useRef(false), reveal=useRef('')
  const current=useRef(requestController); current.current=requestController
  const editRef=useRef(editing); editRef.current=editing
  const rowsRef=useRef(new Map<string,HTMLDivElement>()), triggers=useRef(new Map<string,HTMLButtonElement>())
  const create=useRef<HTMLButtonElement>(null), input=useRef<HTMLInputElement>(null), cancel=useRef<HTMLButtonElement>(null), select=useRef<HTMLSelectElement>(null), returnId=useRef<string|null>(null)
  const [searching,setSearching]=useState(false),[treePage,setTreePage]=useState(0)
  const [focusId,setFocusId]=useState<string|null>(null)
  const nodes=useMemo(() => snapshot ? libraryNodes(snapshot) : [],[snapshot])
  const visible=useMemo(() => expansion ? visibleNodes(nodes,expansion) : [],[nodes,expansion])
  const pageStart=Math.min(treePage,Math.max(0,Math.floor((visible.length-1)/TREE_PAGE_SIZE)*TREE_PAGE_SIZE))
  const rendered=visible.slice(pageStart,pageStart+TREE_PAGE_SIZE)
  const onSearching=useCallback((value:boolean)=>setSearching(value),[])
  const pendingReveal=useRef<string|null>(null)
  useEffect(()=>{pendingReveal.current=requestController.saved?.id??null},[requestController.saved?.id,nodes])
  useEffect(()=>{
    const index=visible.findIndex(n=>n.id===pendingReveal.current)
    if(index>=0) {setTreePage(Math.floor(index/TREE_PAGE_SIZE)*TREE_PAGE_SIZE);pendingReveal.current=null}
  },[requestController.saved?.id,nodes,visible])
  useEffect(()=>{ if(focusId) rowsRef.current.get(focusId)?.focus() },[pageStart,focusId])
  const stateRef=useRef(expansion); stateRef.current=expansion
  // Expansion writes serialize to avoid an older reply overwriting a newer gesture.
  const writes=useRef<Promise<void>>(Promise.resolve())
  const persist=useCallback((next:WorkspaceTreeState) => {
    stateRef.current=next; setExpansion(next)
    writes.current=writes.current.then(async () => {
      if(!alive.current || !workspaceId) return
      try {
        const result=await window.offlineApi.library.setExpansion(workspaceId,{expandedCollectionIds:next.expandedCollectionIds,expandedFolderIds:next.expandedFolderIds})
        if(!alive.current) return
        if(!result.ok) { loadedExpansion.current=false; setError('Expansion could not be saved. Reload library to retry.'); }
      } catch { if(alive.current) setError('Expansion could not be saved. Reload library to retry.') }
    })
  },[workspaceId])
  const reload=useCallback(async () => {
    if(!workspaceId || running.current) return false
    const stamp=++generation.current
    try {
      const result=await window.offlineApi.library.list(workspaceId)
      if(stamp!==generation.current || !alive.current) return false
      if(!result.ok || result.data.workspaceId!==workspaceId) { setError('Library changes could not be loaded or saved. Your current view has been kept. Try again.'); return false }
      setSnapshot(result.data); current.current.syncPlacement(result.data.requests)
      if(!loadedExpansion.current) { loadedExpansion.current=true; setExpansion(result.data.treeState); stateRef.current=result.data.treeState }
      else {
        const old=stateRef.current
        if(old) { const cs=new Set(result.data.collections.map(c => c.id)), fs=new Set(result.data.folders.map(f => f.id)); const next={...old,expandedCollectionIds:old.expandedCollectionIds.filter(id => cs.has(id)),expandedFolderIds:old.expandedFolderIds.filter(id => fs.has(id))}; setExpansion(next); stateRef.current=next }
      }
      setError(null); return true
    } catch { if(stamp===generation.current) setError('Library operation unavailable. Try again.'); return false }
  },[workspaceId])
  useEffect(() => { alive.current=true; return () => { alive.current=false; generation.current++ } },[reload])
  useEffect(() => { void reload() },[reload,requestController.revision])
  useEffect(() => {
    const state=stateRef.current, saved=requestController.saved, row=snapshot?.requests.find(r => r.id===saved?.id)
    if(!state || !row) return
    const signature=`${row.id}/${row.destination.collectionId}/${row.destination.folderId}`
    if(reveal.current===signature) return
    reveal.current=signature
    const parents=ancestors(nodes,row.destination)
    const next={...state,expandedCollectionIds:[...new Set([...state.expandedCollectionIds,...parents.filter(n => n.kind==='collection').map(n => n.id)])],expandedFolderIds:[...new Set([...state.expandedFolderIds,...parents.filter(n => n.kind==='folder').map(n => n.id)])]}
    if(next.expandedCollectionIds.length!==state.expandedCollectionIds.length || next.expandedFolderIds.length!==state.expandedFolderIds.length) persist(next)
  },[nodes,snapshot,requestController.saved,persist])
  useEffect(() => { current.current.setPath(pathLabel(nodes,current.current.destination)) },[nodes,requestController.destination])
  function toggle(node:Node) {
    const state=stateRef.current; if(!state) return
    const key=node.kind==='collection' ? 'expandedCollectionIds' : 'expandedFolderIds', ids=state[key]
    persist({...state,[key]:ids.includes(node.id) ? ids.filter(id => id!==node.id) : [...ids,node.id]})
  }
  function focus(id:string) { setFocusId(id); const index=visible.findIndex(n=>n.id===id);if(index>=0) setTreePage(Math.floor(index/TREE_PAGE_SIZE)*TREE_PAGE_SIZE); rowsRef.current.get(id)?.focus() }
  async function choose(node:Node) {
    if(node.kind!=='request') { toggle(node); return }
    if(node.id!==current.current.saved?.id || !current.current.saved) await guard(() => current.current.open(node.id))
  }
  function open(next:Editing) {
    returnId.current='node' in next ? next.node.id : next.kind==='create-folder' ? next.destination.folderId??next.destination.collectionId : null
    setEditing(next); setName('node' in next ? next.node.name : ''); setFieldError(null)
    setDestination('node' in next ? next.node.kind==='folder' ? next.node.parent??'' : next.node.destination.folderId??next.node.destination.collectionId??'' : '')
  }
  async function newRequest(target:RequestDestination) { await guard(async () => current.current.create(target)) }
  async function mutate(operation:() => Promise<{ok:boolean}>) {
    if(running.current || !workspaceId) return false
    running.current=true; generation.current++; setBusy(true); setError(null)
    try {
      await writes.current
      const result=await operation()
      if(!alive.current) return false
      if(!result.ok) { setError('Library changes could not be loaded or saved. Your current view has been kept. Try again.'); return false }
      running.current=false
      return await reload()
    } catch { if(alive.current) setError('Library operation unavailable. Try again.'); return false }
    finally { running.current=false; if(alive.current) setBusy(false) }
  }
  async function submit() {
    const target=editing
    if(!target || !workspaceId || busy) return
    if(target.kind!=='move' && target.kind!=='delete' && !nameSchema.safeParse(name).success) { setFieldError('Enter a name with 1–100 characters after trimming.'); input.current?.focus(); return }
    const operation=async () => {
      if(editRef.current!==target) return false
      const api=window.offlineApi
      return mutate(async () => {
        if(target.kind==='create-collection') return api.collections.create(workspaceId,name)
        if(target.kind==='create-folder') return api.folders.create(workspaceId,target.destination.collectionId!,target.destination.folderId,name)
        const node=target.node
        if(target.kind==='rename') return node.kind==='collection' ? api.collections.rename(workspaceId,node.id,name) : api.folders.rename(workspaceId,node.id,name)
        if(target.kind==='delete') return node.kind==='collection' ? api.collections.delete(workspaceId,node.id) : node.kind==='folder' ? api.folders.delete(workspaceId,node.id) : api.requests.delete(workspaceId,node.id)
        const container=nodes.find(n => n.id===destination), dest=container?.destination??root
        return node.kind==='folder' ? api.folders.move(workspaceId,node.id,dest.collectionId!,dest.folderId) : api.requests.move(workspaceId,node.id,dest.collectionId,dest.folderId)
      })
    }
    if(await guard(operation,true)) setEditing(null)
  }
  const edited=editing && 'node' in editing ? editing.node : null
  const excluded=edited?.kind==='folder' ? new Set([edited.id,...descendants(nodes,edited.id).map(n => n.id)]) : new Set<string>()
  const containers=nodes.filter(n => n.kind!=='request' && !excluded.has(n.id))
  const affected=edited ? descendants(nodes,edited.id) : []
  const folders=affected.filter(n => n.kind==='folder').length, requests=affected.filter(n => n.kind==='request').length
  const direct=edited ? nodes.filter(n => n.parent===edited.id) : []
  const title=editing?.kind==='create-collection' ? 'Create collection' : editing?.kind==='create-folder' ? 'Create folder' : editing ? `${editing.kind[0]!.toUpperCase()+editing.kind.slice(1)} ${edited?.kind}` : ''
  const locked=busy || requestController.busy
  const expanded=new Set([...(expansion?.expandedCollectionIds??[]),...(expansion?.expandedFolderIds??[])])
  return <>
    <Heading size="sm">Collections</Heading>
    <Button ref={create} disabled={!snapshot || locked} variant="outline" size="sm" onClick={() => open({kind:'create-collection'})}>Create Collection</Button>
    {!workspaceId && <Text fontSize="sm">Select a workspace to manage collections.</Text>}
    {workspaceId && !snapshot && !error && <Text role="status">Loading library…</Text>}
    {error && <Box role="alert"><Text fontSize="sm">{error}</Text><Button size="sm" disabled={busy} onClick={() => { void reload() }}>Reload library</Button></Box>}
    {snapshot && <>
      <LibrarySearch workspaceId={workspaceId!} snapshot={snapshot} revision={requestController.revision} locked={locked} onSearching={onSearching} onSelect={async id=>{if(id!==current.current.saved?.id) await guard(()=>current.current.open(id))}}/>
      {!searching && <>
      <Text fontSize="xs" color="fg.muted">Workspace root · {snapshot.requests.filter(r => r.destination.collectionId===null).length} requests</Text>
      <Box flexShrink={0} role="tree" aria-label="API library" aria-busy={busy}>
        {rendered.map((node,localIndex) => { const index=pageStart+localIndex; return <Box key={node.id} role={node.kind==='request' ? 'group' : undefined} aria-label={node.kind==='request' ? `Request: ${node.name}` : undefined}>
          <Flex data-library-id={node.id} ref={element => { if(element) rowsRef.current.set(node.id,element); else rowsRef.current.delete(node.id) }} role="treeitem" aria-label={`${node.kind==='request' ? node.method+' request' : node.kind}: ${node.label}`} aria-level={node.level} aria-expanded={node.kind==='request' ? undefined : expanded.has(node.id)} aria-selected={node.kind==='request' ? node.id===requestController.saved?.id : undefined} tabIndex={(focusId && rendered.some(n => n.id===focusId) ? focusId===node.id : index===pageStart) ? 0 : -1} onFocus={event => { if(event.target===event.currentTarget) setFocusId(node.id) }} pl={`${Math.min(node.level-1,4)*8}px`} gap="1" align="center" borderRadius="sm" bg={node.id===requestController.saved?.id ? 'bg.emphasized' : undefined}
            onKeyDown={event => {
              if(event.target!==event.currentTarget) return
              const key=event.key
              if(['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End','Enter'].includes(key)) event.preventDefault()
              if(key==='ArrowDown') focus(visible[Math.min(index+1,visible.length-1)]!.id)
              if(key==='ArrowUp') focus(visible[Math.max(index-1,0)]!.id)
              if(key==='Home') focus(visible[0]!.id)
              if(key==='End') focus(visible.at(-1)!.id)
              if(key==='ArrowRight' && node.kind!=='request') { if(!expanded.has(node.id)) toggle(node); else if(visible[index+1]?.parent===node.id) focus(visible[index+1]!.id) }
              if(key==='ArrowLeft') { if(node.kind!=='request' && expanded.has(node.id)) toggle(node); else if(node.parent) focus(node.parent) }
              if(key==='Enter' && !locked) void choose(node)
            }}>
            <Button aria-label={node.label} tabIndex={-1} variant="ghost" size="sm" minW="0" flex="1" justifyContent="start" whiteSpace="normal" h="auto" py="2" disabled={locked} onClick={() => { focus(node.id); void choose(node) }}>
              {node.kind==='request' ? <Badge colorPalette="blue" fontSize="xs">{node.method}</Badge> : <Text aria-hidden="true">{expanded.has(node.id) ? '▾' : '▸'}</Text>}
              <Text overflowWrap="anywhere" textAlign="left">{node.label}</Text>
            </Button>
            <Menu.Root><Menu.Trigger asChild><Button ref={el => { if(el) triggers.current.set(node.id,el); else triggers.current.delete(node.id) }} variant="ghost" size="xs" disabled={locked} aria-label={`Actions for ${node.kind}: ${node.label}`}>⋯</Button></Menu.Trigger>
              <Portal><Menu.Positioner><Menu.Content>
                {node.kind!=='request' && <><Menu.Item value="request" onClick={() => { void newRequest(node.destination) }}>New request</Menu.Item><Menu.Item value="folder" onClick={() => open({kind:'create-folder',destination:node.destination})}>New folder</Menu.Item></>}
                <Menu.Item value="rename" onClick={() => { if(node.kind==='request') void guard(async () => { const ok=await current.current.open(node.id); if(ok) current.current.focusName(); return ok }); else open({kind:'rename',node}) }}>Rename {node.kind}</Menu.Item>
                {node.kind!=='collection' && <Menu.Item value="move" onClick={() => open({kind:'move',node})}>Move {node.kind}</Menu.Item>}
                <Menu.Item value="delete" onClick={() => open({kind:'delete',node})}>Delete {node.kind}</Menu.Item>
              </Menu.Content></Menu.Positioner></Portal>
            </Menu.Root>
          </Flex>
        </Box>})}
      </Box>
      {visible.length>TREE_PAGE_SIZE && <Box aria-label="Tree pages"><Text fontSize="xs">{pageStart+1}–{Math.min(pageStart+TREE_PAGE_SIZE,visible.length)} of {visible.length} visible nodes</Text>
        <Button size="xs" variant="outline" disabled={pageStart===0} onClick={()=>{setFocusId(null);setTreePage(pageStart-TREE_PAGE_SIZE)}}>Previous nodes</Button>
        <Button size="xs" variant="outline" disabled={pageStart+TREE_PAGE_SIZE>=visible.length} onClick={()=>{setFocusId(null);setTreePage(pageStart+TREE_PAGE_SIZE)}}>Next nodes</Button>
      </Box>}
      </>}
      {!searching && !visible.length && <Text fontSize="sm" color="fg.muted">No collections or saved requests</Text>}
    </>}
    <Button data-create-request disabled={!snapshot || locked} variant="outline" size="sm" onClick={() => { void newRequest(root) }}>Create Request</Button>
    <Dialog.Root open={editing!==null} onOpenChange={({open}) => { if(!open && !busy) setEditing(null) }} initialFocusEl={() => editing?.kind==='delete' ? cancel.current : editing?.kind==='move' ? select.current : input.current} finalFocusEl={() => returnId.current ? triggers.current.get(returnId.current)??create.current : create.current}>
      <Portal><Dialog.Backdrop/><Dialog.Positioner><Dialog.Content>
        <Dialog.Header><Dialog.Title>{title}</Dialog.Title></Dialog.Header>
        <Dialog.Body>
          {editing?.kind==='delete' ? <Dialog.Description>
            Delete “{edited?.label}”? {edited?.kind==='collection' ? `${folders} folders will be removed; ${requests} saved requests will move to workspace root. The requests will not be deleted.` : edited?.kind==='folder' ? `1 folder will be removed. ${direct.filter(n => n.kind==='folder').length} direct child folders and ${direct.filter(n => n.kind==='request').length} direct requests will move to its parent. ${folders} descendant folders and ${requests} requests will be retained, including child subtrees.` : '1 saved request will be permanently deleted.'}
          </Dialog.Description> : editing?.kind==='move' ? <>
            <Dialog.Description mb="3">Move “{edited?.label}” within this workspace. Its configuration stays intact.</Dialog.Description>
            <NativeSelect.Root><NativeSelect.Field ref={select} aria-label="Destination" value={destination} onChange={event => setDestination(event.target.value)}>
              {edited?.kind==='request' && <option value="">Workspace root</option>}
              {containers.map(node => <option key={node.id} value={node.id}>{pathLabel(nodes,node.destination)}</option>)}
            </NativeSelect.Field><NativeSelect.Indicator/></NativeSelect.Root>
          </> : <>
            <Dialog.Description mb="3">Names are trimmed and may contain 1–100 characters. Duplicate names are allowed.</Dialog.Description>
            <label htmlFor="collection-name">{editing?.kind==='create-collection' || edited?.kind==='collection' ? 'Collection name' : 'Folder name'}</label>
            <Input ref={input} id="collection-name" value={name} disabled={busy} aria-invalid={fieldError!==null} onChange={event => { setName(event.target.value); setFieldError(null) }} onKeyDown={event => { if(event.key==='Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() } }}/>
            {fieldError && <Text role="alert" color="red.fg">{fieldError}</Text>}
          </>}
          {error && <Text role="alert">{error}</Text>}
        </Dialog.Body>
        <Dialog.Footer><Button ref={cancel} variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy || (editing?.kind==='move' && edited?.kind==='folder' && (!destination || excluded.has(destination)))} onClick={() => { void submit() }}>{busy ? 'Saving…' : editing?.kind==='delete' ? `Delete ${edited?.kind}` : editing?.kind==='move' ? 'Move' : editing?.kind==='rename' ? 'Save name' : title}</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </>
}
