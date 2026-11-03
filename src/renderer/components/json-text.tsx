import { TemplateTextarea } from './template-field'
import { useMemo, type ComponentProps } from 'react'
import { Box, Text, Textarea } from '@chakra-ui/react'
import { responseJsonTokens, type JsonToken } from './json-tokens'

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

export function JsonEditor(props: ComponentProps<typeof Textarea> & { value: string }) { return <TemplateTextarea {...props} syntax="json" /> }
