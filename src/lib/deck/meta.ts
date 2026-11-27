// Plain-text facts about a deck for link previews (Open Graph) and accessible labels.

import { plainText } from './render.js'
import type { Deck, Slide } from './types.js'

/** Everything a slide says, as one line of plain text (title first). */
export function slideText(s: Slide): string {
  const parts: string[] = []
  for (const e of s.elements) if (e.kind === 'text' && e.text.trim()) parts.push(plainText(e.text))
  if (!parts.length) {
    const c = s.content
    parts.push(c.title, c.subtitle, plainText(c.body), c.quote?.text ?? '')
  }
  return parts
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ')
}

/** Shorten to `max` chars on a word boundary, with an ellipsis. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`
}

/** Link-preview description: slide count + the first slide's text. */
export function deckDescription(d: Deck, max = 200): string {
  const n = d.slides.length
  const count = `${n} slide${n === 1 ? '' : 's'}`
  const first = d.slides[0] ? slideText(d.slides[0]) : ''
  return truncate(first ? `${count} — ${first}` : count, max)
}
