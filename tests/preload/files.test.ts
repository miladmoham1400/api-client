import { expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createFileApi } from '../../src/preload/files'

it('forwards only fixed validated file commands and rejects outgoing path/Node data', async () => {
  const workspace = randomUUID(), id = randomUUID(), invoke = vi.fn(async () => ({ ok: true, data: null }))
  const api = createFileApi(invoke)
  expect(Object.isFrozen(api)).toBe(true)
  expect(await api.chooseUpload('/tmp/arbitrary')).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  expect(await api.releaseUpload(workspace, '/tmp/arbitrary')).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  expect(invoke).not.toHaveBeenCalled()
  expect(await api.chooseUpload(workspace)).toEqual({ ok: true, data: null })
  expect(invoke).toHaveBeenLastCalledWith('files:choose-upload', workspace)
  await api.releaseUpload(workspace, id)
  expect(invoke).toHaveBeenLastCalledWith('files:release-upload', workspace, id)
  const unsafe = createFileApi(async () => ({ ok: true, data: { fileId: id, name: 'file', size: 0, path: '/private/path' } }))
  const result = await unsafe.chooseUpload(workspace)
  expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  expect(JSON.stringify(result)).not.toContain('/private/path')
})
