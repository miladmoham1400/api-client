import { describe, expect, it } from 'vitest'
import { jsonTokens, responseJsonTokens, JSON_HIGHLIGHT_LIMIT, JSON_TOKEN_LIMIT, RESPONSE_HIGHLIGHT_LIMIT, RESPONSE_TOKEN_LIMIT } from '../../src/renderer/components/json-tokens'

describe('bounded JSON presentation', () => {
  it('colors a dense response whose Pretty output exceeds the editor limits', () => {
    const raw = JSON.stringify(Array.from({ length: 1100 }, (_, id) => ({ id, name: 'سلام', active: true })))
    const pretty = JSON.stringify(JSON.parse(raw), null, 2)
    expect(raw.length).toBeLessThan(JSON_HIGHLIGHT_LIMIT)
    expect(pretty.length).toBeGreaterThan(JSON_HIGHLIGHT_LIMIT)
    expect(jsonTokens(pretty)).toEqual([{ text: pretty, kind: 'plain' }])
    for (const source of [raw, pretty]) {
      const result = responseJsonTokens(source)
      expect(result.limited).toBe(false)
      expect(result.tokens.map(token => token.text).join('')).toBe(source)
      expect(result.tokens.filter(token => token.kind === 'key')).toHaveLength(3300)
      expect(result.tokens.some(token => token.kind === 'string')).toBe(true)
      expect(result.tokens.length).toBeGreaterThan(JSON_TOKEN_LIMIT)
    }
  })
  it('preserves all response text and colored prefix when either safety budget is reached', () => {
    for (const source of ['{"key":1,"tail":"' + 'x'.repeat(RESPONSE_HIGHLIGHT_LIMIT) + '"}', '[' + '1,'.repeat(RESPONSE_TOKEN_LIMIT) + 'null]']) {
      const result = responseJsonTokens(source)
      expect(result.limited).toBe(true)
      expect(result.tokens.length).toBeLessThanOrEqual(RESPONSE_TOKEN_LIMIT)
      expect(result.tokens.some(token => token.kind !== 'plain')).toBe(true)
      expect(result.tokens.at(-1)?.kind).toBe('plain')
      expect(result.tokens.map(token => token.text).join('')).toBe(source)
    }
  })
  it('distinguishes keys, strings, numbers, booleans and null without normalizing source', () => {
    const escaped = JSON.stringify('a"b\\c')
    const source = ` {\n "key" : "سلام 🌍", "escaped": ${escaped}, "key": -1.20e+30, "huge": 9007199254740993, "yes": true, "no": false, "empty": null }  `
    const tokens = jsonTokens(source)
    expect(tokens.map(token => token.text).join('')).toBe(source)
    expect(tokens.filter(token => token.kind === 'key').map(token => token.text)).toEqual(['"key"', '"escaped"', '"key"', '"huge"', '"yes"', '"no"', '"empty"'])
    expect(tokens.filter(token => token.kind === 'number').map(token => token.text)).toEqual(['-1.20e+30', '9007199254740993'])
    expect(tokens.filter(token => token.kind === 'boolean').map(token => token.text)).toEqual(['true', 'false'])
    expect(tokens.filter(token => token.kind === 'null').map(token => token.text)).toEqual(['null'])
    expect(tokens.find(token => token.text === escaped)?.kind).toBe('string')
  })
  it('retains incomplete JSON, templates, empty text and hostile HTML as literal text', () => {
    for (const source of ['', '{"key":', '{"n": {{number}}, "s": "{{value}}"}', '{"html":"<script>alert(1)</script><img src=x onerror=alert(1)>"}', '"unterminated\\']) {
      expect(jsonTokens(source).map(token => token.text).join('')).toBe(source)
    }
  })
  it('falls back to one unchanged text token for oversized or token-dense input', () => {
    for (const source of ['x'.repeat(JSON_HIGHLIGHT_LIMIT + 1), '[' + '0,'.repeat(JSON_TOKEN_LIMIT) + '0]']) {
      expect(jsonTokens(source)).toEqual([{ kind: 'plain', text: source }])
    }
  })
})
