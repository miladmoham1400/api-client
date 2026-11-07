import { applyEdits, createScanner, format, SyntaxKind, type Edit } from 'jsonc-parser'

/** Decode JSON strings for reading while retaining exact numeric source tokens. */
export function prettyDifferenceJson(source: string): string {
  const scanner = createScanner(source)
  const edits: Edit[] = []
  for (let token = scanner.scan(); token !== SyntaxKind.EOF; token = scanner.scan()) {
    if (token === SyntaxKind.StringLiteral) {
      edits.push({ offset: scanner.getTokenOffset(), length: scanner.getTokenLength(), content: JSON.stringify(scanner.getTokenValue()) })
    }
  }
  const decoded = applyEdits(source, edits)
  return applyEdits(decoded, format(decoded, undefined, { insertSpaces: true, tabSize: 2, eol: '\n' })).trim()
}
