// Deck ↔ files: the Markdown bundle (deck.md + images/…) and the JSON export. Pure.

import { newId, publicDeck } from './factory.js'
import { deckToMarkdown } from './markdown.js'
import type { Deck } from './types.js'
import { validateDeck } from './validate.js'
import { dataUrlToBytes, type ZipEntry } from './zip.js'

const EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

export const MIME_BY_EXT: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  avif: 'image/avif',
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'deck'

/**
 * Deck → `deck.md` + one file per embedded (data: URL) image, named `images/slide-N-M.ext`
 * (N = slide number, M = image number on that slide, both 1-based). The same image used twice is
 * written once. http(s) images stay links.
 */
export function deckToBundle(deck: Deck): ZipEntry[] {
  const names = new Map<string, string>()
  const files: ZipEntry[] = []
  deck.slides.forEach((s, si) =>
    s.content.images.forEach((im, ii) => {
      if (names.has(im.src)) return
      const bin = dataUrlToBytes(im.src)
      if (!bin) return
      const name = `images/slide-${si + 1}-${ii + 1}.${EXT[bin.mime] ?? 'bin'}`
      names.set(im.src, name)
      files.push({ name, data: bin.data })
    }),
  )
  const md = deckToMarkdown(deck, (src) => names.get(src) ?? src)
  return [{ name: 'deck.md', data: new TextEncoder().encode(md) }, ...files]
}

/** JSON export (the owner's own backup): the deck minus private share data, notes kept. */
export const deckToJson = (deck: Deck) => JSON.stringify(publicDeck(deck, { notes: true }))

/**
 * An exported `.slidessoca.json` (untrusted) → a new local deck: validated, fresh id, fresh
 * timestamps, no share info. Throws `DeckError` / `SyntaxError` with a readable message.
 */
export function importDeckJson(text: string): Deck {
  const deck = validateDeck(JSON.parse(text))
  const now = new Date().toISOString()
  return { ...deck, id: newId(), createdAt: now, updatedAt: now }
}
