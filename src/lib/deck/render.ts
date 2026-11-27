// Slide text is Markdown typed by the deck author (or anyone who published a deck). It is
// rendered with `marked` through a renderer that never lets raw HTML through, then filtered
// to an allowlist of tags/attributes — that path needs no DOM, so the SSR viewer (/s/[id])
// renders real formatting. In the browser the result is ALSO sanitised with DOMPurify before
// it reaches {@html} (defence in depth).

import { Marked, type Tokens } from 'marked'
import DOMPurify from 'dompurify'
import type { ColorToken } from './types.js'

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
const ALLOWED = new Set(ALLOWED_TAGS)
const SAFE_URI = /^(?:https?:|mailto:|#)/i

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

const md = new Marked({ gfm: true, breaks: true, async: false })
md.use({
  renderer: {
    // Raw HTML in Markdown is shown as text, never parsed.
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text)
    },
    // Images belong in image elements, not inside text: keep the alt text only.
    image({ text }: Tokens.Image) {
      return escapeHtml(text)
    },
    checkbox({ checked }: Tokens.Checkbox) {
      return checked ? '☑ ' : '☐ '
    },
    link({ href, title, tokens }: Tokens.Link) {
      const inner = this.parser.parseInline(tokens)
      if (!SAFE_URI.test(href.trim())) return inner
      const t = title ? ` title="${escapeHtml(title)}"` : ''
      return `<a href="${escapeHtml(href.trim())}"${t}>${inner}</a>`
    },
  },
})

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g
const ATTR_RE = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g

/**
 * Keep only allowlisted tags and attributes of marked's output. Safe because every `<` that
 * came from deck text was escaped by marked (text, code) or by the `html` renderer above, so
 * each remaining tag was produced by marked itself.
 */
function allowlist(html: string): string {
  return html.replace(TAG_RE, (_m, close: string, name: string, attrs: string) => {
    const tag = name.toLowerCase()
    if (!ALLOWED.has(tag)) return ''
    if (close) return `</${tag}>`
    let keep = ''
    for (const [, rawK, v] of attrs.matchAll(ATTR_RE)) {
      const k = rawK.toLowerCase()
      if (tag === 'a' && k === 'href' && SAFE_URI.test(v)) keep += ` href="${v}"`
      else if (tag === 'a' && k === 'title') keep += ` title="${v}"`
      else if (tag === 'ol' && k === 'start' && /^\d+$/.test(v)) keep += ` start="${v}"`
    }
    return `<${tag}${keep}>`
  })
}

/** Markdown → HTML without a DOM: escaped raw HTML, safe links, allowlisted tags. */
export function markdownToSafeHtml(src: string): string {
  return allowlist(md.parse(src) as string).trim()
}

let purify: ReturnType<typeof DOMPurify> | null = null
function getPurify() {
  if (!purify && typeof window !== 'undefined') purify = DOMPurify(window)
  return purify
}

/** Markdown → sanitised HTML (allowlisted everywhere, plus DOMPurify in the browser). */
export function renderMarkdown(src: string): string {
  const html = markdownToSafeHtml(src)
  const p = getPurify()
  if (!p) return html
  return p.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'start'],
    ALLOWED_URI_REGEXP: SAFE_URI,
    // DOMPurify checks every non-URI-safe attribute against the URI regexp; these are not URIs.
    ADD_URI_SAFE_ATTR: ['start', 'title'],
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
