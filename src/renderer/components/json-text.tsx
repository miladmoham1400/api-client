import { useMemo, useRef, type ComponentProps } from 'react'
import { Box, Text, Textarea } from '@chakra-ui/react'
import { jsonTokens, responseJsonTokens, type JsonToken } from './json-tokens'

export function JsonResponse({ text }: { text: string }) {
  const { tokens, limited } = useMemo(() => responseJsonTokens(text), [text])
  return <>
    {limited && <Text fontSize="sm" mb="2">Syntax colors cover the beginning of this large response. The remaining text is shown unchanged below.</Text>}
    <Box as="pre" className="json-response" aria-label="Response body text" fontFamily="mono" fontSize="sm" whiteSpace="pre-wrap" overflowWrap="anywhere"><TokenSpans tokens={tokens} /></Box>
  </>
}

function TokenSpans({ tokens }: { tokens: JsonToken[] }) {
  return tokens.map((token, index) => <span key={index} className={`json-${token.kind}`}>{token.text}</span>)
}

export function JsonEditor(props: ComponentProps<typeof Textarea> & { value: string }) {
  const backdrop = useRef<HTMLPreElement>(null)
  const tokens = useMemo(() => jsonTokens(props.value), [props.value])
  const highlighted = tokens.some(token => token.kind !== 'plain')
  return <div className="json-editor">
    <pre ref={backdrop} className="json-editor-backdrop" aria-hidden="true">{highlighted && <><TokenSpans tokens={tokens} />{'\n'}</>}</pre>
    <Textarea {...props} className={`json-editor-input${highlighted ? ' json-editor-highlighted' : ''}`} spellCheck={false} autoCapitalize="off" autoCorrect="off" onScroll={event => {
      if (backdrop.current) { backdrop.current.scrollTop = event.currentTarget.scrollTop; backdrop.current.scrollLeft = event.currentTarget.scrollLeft }
    }} />
  </div>
}
