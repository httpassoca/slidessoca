// Ready-made example decks (SL-0012). Each one is a Markdown file in the repo's own format,
// parsed at runtime, so the examples dogfood docs/markdown-format.md. Images are links to
// Wikimedia Commons (free licences); credits sit on each deck's last slide.

import { parseMarkdown, parsedToDeck } from '../deck/markdown.js'
import type { Deck } from '../deck/types.js'
import type { ThemeId } from '../themes.js'
import stalker from './stalker.md?raw'
import firstBug from './first-bug.md?raw'
import democracy from './democracy.md?raw'
import miracles from './miracles.md?raw'

export interface Example {
  slug: string
  title: string
  /** One line for the cards. */
  blurb: string
  theme: ThemeId
  md: string
}

const make = (slug: string, blurb: string, md: string): Example => {
  const p = parseMarkdown(md)
  return { slug, title: p.title, blurb, theme: p.theme, md }
}

export const EXAMPLES: readonly Example[] = [
  make('stalker', 'Tarkovsky’s Zone, the Room and the shoot in Estonia', stalker),
  make('first-bug', 'A moth in relay #70, and where the word came from', firstBug),
  make('democracy', 'From Plato to 1933, and why democracies also survive', democracy),
  make('miracles', 'Gospel wonders in paint, relics, and what science says', miracles),
]

/** Deck ids of examples: never a nanoid (those are 10 chars of [A-Za-z0-9_-] without a colon). */
export const EXAMPLE_PREFIX = 'example:'

export function exampleBySlug(slug: string): Example | undefined {
  return EXAMPLES.find((e) => e.slug === slug)
}

/** The example as a deck, with a stable id (`example:<slug>`) so the presenter can find it. */
export function exampleDeck(e: Example): Deck {
  const d = parsedToDeck(parseMarkdown(e.md))
  return { ...d, id: `${EXAMPLE_PREFIX}${e.slug}` }
}

/** `example:<slug>` → that example's deck (the presenter's fallback), else undefined. */
export function exampleDeckById(id: string): Deck | undefined {
  if (!id.startsWith(EXAMPLE_PREFIX)) return undefined
  const e = exampleBySlug(id.slice(EXAMPLE_PREFIX.length))
  return e ? exampleDeck(e) : undefined
}
