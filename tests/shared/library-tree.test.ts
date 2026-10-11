import { expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { librarySnapshotSchema } from '../../src/shared/library-view'
import { libraryNodes, visibleNodes, pathLabel, descendants } from '../../src/renderer/features/library/model'
it('orders/disambiguates nested metadata, collapses descendants and keeps explicit destination paths and deletion counts', () => {
  const w=randomUUID(),c=randomUUID(),f=randomUUID(),child=randomUUID(),q=randomUUID(),stamp=new Date().toISOString()
  const identity=(id:string,name:string) => ({id,name,workspaceId:w,createdAt:stamp,updatedAt:stamp})
  const snapshot=librarySnapshotSchema.parse({workspaceId:w,collections:[{...identity(c,'Users'),sortOrder:0}],folders:[{...identity(f,'Users'),collectionId:c,parentFolderId:null,sortOrder:0},{...identity(child,'Auth'),collectionId:c,parentFolderId:f,sortOrder:0}],requests:[{...identity(q,'Login'),method:'POST',destination:{kind:'folder',collectionId:c,folderId:child}},{...identity(randomUUID(),'Login'),method:'GET',destination:{kind:'folder',collectionId:c,folderId:child}}],treeState:{workspaceId:w,version:1,expandedCollectionIds:[],expandedFolderIds:[]}})
  const nodes=libraryNodes(snapshot)
  expect(visibleNodes(nodes,snapshot.treeState).map(n => n.id)).toEqual([c])
  const state={...snapshot.treeState,expandedCollectionIds:[c],expandedFolderIds:[f,child]}
  expect(visibleNodes(nodes,state).map(n => n.kind)).toEqual(['collection','folder','folder','request','request'])
  expect(nodes.filter(n => n.kind==='request').map(n => n.label).sort()).toEqual(['Login (1)','Login (2)'])
  expect(pathLabel(nodes,{collectionId:c,folderId:child})).toBe('Workspace root / Users / Users / Auth')
  expect(descendants(nodes,f).filter(n => n.kind==='folder')).toHaveLength(1)
  expect(descendants(nodes,f).filter(n => n.kind==='request')).toHaveLength(2)
  expect(librarySnapshotSchema.safeParse({...snapshot,requests:[{...snapshot.requests[0],destination:{kind:'folder',collectionId:c,folderId:randomUUID()}}]}).success).toBe(false)
})
it('sorts sibling names by Unicode code point rather than locale or UTF-16 surrogate order', () => {
  const w=randomUUID(),stamp=new Date().toISOString()
  const requests=['😀','\uE000'].map(name => ({id:randomUUID(),name,workspaceId:w,createdAt:stamp,updatedAt:stamp,method:'GET' as const,destination:{kind:'workspace' as const,collectionId:null,folderId:null}}))
  const snapshot=librarySnapshotSchema.parse({workspaceId:w,collections:[],folders:[],requests,treeState:{workspaceId:w,version:1,expandedCollectionIds:[],expandedFolderIds:[]}})
  expect(libraryNodes(snapshot).map(n => n.name)).toEqual(['\uE000','😀'])
})
