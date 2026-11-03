import { applyEdits, format, parseTree, printParseErrorCode, type ParseError } from 'jsonc-parser'
export type BodyFormat = { ok: true; text: string } | { ok: false; message: string; line: number; column: number }
const hints: Record<string, string> = {
  PropertyNameExpected: 'Use a double-quoted property name.', ColonExpected: 'Add a colon (:) after the property name.',
  CommaExpected: 'Add a comma (,) between values or properties.', CloseBraceExpected: 'Add the closing brace (}).',
  CloseBracketExpected: 'Add the closing bracket (]).', UnexpectedEndOfString: 'Close the string with a double quote ("), and escape quotes inside it.',
  ValueExpected: 'Add a JSON value; strings need double quotes.', InvalidSymbol: 'Check for a missing double quote or an invalid JSON value.',
  EndOfFileExpected: 'Remove extra content after the JSON value.', InvalidCommentToken: 'JSON does not allow comments.',
}
/** Lexical formatting preserves numeric spelling and placeholders; no value coercion. */
export function formatJsonBody(source: string): BodyFormat {
  if (source.length > 1024 * 1024) return { ok: false, message: 'Formatting is limited to 1 Mi characters. Body is unchanged.', line: 1, column: 1 }
  let marker = '__offline_template_'
  while (source.includes(marker)) marker += '_'
  const placeholders: string[] = [], offsets: number[] = []
  let masked = '', quoted = false, escaped = false
  for (let i = 0; i < source.length;) {
    const match = !quoted && source.startsWith('{{', i) ? /^\{\{\s*[A-Za-z_][A-Za-z0-9_]{0,63}\s*\}\}/.exec(source.slice(i)) : null
    if (match) {
      const replacement = `"${marker}${placeholders.length}__"`
      placeholders.push(match[0]); masked += replacement
      for (let j = 0; j < replacement.length; j++) offsets.push(i)
      i += match[0].length; continue
    }
    const char = source[i]!
    masked += char; offsets.push(i++)
    if (escaped) escaped = false
    else if (char === '\\' && quoted) escaped = true
    else if (char === '"') quoted = !quoted
  }
  const errors: ParseError[] = []
  try { parseTree(masked, errors, { allowTrailingComma: false, disallowComments: true, allowEmptyContent: false }) } catch { return { ok: false, line: 1, column: 1, message: 'JSON nesting is too deep to format. Body is unchanged.' } }
  if (errors.length) {
    const error = errors[0]!, offset = offsets[error.offset] ?? source.length, before = source.slice(0, offset), line = before.split('\n').length, column = offset - before.lastIndexOf('\n')
    return { ok: false, line, column, message: hints[printParseErrorCode(error.error)] ?? 'Check JSON punctuation, quotes and values.' }
  }
  let text: string
  try { text = applyEdits(masked, format(masked, undefined, { insertSpaces: true, tabSize: 2, eol: '\n' })).trim() } catch { return { ok: false, line: 1, column: 1, message: 'JSON could not be formatted. Body is unchanged.' } }
  placeholders.forEach((value, i) => { text = text.replace(`"${marker}${i}__"`, value) })
  return { ok: true, text }
}
