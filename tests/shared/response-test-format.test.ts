import { expect, it } from 'vitest'
import { prettyDifferenceJson } from '../../src/renderer/features/response/difference-json'
import { compareResponseJson } from '../../src/shared/response-test'

it('pretty prints complete JSON, decodes Persian and retains exact numeric tokens and safe escapes', () => {
  const quote = JSON.stringify('a"b\nc')
  const source = `[{"id":9007199254740993,"name":"\\u067e\\u0627\\u06cc\\u06cc\\u0632 1404","quote":${quote},"huge":1e400}]`
  const text = prettyDifferenceJson(source)
  expect(text).toContain('\n  {\n    "id": 9007199254740993,\n    "name": "پاییز 1404",')
  expect(text).toContain('"huge": 1e400')
  expect(text).toContain(`"quote": ${quote}`)
  expect(compareResponseJson(text, source).outcome).toBe('passed')
})
it('retains full removed values beyond the previous preview limit and readable unambiguous paths', () => {
  const values = Array.from({length:20}, (_,id) => ({id,name:'پاییز 1404'}))
  const result = compareResponseJson(JSON.stringify({data:{scores_headers:values},'$':{x:1},'a.b':1}), '{"$":{"x":2},"a.b":2}')
  if (result.outcome === 'unavailable') throw Error('Missing differences')
  expect(result.differences[0]!.path).toBe('data')
  expect(JSON.parse(prettyDifferenceJson(result.differences[0]!.expected!)) as unknown).toEqual({scores_headers:values})
  expect(result.differences.map(d=>d.path)).toEqual(['data','$.x','["a.b"]'])
  expect(compareResponseJson('{"data":{"scores_headers":[]}}','{"data":{}}')).toMatchObject({differences:[{path:'data.scores_headers',kind:'removed',expected:'[]'}]})
})
