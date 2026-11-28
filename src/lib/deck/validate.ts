// Untrusted input → Deck. Used by the server before storing a published deck and by the client
// when it loads a shared deck or an imported JSON file. Rejects instead of guessing: a malformed
// deck is an error, not something to half-render.
//
// Images are links (ADR 0002): new content only takes http(s) URLs. Decks made before that can
// still hold embedded `data:` images; the browser keeps showing them (`allowDataImages` on the
// local paths: JSON import, backup restore, copying a shared deck), the server refuses them.

import { isThemeId } from '../themes.js'
import {
  COLOR_TOKENS,
  DECK_VERSION,
  LAYOUTS,
  TEXT_SIZES,
  type Deck,
  type Slide,
  type SlideContent,
  type SlideElement,
} from './types.js'

export class DeckError extends Error {}

const MAX_SLIDES = 200
const MAX_ELEMENTS = 60
const MAX_TEXT = 20_000

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function str(v: unknown, path: string, max = MAX_TEXT): string {
  if (typeof v !== 'string') throw new DeckError(`${path}: expected string`)
  if (v.length > max) throw new DeckError(`${path}: too long`)
  return v
}

function num(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new DeckError(`${path}: expected number`)
  return Math.max(-5000, Math.min(5000, v))
}

function oneOf<T extends string>(v: unknown, list: readonly T[], path: string): T {
  if (!list.includes(v as T)) throw new DeckError(`${path}: invalid value`)
  return v as T
}

export interface ValidateOptions {
  /**
   * Accept embedded raster `data:` images (legacy decks, before images became links). Only the
   * browser's local paths pass true; the server never does.
   */
  allowDataImages?: boolean
}

/** Longest image link accepted. */
export const MAX_IMAGE_URL = 4096

const DATA_IMAGE = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i
const HTTP_IMAGE = /^https?:\/\/[^\s"'<>]+$/i

/** Why the server refuses a deck that still embeds an uploaded image. */
export const DATA_IMAGE_MESSAGE =
  'Uploaded images are not accepted any more: replace it with an https:// image link.'

function dataImageError(path: string): DeckError {
  const n = /slides\[(\d+)\]/.exec(path)
  const where = n ? `Slide ${Number(n[1]) + 1}` : 'This deck'
  return new DeckError(`${where} has an uploaded image. ${DATA_IMAGE_MESSAGE}`)
}

/**
 * Images: http(s) URLs, plus (legacy, `allowDataImages`) inline raster data URLs. Never
 * javascript:, never SVG data (scriptable).
 */
export function safeImageSrc(v: unknown, path: string, opts: ValidateOptions = {}): string {
  const s = str(v, path, opts.allowDataImages ? 12_000_000 : MAX_IMAGE_URL)
  if (HTTP_IMAGE.test(s)) return s
  if (/^data:/i.test(s)) {
    if (!opts.allowDataImages) throw dataImageError(path)
    if (DATA_IMAGE.test(s)) return s
  }
  throw new DeckError(`${path}: unsupported image source`)
}

function content(v: unknown, p: string, o: ValidateOptions): SlideContent {
  if (!isObj(v)) throw new DeckError(`${p}: expected object`)
  const images = Array.isArray(v.images) ? v.images : []
  const q = v.quote
  return {
    title: str(v.title ?? '', `${p}.title`),
    subtitle: str(v.subtitle ?? '', `${p}.subtitle`),
    body: str(v.body ?? '', `${p}.body`),
    images: images.slice(0, 12).map((im, i) => {
      if (!isObj(im)) throw new DeckError(`${p}.images[${i}]: expected object`)
      return {
        src: safeImageSrc(im.src, `${p}.images[${i}].src`, o),
        alt: str(im.alt ?? '', `${p}.images[${i}].alt`, 500),
      }
    }),
    quote: isObj(q)
      ? {
          text: str(q.text ?? '', `${p}.quote.text`),
          cite: str(q.cite ?? '', `${p}.quote.cite`, 500),
        }
      : null,
  }
}

function element(v: unknown, p: string, o: ValidateOptions): SlideElement {
  if (!isObj(v)) throw new DeckError(`${p}: expected object`)
  const base = {
    id: str(v.id, `${p}.id`, 64),
    x: num(v.x, `${p}.x`),
    y: num(v.y, `${p}.y`),
    w: Math.max(1, num(v.w, `${p}.w`)),
    h: Math.max(1, num(v.h, `${p}.h`)),
  }
  switch (v.kind) {
    case 'text':
      return {
        ...base,
        kind: 'text',
        role: oneOf(
          v.role,
          ['title', 'subtitle', 'body', 'caption', 'quote', 'cite', 'free'],
          `${p}.role`,
        ),
        text: str(v.text, `${p}.text`),
        size: oneOf(v.size, TEXT_SIZES, `${p}.size`),
        align: oneOf(v.align, ['start', 'center', 'end'], `${p}.align`),
        valign: oneOf(v.valign, ['top', 'middle', 'bottom'], `${p}.valign`),
        color: oneOf(v.color, COLOR_TOKENS, `${p}.color`),
        font: oneOf(v.font, ['display', 'body', 'mono'], `${p}.font`),
        ...(v.bold === true && { bold: true }),
        ...(v.italic === true && { italic: true }),
      }
    case 'image':
      return {
        ...base,
        kind: 'image',
        src: safeImageSrc(v.src, `${p}.src`, o),
        alt: str(v.alt ?? '', `${p}.alt`, 500),
        fit: oneOf(v.fit, ['cover', 'contain'], `${p}.fit`),
      }
    case 'shape':
      return {
        ...base,
        kind: 'shape',
        shape: oneOf(v.shape, ['rect', 'ellipse', 'line'], `${p}.shape`),
        fill: oneOf(v.fill, [...COLOR_TOKENS, 'none'] as const, `${p}.fill`),
        stroke: oneOf(v.stroke, [...COLOR_TOKENS, 'none'] as const, `${p}.stroke`),
      }
    default:
      throw new DeckError(`${p}.kind: invalid value`)
  }
}

function slide(v: unknown, p: string, o: ValidateOptions): Slide {
  if (!isObj(v)) throw new DeckError(`${p}: expected object`)
  if (!Array.isArray(v.elements)) throw new DeckError(`${p}.elements: expected array`)
  if (v.elements.length > MAX_ELEMENTS) throw new DeckError(`${p}.elements: too many`)
  return {
    id: str(v.id, `${p}.id`, 64),
    layout: oneOf(v.layout, LAYOUTS, `${p}.layout`),
    manual: v.manual === true,
    content: content(v.content, `${p}.content`, o),
    elements: v.elements.map((e, i) => element(e, `${p}.elements[${i}]`, o)),
    notes: str(v.notes ?? '', `${p}.notes`),
    background: oneOf(v.background ?? 'bg', ['bg', 'surface', 'accent'], `${p}.background`),
  }
}

/**
 * Untrusted JSON → Deck. Strict by default (what the server stores: image links only); the
 * browser passes `{ allowDataImages: true }` to keep loading legacy decks with embedded images.
 */
export function validateDeck(v: unknown, opts: ValidateOptions = {}): Deck {
  if (!isObj(v)) throw new DeckError('deck: expected object')
  if (v.v !== DECK_VERSION) throw new DeckError('deck.v: unsupported version')
  if (!Array.isArray(v.slides) || v.slides.length === 0)
    throw new DeckError('deck.slides: expected a non-empty array')
  if (v.slides.length > MAX_SLIDES) throw new DeckError('deck.slides: too many')
  if (!isThemeId(v.theme)) throw new DeckError('deck.theme: invalid value')
  return {
    v: DECK_VERSION,
    id: str(v.id, 'deck.id', 64),
    title: str(v.title, 'deck.title', 300),
    theme: v.theme,
    slides: v.slides.map((s, i) => slide(s, `deck.slides[${i}]`, opts)),
    createdAt: str(v.createdAt, 'deck.createdAt', 40),
    updatedAt: str(v.updatedAt, 'deck.updatedAt', 40),
  }
}
