// Constructors and deck-level operations shared by every surface.

import { nanoid } from 'nanoid'
import { DEFAULT_THEME, type ThemeId } from '../themes.js'
import { autoLayout, layoutElements } from './layout.js'
import { DECK_VERSION, emptyContent, type Deck, type Slide, type SlideContent } from './types.js'

export const newId = (n = 10) => nanoid(n)

export function makeSlide(
  content: Partial<SlideContent> = {},
  notes = '',
  layout?: Slide['layout'],
): Slide {
  const id = newId(8)
  const c = { ...emptyContent(), ...content }
  const l = layout ?? autoLayout(c)
  return {
    id,
    layout: l,
    manual: false,
    content: c,
    elements: layoutElements(id, l, c),
    notes,
    background: l === 'section' ? 'surface' : 'bg',
  }
}

export function makeDeck(
  title = 'Untitled deck',
  theme: ThemeId = DEFAULT_THEME,
  slides?: Slide[],
): Deck {
  const now = new Date().toISOString()
  return {
    v: DECK_VERSION,
    id: newId(),
    title,
    theme,
    slides: slides ?? [makeSlide({ title, subtitle: '' }, '', 'title')],
    createdAt: now,
    updatedAt: now,
  }
}

/** Deep copy with fresh ids — for "duplicate slide" and "make a copy of a shared deck". */
export function cloneSlide(s: Slide): Slide {
  const id = newId(8)
  return {
    ...structuredClone(s),
    id,
    elements: s.elements.map((e) => ({ ...structuredClone(e), id: e.id.replace(s.id, id) })),
  }
}

export interface PublicDeckOptions {
  /** Keep speaker notes in the copy (default: strip them, they are the presenter's). */
  notes?: boolean
}

/**
 * The copy of a deck that may leave this browser: private fields (`share` with its edit token,
 * `publishNotes`) are dropped, and speaker notes are emptied unless `notes` is true.
 */
export function publicDeck(d: Deck, { notes = false }: PublicDeckOptions = {}): Deck {
  const { share: _share, publishNotes: _notes, ...rest } = d
  const out = structuredClone(rest)
  if (!notes) out.slides = out.slides.map((s) => ({ ...s, notes: '' }))
  return out
}

/**
 * "Make a copy" of someone's shared deck: a new local deck with a fresh id and no share info,
 * so publishing it creates a new link instead of touching the original.
 */
export function copyDeck(d: Deck, now = new Date()): Deck {
  const { share: _share, publishNotes: _notes, ...rest } = structuredClone(d)
  const ts = now.toISOString()
  return { ...rest, id: newId(), createdAt: ts, updatedAt: ts }
}
