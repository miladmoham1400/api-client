import { useMemo } from 'react'
import DOMPurify from 'dompurify'

/** Opaque, scriptless document. Sanitization never touches the application DOM. */
export function previewDocument(source: string): string {
  const clean = DOMPurify.sanitize(source, {
    WHOLE_DOCUMENT: true,
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'frame', 'object', 'embed', 'base', 'meta', 'link', 'form', 'input', 'button', 'textarea', 'select', 'video', 'audio', 'source'],
    FORBID_ATTR: ['href', 'src', 'srcset', 'action', 'formaction', 'target', 'download', 'ping', 'autofocus', 'contenteditable'],
  })
  // The policy precedes all response-controlled markup, including CSS imports/URLs.
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; frame-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>body{margin:16px;background:#fff;color:#18181b;font:14px system-ui;overflow-wrap:anywhere}pre{white-space:pre-wrap}</style></head><body>${clean}</body></html>`
}

export function HtmlPreview({ text }: { text: string }) {
  const document = useMemo(() => previewDocument(text), [text])
  return <iframe title="HTML response preview" sandbox="" referrerPolicy="no-referrer" srcDoc={document} style={{ width: '100%', minHeight: 450, border: 0, background: 'white', borderRadius: 6 }} />
}
