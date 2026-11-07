import { expect, it } from 'vitest'
import { compareResponseJson, readTestJson, selectedResponseExpectation, EXPECTED_JSON_LIMIT } from '../../src/shared/response-test'
import { requestDraftSchema } from '../../src/shared/requests'

it('compares structure ignoring object order, escapes, formatting and equivalent exact numbers', () => {
  expect(compareResponseJson('{"a":1.00,"b":[true,null,"\\u0061"],"c":-0}', '{ "c":0e100,"b":[true,null,"a"],"a":10e-1 }')).toMatchObject({outcome:'passed',differences:[],limited:false})
  expect(compareResponseJson('9007199254740993','9007199254740992')).toMatchObject({outcome:'changed'})
  expect(compareResponseJson('1e400','2e400')).toMatchObject({outcome:'changed'})
  expect(compareResponseJson('1e400','10e399')).toMatchObject({outcome:'passed'})
})
it('distinguishes missing/null, type, array ordering and reports added/removed paths safely', () => {
  expect(compareResponseJson('{"old":null,"type":1,"items":[1,2],"__proto__":1}', '{"new":null,"type":"1","items":[2,1],"__proto__":2}')).toEqual({outcome:'changed',limited:false,differences:[
    {path:'old',kind:'removed',expected:'null'},
    {path:'type',kind:'changed',expected:'1',actual:'"1"'},
    {path:'items[0]',kind:'changed',expected:'1',actual:'2'},
    {path:'items[1]',kind:'changed',expected:'2',actual:'1'},
    {path:'__proto__',kind:'changed',expected:'1',actual:'2'},
    {path:'new',kind:'added',actual:'null'}
  ]})
  expect(compareResponseJson('[1,2]','[1]')).toMatchObject({differences:[{path:'[1]',kind:'removed',expected:'2'}]})
  expect(compareResponseJson('{}','{"a.b[0]":false}')).toMatchObject({differences:[{path:'["a.b[0]"]',kind:'added',actual:'false'}]})
})
it.each(['', '{"a":}', '{"a":1,}', '/* comment */{}', '{"x":1,"x":2}', '<html>error</html>', 'NaN'])('never passes invalid or ambiguous JSON %s', text => {
  expect(compareResponseJson('{}',text).outcome).toBe('unavailable')
  expect(compareResponseJson(text,'{}').outcome).toBe('unavailable')
})
it('bounds input bytes, parser depth, node count, number work and difference previews', () => {
  for (const text of ['"'+'a'.repeat(EXPECTED_JSON_LIMIT)+'"', '"'+'ی'.repeat(EXPECTED_JSON_LIMIT/2)+'"', '['.repeat(129)+'0'+']'.repeat(129), JSON.stringify(Array(20001).fill(0)), '1e'+'1'.repeat(2048)]) expect(readTestJson(text)).toHaveProperty('message')
  expect(readTestJson('{\n "a":\n}')).toMatchObject({message:expect.stringContaining('Line 3')})
  const result=compareResponseJson(JSON.stringify(Array(102).fill('a'.repeat(400))),JSON.stringify(Array(102).fill('b'.repeat(400))))
  expect(result).toMatchObject({outcome:'changed',limited:true})
  if(result.outcome==='unavailable')throw Error('Missing differences')
  expect(result.differences).toHaveLength(100);expect(result.differences[0]!.expected).toBe(JSON.stringify('a'.repeat(400)))
  expect(compareResponseJson(JSON.stringify([...Array(100).fill(0), 2]), JSON.stringify([...Array(100).fill(1), 2]))).toMatchObject({ outcome: 'changed', limited: false })
})
it('selects only the current variant expectation and validates at the IPC boundary', () => {
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222'
  const draft={name:'Test',method:'POST',urlTemplate:'http://127.0.0.1/',expectedResponse:'{"root":true}',bodyVariants:[{id:a,name:'A',body:{kind:'none'},expectedResponse:'null'},{id:b,name:'B',body:{kind:'none'}}],selectedBodyVariantId:b}
  expect(selectedResponseExpectation(draft)).toEqual({expected:undefined,bodyName:'B'})
  expect(selectedResponseExpectation({...draft,selectedBodyVariantId:a})).toEqual({expected:'null',bodyName:'A'})
  expect(requestDraftSchema.safeParse(draft).success).toBe(true)
  expect(requestDraftSchema.safeParse({...draft,expectedResponse:'{'}).success).toBe(false)
  expect(requestDraftSchema.safeParse({...draft,bodyVariants:[{...draft.bodyVariants[0],expectedResponse:'{"duplicate":1,"duplicate":2}'}],selectedBodyVariantId:a}).success).toBe(false)
})
