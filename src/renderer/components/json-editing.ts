import { closeBrackets, deleteBracketPair, insertBracket } from '@codemirror/autocomplete'
import { insertNewlineAndIndent } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { EditorState, type Transaction } from '@codemirror/state'
import type { KeyboardEvent } from 'react'

const extensions = [json(), closeBrackets()]
const editingKeys = new Set(['Enter', '{', '}', '[', ']', '"', 'Backspace'])

function changedRange(before: string, after: string) {
  let from = 0, to = before.length, end = after.length
  while (from < to && from < end && before[from] === after[from]) from++
  while (to > from && end > from && before[to - 1] === after[end - 1]) { to--; end-- }
  return { from, to, insert: after.slice(from, end) }
}

export function editJsonTextarea(event: KeyboardEvent<HTMLTextAreaElement>, previous: EditorState | null): EditorState | null {
  if (!editingKeys.has(event.key) || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return previous
  const input = event.currentTarget
  const { value, selectionStart: from, selectionEnd: to, selectionDirection } = input
  const selection = selectionDirection === 'backward' ? { anchor: to, head: from } : { anchor: from, head: to }
  // Keep native typing and undo in the textarea. Map its edits into CodeMirror before
  // running structural commands so it can track the closing characters it inserted.
  const state = previous
    ? previous.update({ changes: changedRange(previous.doc.toString(), value), selection }).state
    : EditorState.create({ doc: value, selection, extensions })
  let transaction: Transaction | null = null
  const dispatch = (next: Transaction) => { transaction = next }
  if (event.key === 'Enter') insertNewlineAndIndent({ state, dispatch })
  else if (event.key === 'Backspace') deleteBracketPair({ state, dispatch })
  else transaction = insertBracket(state, event.key)
  return transaction ? applyEdit(event, transaction) : state
}

function applyEdit(event: KeyboardEvent<HTMLTextAreaElement>, transaction: Transaction) {
  event.preventDefault()
  const input = event.currentTarget
  if (transaction.docChanged) {
    // Apply one native replacement, including replacements that wrap selected text.
    const { from, to, insert } = changedRange(input.value, transaction.newDoc.toString())
    input.setSelectionRange(from, to)
    if (!document.execCommand('insertText', false, insert)) {
      input.setRangeText(insert, from, to)
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    }
  }
  const { from, to, anchor, head } = transaction.newSelection.main
  input.setSelectionRange(from, to, anchor > head ? 'backward' : 'forward')
  return transaction.state
}
