import { describe, expect, it } from 'vitest'
import { PRETTY_INPUT_LIMIT, prettyJson } from '../../src/renderer/features/response/format'

describe('bounded opt-in response formatting', () => {
  it('formats JSON while preserving its values and original raw source', () => {
    const raw = '{"message":"سلام","html":"<script>synthetic()</script>","items":[1,null]}'
    const result = prettyJson(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Missing formatted text')
    expect(JSON.parse(result.text)).toEqual(JSON.parse(raw))
    expect(result.text).toContain('\n  "message"')
    expect(raw).not.toContain('\n')
  })
  it('leaves invalid JSON and non-JSON available as raw text', () => {
    for (const raw of ['{"broken":', '<script>synthetic()</script>', '', 'undefined']) expect(prettyJson(raw)).toMatchObject({ ok: false })
  })
  it('rejects oversized input before parsing and bounds expanded output', () => {
    expect(prettyJson(' '.repeat(PRETTY_INPUT_LIMIT + 1))).toMatchObject({ ok: false, message: expect.stringContaining('64 Ki') })
    expect(prettyJson('['.repeat(2000) + '0' + ']'.repeat(2000))).toMatchObject({ ok: false })
  })
})
