// The slidessoca Markdown format (docs/markdown-format.md is the spec — keep them in sync).
//
//   ---                       optional front matter: title, theme
//   title: My talk
//   theme: dracula
//   ---
//
//   # Big title               slides are separated by a line containing only ---
//   A subtitle line
//
//   ---
//
//   ## Slide title
//   - bullet
//   ![alt](https://…/a.jpg)   images on their own line, as full http(s) links (ADR 0002)
//
//   Note:                     everything after a Note:/Notes: line = speaker notes
//   say this out loud
//
//   <!-- layout: image-left -->   optional override; otherwise the layout is picked from content
//
// Pure. Local image paths (photo.jpg, ./img/a.png) are not embedded any more: each one is reported
// in `missing` / `warnings` so the import can ask for a full https link.

import { isThemeId, DEFAULT_THEME, type ThemeId } from '../themes.js'
import { makeDeck, makeSlide } from './factory.js'
import { autoLayout } from './layout.js'
import {
  emptyContent,
  LAYOUTS,
  type Deck,
  type ImageRef,
  type LayoutName,
  type Slide,
  type SlideContent,
} from './types.js'

export interface ParsedSlide {
  content: SlideContent
  notes: string
  layout: LayoutName | null
}

export interface ParsedDeck {
  title: string
  theme: ThemeId
  slides: ParsedSlide[]
  /** Image references that are not http(s) links (local paths, embedded data), in order. */
  missing: string[]
  /** One readable warning per missing image ("Slide 3: … use a full https link"). */
  warnings: string[]
}

/** Only http(s) links are images; anything else (a local path, a data: URL) is missing. */
export const linkOnly = (ref: string): string | null => (/^https?:\/\//i.test(ref) ? ref : null)

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function frontMatter(src: string): { meta: Record<string, string>; rest: string } {
  const m = FRONT.exec(src)
  if (!m) return { meta: {}, rest: src }
  const meta: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/.exec(line)
    if (!kv) continue
    const quoted = /^(["'])(.*)\1$/.exec(kv[2])
    // Unquoted values may carry a YAML-style ` # comment` (the spec's own example does).
    meta[kv[1].toLowerCase()] = quoted ? quoted[2] : kv[2].replace(/\s+#.*$/, '')
  }
  return { meta, rest: src.slice(m[0].length) }
}

/** Split on lines that are exactly `---` (ignoring fenced code blocks). */
export function splitSlides(src: string): string[] {
  const out: string[] = []
  let cur: string[] = []
  let fence = false
  for (const line of src.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    if (!fence && /^\s*---\s*$/.test(line)) {
      out.push(cur.join('\n'))
      cur = []
    } else cur.push(line)
  }
  out.push(cur.join('\n'))
  return out.filter((s) => s.trim() !== '')
}

const IMG_LINE = /^\s*!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)\s*$/

export function parseSlide(
  src: string,
  resolve: (ref: string) => string | null = linkOnly,
  missing: string[] = [],
): ParsedSlide {
  const c = emptyContent()
  let layout: LayoutName | null = null
  const body: string[] = []
  const quote: string[] = []
  const notes: string[] = []
  let inNotes = false
  let fence = false

  for (const raw of src.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    if (inNotes) {
      notes.push(line)
      continue
    }
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    if (fence || /^\s*(```|~~~)/.test(line)) {
      body.push(line)
      continue
    }
    const lay = /^\s*<!--\s*layout\s*:\s*([\w-]+)\s*-->\s*$/i.exec(line)
    if (lay) {
      if ((LAYOUTS as readonly string[]).includes(lay[1])) layout = lay[1] as LayoutName
      continue
    }
    if (/^\s*notes?\s*:\s*$/i.test(line)) {
      inNotes = true
      continue
    }
    const inlineNote = /^\s*notes?\s*:\s*(.+)$/i.exec(line)
    if (inlineNote) {
      inNotes = true
      notes.push(inlineNote[1])
      continue
    }
    const h = /^\s*(#{1,3})\s+(.*)$/.exec(line)
    if (h && !c.title) {
      c.title = h[2].trim()
      if (h[1] === '#' && layout === null) layout = '__h1' as LayoutName
      continue
    }
    if (h && c.title && !c.subtitle && body.every((b) => b.trim() === '')) {
      c.subtitle = h[2].trim()
      continue
    }
    const img = IMG_LINE.exec(line)
    if (img) {
      const src = resolve(img[2])
      if (src) c.images.push({ src, alt: img[1] } satisfies ImageRef)
      else missing.push(img[2])
      continue
    }
    const q = /^\s*>\s?(.*)$/.exec(line)
    if (q) {
      quote.push(q[1])
      continue
    }
    body.push(line)
  }

  if (quote.length) {
    const lines = quote.filter((l) => l.trim() !== '')
    const citeIdx = lines.findIndex((l) => /^\s*(—|--|-)\s+\S/.test(l))
    const cite = citeIdx >= 0 ? lines[citeIdx].replace(/^\s*(—|--|-)\s+/, '') : ''
    const text = lines.filter((_, i) => i !== citeIdx).join(' ')
    c.quote = { text, cite }
  }

  // `# Title` followed by a single short paragraph = title slide with that paragraph as subtitle.
  let bodyText = body.join('\n').trim()
  const isH1 = (layout as string) === '__h1'
  if (isH1) layout = null
  if (
    isH1 &&
    !c.subtitle &&
    bodyText &&
    !bodyText.includes('\n') &&
    !/^\s*([-*+]|\d+\.)\s/.test(bodyText) &&
    c.images.length === 0
  ) {
    c.subtitle = bodyText
    bodyText = ''
  }
  c.body = bodyText
  if (isH1 && !layout && !c.body && c.images.length === 0 && !c.quote) layout = 'title'

  return { content: c, notes: notes.join('\n').trim(), layout }
}

const shortRef = (ref: string) => (ref.length > 60 ? `${ref.slice(0, 40)}…` : ref)

/**
 * Parse a whole Markdown document. http(s) image refs are kept; anything else is reported in
 * `missing`, with a warning per image naming its slide.
 */
export function parseMarkdown(src: string): ParsedDeck {
  const { meta, rest } = frontMatter(src.replace(/^\uFEFF/, ''))
  const missing: string[] = []
  const warnings: string[] = []
  const slides = splitSlides(rest).map((s, i) => {
    const before = missing.length
    const p = parseSlide(s, linkOnly, missing)
    for (const ref of missing.slice(before))
      warnings.push(
        `Slide ${i + 1}: ${shortRef(ref)} is not a link, use a full https link to the image`,
      )
    return p
  })
  const firstTitle = slides.find((s) => s.content.title)?.content.title
  return {
    title: meta.title || firstTitle || 'Untitled deck',
    theme: isThemeId(meta.theme) ? meta.theme : DEFAULT_THEME,
    slides,
    missing,
    warnings,
  }
}

export function parsedToDeck(p: ParsedDeck): Deck {
  const slides: Slide[] = p.slides.map((s) => makeSlide(s.content, s.notes, s.layout ?? undefined))
  return makeDeck(p.title, p.theme, slides.length ? slides : undefined)
}

/** A body line that is exactly `---` would split the slide; `***` is the same rule in Markdown. */
const safeBody = (body: string) => body.replace(/^(\s*)---\s*$/gm, '$1***')

/** The layout a slide chunk gets when parsed back without an override. */
function impliedLayout(chunk: string): LayoutName {
  const p = parseSlide(chunk)
  return p.layout ?? autoLayout(p.content)
}

/**
 * Deck → Markdown in the same format (round-trips content and layout, not hand-placed
 * positions). A `<!-- layout -->` override is written only when parsing the slide back would not
 * pick the same layout by itself.
 */
export function deckToMarkdown(
  d: Deck,
  imageRef: (src: string, i: number) => string = (s) => s,
): string {
  let n = 0
  const parts = d.slides.map((s) => {
    const c = s.content
    const lines: string[] = []
    if (c.title) lines.push(`${s.layout === 'title' ? '#' : '##'} ${c.title}`)
    if (c.subtitle) lines.push(s.layout === 'title' && c.title ? c.subtitle : `### ${c.subtitle}`)
    if (c.body) lines.push('', safeBody(c.body))
    for (const im of c.images) lines.push('', `![${im.alt}](${imageRef(im.src, n++)})`)
    if (c.quote) {
      lines.push('', `> ${c.quote.text}`)
      if (c.quote.cite) lines.push(`> — ${c.quote.cite}`)
    }
    let chunk = lines.join('\n').trim()
    // Image refs may not resolve on re-parse (they are file names), so judge with real images.
    const probe = chunk.replace(/^(\s*!\[[^\]]*\]\()[^)]*\)/gm, '$1https://x/i.png)')
    if (impliedLayout(probe) !== s.layout) chunk = `<!-- layout: ${s.layout} -->\n${chunk}`
    if (s.notes) chunk += `\n\nNote:\n${s.notes}`
    return chunk
  })
  const title = /[#"']|^\s|\s$/.test(d.title) ? JSON.stringify(d.title) : d.title
  return `---\ntitle: ${title}\ntheme: ${d.theme}\n---\n\n${parts.join('\n\n---\n\n')}\n`
}
