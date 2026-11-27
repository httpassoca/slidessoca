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
//   ![alt](photo.jpg)         images on their own line; local names resolve to uploaded files
//
//   Note:                     everything after a Note:/Notes: line = speaker notes
//   say this out loud
//
//   <!-- layout: image-left -->   optional override; otherwise the layout is picked from content
//
// Pure: image file names are resolved through the `assets` map the caller provides.

import { isThemeId, DEFAULT_THEME, type ThemeId } from '../themes.js'
import { makeDeck, makeSlide } from './factory.js'
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
  /** Image references that could not be resolved (missing uploads). */
  missing: string[]
}

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function frontMatter(src: string): { meta: Record<string, string>; rest: string } {
  const m = FRONT.exec(src)
  if (!m) return { meta: {}, rest: src }
  const meta: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/.exec(line)
    if (kv) meta[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, '')
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
  resolve: (ref: string) => string | null = (r) => r,
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

/** Basename, lower-cased, without a leading ./ — how markdown refs match uploaded files. */
export function assetKey(ref: string): string {
  const clean = decodeURIComponent(ref.split(/[?#]/)[0]).replace(/^\.\//, '')
  return (clean.split('/').pop() ?? clean).toLowerCase()
}

/**
 * Parse a whole Markdown document. `assets` maps uploaded image file names (any case/path) to
 * data URLs; http(s) refs pass through; anything else is reported in `missing`.
 */
export function parseMarkdown(src: string, assets: Record<string, string> = {}): ParsedDeck {
  const { meta, rest } = frontMatter(src.replace(/^\uFEFF/, ''))
  const byKey = new Map(Object.entries(assets).map(([k, v]) => [assetKey(k), v]))
  const missing: string[] = []
  const resolve = (ref: string) => {
    if (/^https?:\/\//i.test(ref)) return ref
    if (/^data:image\//i.test(ref)) return ref
    return byKey.get(assetKey(ref)) ?? null
  }
  const slides = splitSlides(rest).map((s) => parseSlide(s, resolve, missing))
  const firstTitle = slides.find((s) => s.content.title)?.content.title
  return {
    title: meta.title || firstTitle || 'Untitled deck',
    theme: isThemeId(meta.theme) ? meta.theme : DEFAULT_THEME,
    slides,
    missing,
  }
}

export function parsedToDeck(p: ParsedDeck): Deck {
  const slides: Slide[] = p.slides.map((s) => makeSlide(s.content, s.notes, s.layout ?? undefined))
  return makeDeck(p.title, p.theme, slides.length ? slides : undefined)
}

/** Deck → Markdown in the same format (round-trips content, not hand-placed positions). */
export function deckToMarkdown(
  d: Deck,
  imageRef: (src: string, i: number) => string = (s) => s,
): string {
  let n = 0
  const parts = d.slides.map((s) => {
    const c = s.content
    const lines: string[] = []
    if (s.layout !== 'title' && s.layout !== 'section' && s.layout !== 'bullets')
      lines.push(`<!-- layout: ${s.layout} -->`)
    if (c.title) lines.push(`${s.layout === 'title' ? '#' : '##'} ${c.title}`)
    if (c.subtitle) lines.push(s.layout === 'title' ? c.subtitle : `### ${c.subtitle}`)
    if (c.body) lines.push('', c.body)
    for (const im of c.images) lines.push('', `![${im.alt}](${imageRef(im.src, n++)})`)
    if (c.quote) {
      lines.push('', `> ${c.quote.text}`)
      if (c.quote.cite) lines.push(`> — ${c.quote.cite}`)
    }
    if (s.notes) lines.push('', 'Note:', s.notes)
    return lines.join('\n').trim()
  })
  return `---\ntitle: ${d.title}\ntheme: ${d.theme}\n---\n\n${parts.join('\n\n---\n\n')}\n`
}
