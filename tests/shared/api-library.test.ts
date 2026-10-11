import { expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { folderDepths, libraryContainerSchema, libraryRequestMetadataSchema, requestDestinationSchema, workspaceTreeStateSchema } from '../../src/shared/api-library'

it('distinguishes workspace/collection/folder destinations and rejects inconsistent or credential-bearing metadata', () => {
  const collectionId = randomUUID(), folderId = randomUUID()
  for (const value of [{ kind: 'workspace', collectionId: null, folderId: null }, { kind: 'collection', collectionId, folderId: null }, { kind: 'folder', collectionId, folderId }]) expect(libraryContainerSchema.parse(value)).toEqual(value)
  for (const value of [{ kind: 'workspace', collectionId, folderId: null }, { kind: 'collection', collectionId, folderId }, { kind: 'folder', collectionId: null, folderId }]) expect(libraryContainerSchema.safeParse(value).success).toBe(false)
  expect(requestDestinationSchema.safeParse({ collectionId: null, folderId }).success).toBe(false)
  const row = { id: randomUUID(), workspaceId: randomUUID(), name: 'API', method: 'GET', destination: { kind: 'workspace', collectionId: null, folderId: null }, createdAt: '2026-10-11T00:00:00Z', updatedAt: '2026-10-11T00:00:00Z' }
  expect(libraryRequestMetadataSchema.safeParse(row).success).toBe(true)
  for (const extra of [{ config: {} }, { token: 'synthetic' }, { auth: {} }, { secretId: randomUUID() }]) expect(libraryRequestMetadataSchema.safeParse({ ...row, ...extra }).success).toBe(false)
})
it('bounds/version-validates expansion IDs without persisting drafts or search and rejects duplicate IDs', () => {
  const id = randomUUID(), state = { workspaceId: randomUUID(), version: 1, expandedCollectionIds: [id], expandedFolderIds: [] }
  expect(workspaceTreeStateSchema.safeParse(state).success).toBe(true)
  for (const patch of [{ version: 2 }, { expandedCollectionIds: [id, id] }, { expandedFolderIds: Array.from({ length: 1001 }, () => randomUUID()) }, { search: 'query' }, { draft: {} }]) expect(workspaceTreeStateSchema.safeParse({ ...state, ...patch }).success).toBe(false)
  expect(folderDepths(state.workspaceId, [])).toEqual(new Map())
})
