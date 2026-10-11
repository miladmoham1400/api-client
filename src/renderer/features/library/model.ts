import type { LibrarySnapshot } from '../../../shared/library-view'
import type { RequestDestination, WorkspaceTreeState } from '../../../shared/api-library'
export type Node = {id:string;kind:'collection'|'folder'|'request';name:string;label:string;method?:string;parent:string|null;level:number;destination:RequestDestination;order:number}
const compare=(a:string,b:string) => {
  const left=Array.from(a),right=Array.from(b)
  for(let i=0;i<Math.min(left.length,right.length);i++) { const difference=left[i]!.codePointAt(0)!-right[i]!.codePointAt(0)!; if(difference) return difference }
  return left.length-right.length
}
export function libraryNodes(snapshot:LibrarySnapshot):Node[] {
  const nodes:Node[]=[
    ...snapshot.collections.map(c => ({id:c.id,kind:'collection' as const,name:c.name,label:c.name,parent:null,level:1,destination:{collectionId:c.id,folderId:null},order:c.sortOrder})),
    ...snapshot.folders.map(f => ({id:f.id,kind:'folder' as const,name:f.name,label:f.name,parent:f.parentFolderId??f.collectionId,level:0,destination:{collectionId:f.collectionId,folderId:f.id},order:f.sortOrder})),
    ...snapshot.requests.map(r => ({id:r.id,kind:'request' as const,name:r.name,label:r.name,method:r.method,parent:r.destination.folderId??r.destination.collectionId,level:0,destination:r.destination,order:0}))
  ]
  const byId=new Map(nodes.map(n => [n.id,n]))
  for(const node of nodes) {
    let parent=node.parent; node.level=1
    while(parent) { node.level++; parent=byId.get(parent)?.parent??null }
    const duplicates=nodes.filter(n => n.parent===node.parent && n.kind===node.kind && n.name===node.name).sort((a,b) => compare(a.id,b.id))
    if(duplicates.length>1) node.label=`${node.name} (${duplicates.findIndex(n => n.id===node.id)+1})`
  }
  return nodes.sort((a,b) => (a.kind==='request' ? 1 : 0)-(b.kind==='request' ? 1 : 0) || a.order-b.order || compare(a.name,b.name) || compare(a.id,b.id))
}
export function visibleNodes(nodes:readonly Node[],state:Pick<WorkspaceTreeState,'expandedCollectionIds'|'expandedFolderIds'>):Node[] {
  const expanded=new Set([...state.expandedCollectionIds,...state.expandedFolderIds]), result:Node[]=[]
  const children=new Map<string|null,Node[]>()
  for(const node of nodes) { const rows=children.get(node.parent)??[]; rows.push(node); children.set(node.parent,rows) }
  function visit(parent:string|null) { for(const node of children.get(parent)??[]) { result.push(node); if(expanded.has(node.id)) visit(node.id) } }
  visit(null); return result
}
export function ancestors(nodes:readonly Node[],destination:RequestDestination):Node[] {
  const result:Node[]=[], byId=new Map(nodes.map(n => [n.id,n])); let id=destination.folderId??destination.collectionId
  while(id) { const node=byId.get(id); if(!node) break; result.unshift(node); id=node.parent }
  return result
}
export function pathLabel(nodes:readonly Node[],destination:RequestDestination) { return ['Workspace root',...ancestors(nodes,destination).map(n => n.label)].join(' / ') }
export function descendants(nodes:readonly Node[],id:string):Node[] {
  const result:Node[]=[]; let frontier=[id]
  while(frontier.length) { const parents=new Set(frontier), children=nodes.filter(n => n.parent!==null && parents.has(n.parent)); result.push(...children); frontier=children.filter(n => n.kind!=='request').map(n => n.id) }
  return result
}
