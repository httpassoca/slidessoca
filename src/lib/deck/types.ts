// The deck model. Everything the editor, the viewer, the Markdown importer and the server
// exchange is a `Deck`. Pure types + tiny constructors — no DOM, no Svelte (see CLAUDE.md).

import type { ThemeId } from '../themes.js'

/** Logical canvas size. Every element is positioned in these units and the renderer scales. */
export const CANVAS_W = 1600
export const CANVAS_H = 900

export const DECK_VERSION = 1

/** Palette roles an element can be coloured with. They map to dssoca `--ss-*` tokens. */
export const COLOR_TOKENS = [
  'fg',
  'muted',
  'accent',
  'bg',
  'surface',
  'success',
  'warning',
  'danger',
  'info',
] as const
export type ColorToken = (typeof COLOR_TOKENS)[number]

export const TEXT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const
export type TextSize = (typeof TEXT_SIZES)[number]

/** Canvas px per text size (before auto-fit shrinks an overflowing box). */
export const TEXT_SIZE_PX: Record<TextSize, number> = {
  xs: 24,
  sm: 30,
  md: 38,
  lg: 52,
  xl: 76,
  xxl: 112,
}

export type TextRole = 'title' | 'subtitle' | 'body' | 'caption' | 'quote' | 'cite' | 'free'
export type Align = 'start' | 'center' | 'end'
export type VAlign = 'top' | 'middle' | 'bottom'
export type FontRole = 'display' | 'body' | 'mono'

interface ElementBase {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface TextElement extends ElementBase {
  kind: 'text'
  role: TextRole
  /** Markdown (inline + lists + emphasis). Rendered sanitised. */
  text: string
  size: TextSize
  align: Align
  valign: VAlign
  color: ColorToken
  font: FontRole
  bold?: boolean
  italic?: boolean
}

export interface ImageElement extends ElementBase {
  kind: 'image'
  /** data: URL (uploaded, compressed client-side) or an https URL. */
  src: string
  alt: string
  fit: 'cover' | 'contain'
}

export interface ShapeElement extends ElementBase {
  kind: 'shape'
  shape: 'rect' | 'ellipse' | 'line'
  fill: ColorToken | 'none'
  stroke: ColorToken | 'none'
}

export type SlideElement = TextElement | ImageElement | ShapeElement

export interface ImageRef {
  src: string
  alt: string
}

/**
 * What a slide *says*, independent of where things sit. The layout engine turns this into
 * elements. Markdown import and the simple "quick create" form only ever produce content.
 */
export interface SlideContent {
  title: string
  subtitle: string
  /** Markdown body: paragraphs, bullet / numbered lists. */
  body: string
  images: ImageRef[]
  quote: { text: string; cite: string } | null
}

export const LAYOUTS = [
  'title',
  'section',
  'bullets',
  'image-right',
  'image-left',
  'image-full',
  'gallery',
  'quote',
  'blank',
] as const
export type LayoutName = (typeof LAYOUTS)[number]

export type SlideBackground = 'bg' | 'surface' | 'accent'

export interface Slide {
  id: string
  layout: LayoutName
  /** true once the user moved/resized/added elements by hand: content edits stop re-laying out. */
  manual: boolean
  content: SlideContent
  elements: SlideElement[]
  notes: string
  background: SlideBackground
}

export interface ShareInfo {
  /** Public id in /s/<id>. */
  id: string
  /** Secret that lets this browser update/delete the shared copy. Never sent to viewers. */
  token: string
  expiresAt: string
  publishedAt: string
}

export interface Deck {
  v: typeof DECK_VERSION
  id: string
  title: string
  theme: ThemeId
  slides: Slide[]
  createdAt: string
  updatedAt: string
  share?: ShareInfo
}

export function emptyContent(): SlideContent {
  return { title: '', subtitle: '', body: '', images: [], quote: null }
}
