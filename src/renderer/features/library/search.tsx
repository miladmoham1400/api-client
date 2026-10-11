import { useEffect, useRef, useState } from 'react'
import { Badge, Box, Button, Input, NativeSelect, Text } from '@chakra-ui/react'
import type { SearchPage } from '../../../shared/library-search'
import type { LibrarySnapshot } from '../../../shared/library-view'

export function LibrarySearch({workspaceId,snapshot,revision,locked,onSelect,onSearching}:{workspaceId:string;snapshot:LibrarySnapshot;revision:number;locked:boolean;onSelect:(id:string)=>Promise<void>;onSearching:(value:boolean)=>void}) {
  const [query,setQuery]=useState(''),[collection,setCollection]=useState(''),[page,setPage]=useState<SearchPage|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(false)
  const generation=useRef(0),live=useRef(true)
  const active=query.trim().length>0
  const state=useRef({query,collection});state.current={query,collection}
  const fetchRef=useRef<(offset:number,revision?:string)=>Promise<void>>(async()=>{})
  fetchRef.current=async(offset,token)=>{
    const stamp=++generation.current, current=state.current
    setLoading(true);setError(false);setPage(null)
    try {
      const result=await window.offlineApi.requests.search(workspaceId,{query:current.query,collectionId:current.collection||null,offset,limit:100,...(token ? {revision:token} : {})})
      if(!live.current || stamp!==generation.current) return
      if(result.ok && result.data.workspaceId===workspaceId && result.data.query===current.query.trim() && result.data.collectionId===(current.collection||null)) setPage(result.data)
      else setError(true)
    } catch {if(live.current && stamp===generation.current) setError(true)}
    finally {if(live.current && stamp===generation.current) setLoading(false)}
  }
  useEffect(()=>{live.current=true;return()=>{live.current=false;generation.current++}},[])
  useEffect(()=>{
    generation.current++;setPage(null);setLoading(false);setError(false);onSearching(active)
    if(active) void fetchRef.current(0)
  },[query,collection,workspaceId,snapshot,revision,active,onSearching])
  return <>
    <Input size="sm" flexShrink={0} aria-label="Search requests" placeholder="Search names, methods, paths" maxLength={200} value={query} disabled={locked} onChange={event=>{generation.current++;setPage(null);setQuery(event.target.value)}}/>
    {active && <Box flexShrink={0} role="region" aria-label="Request search" aria-busy={loading}>
      <NativeSelect.Root size="sm"><NativeSelect.Field aria-label="Search collection" value={collection} onChange={event=>{generation.current++;setPage(null);setCollection(event.target.value)}}>
        <option value="">All collections</option>{snapshot.collections.map((c,index)=><option key={c.id} value={c.id}>{c.name} · {index+1}</option>)}
      </NativeSelect.Field><NativeSelect.Indicator/></NativeSelect.Root>
      <Button size="xs" variant="outline" onClick={()=>{generation.current++;setPage(null);setQuery('')}}>Clear search</Button>
      {loading && <Text role="status">Searching…</Text>}
      {error && <Box role="alert"><Text>Search changed or is unavailable. Restart from the first page.</Text><Button size="xs" onClick={()=>{void fetchRef.current(0)}}>Retry search</Button></Box>}
      {page && <>
        <Text role="status" data-search-ready={page.query} fontSize="xs">{page.total ? page.offset+1 : 0}–{page.offset+page.rows.length} of {page.total} requests</Text>
        {page.rows.map((row,index)=><Button key={row.id} data-search-id={row.id} title={row.id} variant="ghost" h="auto" py="2" w="full" whiteSpace="normal" justifyContent="start" disabled={locked} onClick={()=>{void onSelect(row.id)}}><Box textAlign="left" overflowWrap="anywhere"><Badge colorPalette="blue">{row.method}</Badge> {row.name}<Text fontSize="xs">{row.path} · #{page.offset+index+1}</Text></Box></Button>)}
        {page.offset>0 && <Button size="xs" variant="outline" onClick={()=>{void fetchRef.current(Math.max(0,page.offset-page.limit),page.revision)}}>Previous results</Button>}
        {page.nextOffset!==null && <Button size="xs" variant="outline" onClick={()=>{void fetchRef.current(page.nextOffset!,page.revision)}}>Next results</Button>}
      </>}
    </Box>}
  </>
}
