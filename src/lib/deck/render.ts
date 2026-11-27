// Slide text is Markdown typed by the deck author (or anyone who published a deck). It is
// rendered with `marked` and ALWAYS sanitised with DOMPurify before it reaches {@html}.

import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import type { ColorToken } from './types.js'

const md = new Marked({ gfm: true, breaks: true, async: false })

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'del',
  's',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'a',
  'span',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'mark',
  'kbd',
  'sup',
  'sub',
]

let purify: ReturnType<typeof DOMPurify> | null = null
function getPurify() {
  if (purify) return purify
  // In the browser DOMPurify binds to window; on the server the SSR path renders through
  // jsdom-free fallback below.
  if (typeof window !== 'undefined') purify = DOMPurify(window)
  return purify
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

/** Markdown → sanitised HTML. On the server (no DOM) it returns escaped plain text with line breaks. */
export function renderMarkdown(src: string): string {
  const p = getPurify()
  if (!p) return escapeHtml(src).replace(/\n/g, '<br>')
  const html = md.parse(src) as string
  return p.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'start'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
  })
}

/** Plain-text preview of Markdown (thumbnails, titles, search). */
export function plainText(src: string): string {
  return src
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~#>]/g, '')
    .replace(/^\s*[-+]\s+/gm, '• ')
    .trim()
}

/** ColorToken → CSS colour expression on dssoca tokens. */
export const COLOR_VAR: Record<ColorToken, string> = {
  fg: 'var(--ss-fg)',
  muted: 'var(--ss-fg-muted)',
  accent: 'var(--ss-primary)',
  bg: 'var(--ss-bg)',
  surface: 'var(--ss-bg-elev)',
  success: 'var(--ss-success)',
  warning: 'var(--ss-yellow)',
  danger: 'var(--ss-danger)',
  info: 'var(--ss-blue)',
}
