// Quick create: "a title, some text and a few images per slide" → slides. Pure.
//
// Two inputs feed it:
//  - blocks (the form: one block per slide, each with a title, a text box and dropped images);
//  - one big text box, split into blocks on `---` lines by `splitQuickText`.
//
// Each block's text goes through the same slide parser as the Markdown format, so `- bullets`,
// `**bold**`, `> quotes` and `Note:` speaker notes all work in the text box too.

import { DEFAULT_THEME, type ThemeId } from '../themes.js'
import { makeDeck, makeSlide } from './factory.js'
import { parseSlide, splitSlides } from './markdown.js'
import type { Deck, ImageRef, Slide } from './types.js'

export interface QuickBlock {
  title: string
  text: string
  images: ImageRef[]
}

/**
 * The one-big-text-box rule — the same split as the Markdown format:
 *
 * - Slides are separated by a line that is only `---` (outside code fences). Blank lines inside
 *   a slide are just paragraph breaks; leading / trailing `---` lines make no empty slides.
 * - In each slide the **first line is the title** (leading `#`s are dropped), the rest is the text
 *   — unless the slide starts with a `>` quote, a list item or an image: then it is all text.
 */
export function splitQuickText(src: string): QuickBlock[] {
  return splitSlides(src.replace(/\r\n?/g, '\n'))
    .map((c) => c.replace(/^\s*\n/, '').trimEnd())
    .map((c) => {
      // A slide that opens with a quote, list, image or layout comment has no title line.
      if (/^\s*(>|!\[|[-*+]\s|\d+\.\s|<!--)/.test(c))
        return { title: '', text: c.trim(), images: [] }
      const [first, ...rest] = c.split('\n')
      return {
        title: first.trim().replace(/^#{1,6}\s+/, ''),
        text: rest.join('\n').trim(),
        images: [],
      }
    })
}

/**
 * One block → one slide. The first block is the cover: a title with a single short line of text
 * becomes a title slide (title + subtitle), exactly like `# Title` + one line in Markdown.
 */
export function blockToSlide(b: QuickBlock, index = 0): Slide {
  const title = b.title.trim().replace(/\n+/g, ' ')
  const head = title ? `${index === 0 ? '#' : '##'} ${title}\n` : ''
  const parsed = parseSlide(head + b.text)
  const content = { ...parsed.content, images: [...parsed.content.images, ...b.images] }
  // `title` was inferred from "# + one line"; images change what fits best.
  const layout = parsed.layout === 'title' && content.images.length ? undefined : parsed.layout
  return makeSlide(content, parsed.notes, layout ?? undefined)
}

export const isEmptyBlock = (b: QuickBlock) =>
  !b.title.trim() && !b.text.trim() && b.images.length === 0

export function blocksToSlides(blocks: QuickBlock[]): Slide[] {
  return blocks.filter((b) => !isEmptyBlock(b)).map((b, i) => blockToSlide(b, i))
}

/** The deck quick create saves. An empty form still yields a one-slide deck. */
export function quickDeck(title: string, theme: ThemeId, blocks: QuickBlock[]): Deck {
  const slides = blocksToSlides(blocks)
  const name = title.trim() || slides.find((s) => s.content.title)?.content.title || 'Untitled deck'
  return makeDeck(name, theme ?? DEFAULT_THEME, slides.length ? slides : undefined)
}
