import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { LibraryService } from './library-view'
import { RepositoryError } from '../db/repositories'
import { compareCodePoints, normalizeSearch, searchInputSchema, searchPageSchema, type SearchInput } from '../../shared/library-search'

export function searchLibrary(db:Database.Database,w:string,input:SearchInput) {
  const args=searchInputSchema.parse(input), snapshot=new LibraryService(db).list(w)
  if(args.collectionId && !snapshot.collections.some(c=>c.id===args.collectionId)) throw new RepositoryError('NOT_FOUND')
  const collections=new Map(snapshot.collections.map(c=>[c.id,c.name])), folders=new Map(snapshot.folders.map(f=>[f.id,f]))
  const rows=snapshot.requests.map(row=>{
    const names:string[]=[], destination=row.destination
    let id=destination.folderId
    // Snapshot validation has already proved owned, acyclic, bounded hierarchy.
    while(id) {const folder=folders.get(id)!;names.unshift(folder.name);id=folder.parentFolderId}
    if(destination.collectionId) names.unshift(collections.get(destination.collectionId)!)
    return {...row,path:['Workspace root',...names].join(' / ')}
  }).sort((a,b)=>compareCodePoints(a.path,b.path)||compareCodePoints(a.name,b.name)||compareCodePoints(a.method,b.method)||compareCodePoints(a.id,b.id))
  // Covers all library metadata, including empty ancestors and moves. Expansion/selection do not invalidate pages.
  const revision=createHash('sha256').update(JSON.stringify({query:normalizeSearch(args.query),collectionId:args.collectionId??null,limit:args.limit,collections:snapshot.collections,folders:snapshot.folders,rows})).digest('hex')
  if(args.revision!==undefined && args.revision!==revision) throw new RepositoryError('VALIDATION')
  const query=normalizeSearch(args.query)
  const matches=rows.filter(r=>(!args.collectionId || r.destination.collectionId===args.collectionId) && (!query || [r.name,r.method,r.path].some(value=>normalizeSearch(value).includes(query))))
  if(args.offset>matches.length) throw new RepositoryError('VALIDATION')
  const page=matches.slice(args.offset,args.offset+args.limit),end=args.offset+page.length
  return searchPageSchema.parse({workspaceId:w,query:args.query.trim(),collectionId:args.collectionId??null,offset:args.offset,limit:args.limit,revision,total:matches.length,nextOffset:end<matches.length ? end : null,rows:page})
}
