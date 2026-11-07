import { parseTree, printParseErrorCode, type Node, type ParseError } from 'jsonc-parser'

export const EXPECTED_JSON_LIMIT = 256 * 1024
const MAX_NODES = 20_000
const MAX_DEPTH = 128
const MAX_DIFFERENCES = 100
export interface JsonDifference { path: string; kind: 'added' | 'removed' | 'changed'; expected?: string; actual?: string }
export type ResponseTestResult = { outcome: 'passed' | 'changed'; differences: JsonDifference[]; limited: boolean } | { outcome: 'unavailable'; message: string }

/** Compare numeric values without rounding large integers through JavaScript Number. */
function numberKey(text: string): string {
  const [mantissa = '', exponent = '0'] = text.toLowerCase().split('e')
  const negative = mantissa.startsWith('-')
  const unsigned = negative ? mantissa.slice(1) : mantissa
  const [integer = '', fraction = ''] = unsigned.split('.')
  const digits = (integer + fraction).replace(/^0+/, '')
  if (!digits) return '0'
  const significant = digits.replace(/0+$/, '')
  return `${negative ? '-' : ''}${significant}e${BigInt(exponent) - BigInt(fraction.length) + BigInt(digits.length - significant.length)}`
}

export function readTestJson(text: string): { node: Node } | { message: string } {
  if (text.length > EXPECTED_JSON_LIMIT || new TextEncoder().encode(text).length > EXPECTED_JSON_LIMIT) return { message: 'JSON test limit is 256 KiB.' }
  // A lexical depth guard protects the parser itself from deeply nested untrusted input.
  let depth = 0
  let quoted = false
  let escaped = false
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '{' || char === '[') {
      depth++
      if (depth > MAX_DEPTH) return { message: 'JSON test nesting limit is 128.' }
    } else if (char === '}' || char === ']') depth--
  }
  const errors: ParseError[] = []
  const node = parseTree(text, errors, { allowTrailingComma: false, disallowComments: true, allowEmptyContent: false })
  if (errors.length || !node) {
    const error = errors[0]
    const offset = error?.offset ?? 0
    const prefix = text.slice(0, offset)
    return { message: `Line ${prefix.split('\n').length}, column ${offset - prefix.lastIndexOf('\n')}: ${error ? printParseErrorCode(error.error) : 'Expected JSON value'}` }
  }
  const pending = [node]
  let count = 0
  while (pending.length) {
    const current = pending.pop()!
    if (++count > MAX_NODES) return { message: 'JSON test limit is 20,000 nodes.' }
    if (current.type === 'number' && current.length > 2048) return { message: 'JSON test number limit is 2,048 characters.' }
    if (current.type === 'object') {
      const keys = new Set<string>()
      for (const property of current.children ?? []) {
        const key = String(property.children?.[0]?.value)
        if (keys.has(key)) return { message: 'Duplicate object keys are ambiguous. Use unique keys.' }
        keys.add(key)
      }
    }
    pending.push(...(current.children ?? []))
  }
  return { node }
}

export function compareResponseJson(expected: string, actual: string): ResponseTestResult {
  const left = readTestJson(expected)
  const right = readTestJson(actual)
  if ('message' in left) return { outcome: 'unavailable', message: `Expected JSON: ${left.message}` }
  if ('message' in right) return { outcome: 'unavailable', message: `Response JSON: ${right.message}` }
  const differences: JsonDifference[] = []
  let limited = false
  const snippet = (node: Node, source: string) => source.slice(node.offset, node.offset + node.length)
  const record = (difference: JsonDifference) => {
    if (differences.length === MAX_DIFFERENCES) limited = true
    else differences.push(difference)
  }
  const visit = (a: Node | undefined, b: Node | undefined, path: string) => {
    if (limited) return
    if (!a || !b || a.type !== b.type) {
      record({
        path: path || '$',
        kind: !a ? 'added' : !b ? 'removed' : 'changed',
        ...(a ? { expected: snippet(a, expected) } : {}),
        ...(b ? { actual: snippet(b, actual) } : {})
      })
      return
    }
    if (a.type === 'object') {
      const properties = (node: Node) => new Map((node.children ?? []).map(p => [String(p.children![0]!.value), p.children![1]!]))
      const first = properties(a)
      const second = properties(b)
      for (const key of new Set([...first.keys(), ...second.keys()])) {
        const nextPath = /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(key) ? `${path ? `${path}.` : ''}${key}` : `${path}[${JSON.stringify(key)}]`
        visit(first.get(key), second.get(key), nextPath)
      }
    } else if (a.type === 'array') {
      for (let index = 0; index < Math.max(a.children?.length ?? 0, b.children?.length ?? 0); index++) visit(a.children?.[index], b.children?.[index], `${path}[${index}]`)
    } else {
      const equal = a.type === 'number' ? numberKey(expected.slice(a.offset, a.offset + a.length)) === numberKey(actual.slice(b.offset, b.offset + b.length)) : a.value === b.value
      if (!equal) record({ path: path || '$', kind: 'changed', expected: snippet(a, expected), actual: snippet(b, actual) })
    }
  }
  visit(left.node, right.node, '')
  return { outcome: differences.length ? 'changed' : 'passed', differences, limited }
}

export function selectedResponseExpectation(value: { expectedResponse?: string | null | undefined; selectedBodyVariantId?: string | undefined; bodyVariants?: { id: string; name: string; expectedResponse?: string | null | undefined }[] | undefined }) {
  const variant = value.bodyVariants?.find(v => v.id === value.selectedBodyVariantId)
  return { expected: variant ? variant.expectedResponse : value.expectedResponse, bodyName: variant?.name ?? 'Body' }
}
