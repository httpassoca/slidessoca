// Editor state operations. PURE: every function takes data and returns new data (no mutation,
// no DOM), so the editor's behaviour is unit-tested without a browser. The Svelte components only
// translate pointer/keyboard events into calls to these.

import { cloneSlide, makeSlide, newId } from './factory.js'
import { relayout } from './layout.js'
import {
  CANVAS_H,
  CANVAS_W,
  type Deck,
  type ImageElement,
  type LayoutName,
  type ShapeElement,
  type Slide,
  type SlideContent,
  type SlideElement,
  type TextElement,
  type TextRole,
} from './types.js'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Smallest element edge (canvas units). */
export const MIN_SIZE = 16
/** How much of an element must stay on the canvas when it is dragged off an edge. */
export const KEEP_VISIBLE = 24
/** Snap distance in canvas units. */
export const SNAP = 10

const round = (v: number) => Math.round(v)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// ---------------------------------------------------------------- geometry

/** Move a box, keeping at least KEEP_VISIBLE units of it on the canvas. */
export function moveBox(b: Box, dx: number, dy: number): Box {
  return {
    ...b,
    x: round(clamp(b.x + dx, KEEP_VISIBLE - b.w, CANVAS_W - KEEP_VISIBLE)),
    y: round(clamp(b.y + dy, KEEP_VISIBLE - b.h, CANVAS_H - KEEP_VISIBLE)),
  }
}

export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
export type Handle = (typeof HANDLES)[number]

/**
 * Resize a box by dragging one of its 8 handles by (dx, dy). The opposite edge stays put and the
 * box never goes below MIN_SIZE. `keepRatio` locks the aspect ratio (corner handles only).
 */
export function resizeBox(b: Box, handle: Handle, dx: number, dy: number, keepRatio = false): Box {
  let { x, y, w, h } = b
  const right = x + w
  const bottom = y + h
  if (handle.includes('e')) w = Math.max(MIN_SIZE, w + dx)
  if (handle.includes('w')) {
    w = Math.max(MIN_SIZE, w - dx)
    x = right - w
  }
  if (handle.includes('s')) h = Math.max(MIN_SIZE, h + dy)
  if (handle.includes('n')) {
    h = Math.max(MIN_SIZE, h - dy)
    y = bottom - h
  }
  if (keepRatio && handle.length === 2 && b.w > 0 && b.h > 0) {
    const ratio = b.w / b.h
    if (w / h > ratio) h = w / ratio
    else w = h * ratio
    if (handle.includes('w')) x = right - w
    if (handle.includes('n')) y = bottom - h
  }
  return { x: round(x), y: round(y), w: round(w), h: round(h) }
}

export interface SnapTargets {
  xs: number[]
  ys: number[]
}

/** Lines an element can snap to: canvas edges + centre, and every other element's edges + centre. */
export function snapTargets(slide: Slide, excludeId: string | null): SnapTargets {
  const xs = [0, CANVAS_W / 2, CANVAS_W]
  const ys = [0, CANVAS_H / 2, CANVAS_H]
  for (const e of slide.elements) {
    if (e.id === excludeId) continue
    xs.push(e.x, e.x + e.w / 2, e.x + e.w)
    ys.push(e.y, e.y + e.h / 2, e.y + e.h)
  }
  return { xs, ys }
}

export interface Guides {
  /** Vertical guide lines (x positions). */
  v: number[]
  /** Horizontal guide lines (y positions). */
  h: number[]
}

function nearest(points: number[], targets: number[], threshold: number) {
  let best: { delta: number; at: number } | null = null
  for (const p of points)
    for (const t of targets) {
      const d = t - p
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta)))
        best = { delta: d, at: t }
    }
  return best
}

/** Snap a moving box: its left/centre/right and top/middle/bottom lines snap to the targets. */
export function snapMove(b: Box, t: SnapTargets, threshold = SNAP): { box: Box; guides: Guides } {
  const sx = nearest([b.x, b.x + b.w / 2, b.x + b.w], t.xs, threshold)
  const sy = nearest([b.y, b.y + b.h / 2, b.y + b.h], t.ys, threshold)
  return {
    box: { ...b, x: round(b.x + (sx?.delta ?? 0)), y: round(b.y + (sy?.delta ?? 0)) },
    guides: { v: sx ? [sx.at] : [], h: sy ? [sy.at] : [] },
  }
}

/** Snap a box being resized: only the edges the handle moves snap. */
export function snapResize(
  b: Box,
  handle: Handle,
  t: SnapTargets,
  threshold = SNAP,
): { box: Box; guides: Guides } {
  let { x, y, w, h } = b
  const v: number[] = []
  const hz: number[] = []
  if (handle.includes('e')) {
    const s = nearest([x + w], t.xs, threshold)
    if (s && w + s.delta >= MIN_SIZE) {
      w += s.delta
      v.push(s.at)
    }
  } else if (handle.includes('w')) {
    const s = nearest([x], t.xs, threshold)
    if (s && w - s.delta >= MIN_SIZE) {
      x += s.delta
      w -= s.delta
      v.push(s.at)
    }
  }
  if (handle.includes('s')) {
    const s = nearest([y + h], t.ys, threshold)
    if (s && h + s.delta >= MIN_SIZE) {
      h += s.delta
      hz.push(s.at)
    }
  } else if (handle.includes('n')) {
    const s = nearest([y], t.ys, threshold)
    if (s && h - s.delta >= MIN_SIZE) {
      y += s.delta
      h -= s.delta
      hz.push(s.at)
    }
  }
  return { box: { x: round(x), y: round(y), w: round(w), h: round(h) }, guides: { v, h: hz } }
}

// ---------------------------------------------------------------- elements on a slide

export function getElement(slide: Slide, id: string | null): SlideElement | undefined {
  return id ? slide.elements.find((e) => e.id === id) : undefined
}

const GEOMETRY = ['x', 'y', 'w', 'h'] as const

/**
 * Patch an element. Changing its geometry makes the slide manual (invariant 2); style changes
 * (size, colour, fit…) do not, but they are lost if the layout is re-applied.
 */
export function updateElement(slide: Slide, id: string, patch: Partial<SlideElement>): Slide {
  const moved = GEOMETRY.some((k) => k in patch)
  return {
    ...slide,
    manual: slide.manual || moved,
    elements: slide.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as SlideElement) : e)),
  }
}

export function setBox(slide: Slide, id: string, box: Box): Slide {
  const e = getElement(slide, id)
  if (!e || (e.x === box.x && e.y === box.y && e.w === box.w && e.h === box.h)) return slide
  return updateElement(slide, id, box)
}

/** Arrow-key nudge. */
export function nudge(slide: Slide, id: string, dx: number, dy: number): Slide {
  const e = getElement(slide, id)
  return e ? setBox(slide, id, moveBox(e, dx, dy)) : slide
}

export function insertElement(slide: Slide, el: SlideElement): Slide {
  return { ...slide, manual: true, elements: [...slide.elements, el] }
}

export function deleteElement(slide: Slide, id: string): Slide {
  if (!getElement(slide, id)) return slide
  return { ...slide, manual: true, elements: slide.elements.filter((e) => e.id !== id) }
}

export type ZMove = 'forward' | 'backward' | 'front' | 'back'

/** Change paint order (later in `elements` = on top). */
export function reorderElement(slide: Slide, id: string, move: ZMove): Slide {
  const i = slide.elements.findIndex((e) => e.id === id)
  if (i < 0) return slide
  const last = slide.elements.length - 1
  const to =
    move === 'front'
      ? last
      : move === 'back'
        ? 0
        : move === 'forward'
          ? Math.min(last, i + 1)
          : Math.max(0, i - 1)
  if (to === i) return slide
  const els = [...slide.elements]
  const [e] = els.splice(i, 1)
  els.splice(to, 0, e)
  return { ...slide, manual: true, elements: els }
}

/** Element ids are unique within a slide; prefixing with the slide id keeps cloneSlide working. */
const elId = (slide: Slide, kind: string) => `${slide.id}-${kind}-${newId(5)}`

/** A centred box of the given size, offset a little for each element already there. */
function placed(slide: Slide, w: number, h: number): Box {
  const k = (slide.elements.length % 6) * 24
  return { x: round((CANVAS_W - w) / 2 + k), y: round((CANVAS_H - h) / 2 + k), w, h }
}

export function newTextBox(slide: Slide, text = 'Text'): TextElement {
  return {
    id: elId(slide, 'text'),
    kind: 'text',
    role: 'free',
    text,
    size: 'md',
    align: 'start',
    valign: 'top',
    color: 'fg',
    font: 'body',
    ...placed(slide, 600, 120),
  }
}

export function newShape(slide: Slide, shape: ShapeElement['shape']): ShapeElement {
  const box = shape === 'line' ? placed(slide, 400, 16) : placed(slide, 320, 320)
  return {
    id: elId(slide, 'shape'),
    kind: 'shape',
    shape,
    fill: shape === 'line' ? 'none' : 'accent',
    stroke: shape === 'line' ? 'fg' : 'none',
    ...box,
  }
}

/** An image element sized to its natural aspect ratio, fitting within 60% of the canvas. */
export function newImage(
  slide: Slide,
  src: string,
  alt = '',
  natural?: { w: number; h: number },
): ImageElement {
  const maxW = CANVAS_W * 0.6
  const maxH = CANVAS_H * 0.6
  let w = maxW
  let h = maxH
  if (natural && natural.w > 0 && natural.h > 0) {
    const k = Math.min(maxW / natural.w, maxH / natural.h)
    w = natural.w * k
    h = natural.h * k
  }
  return {
    id: elId(slide, 'img'),
    kind: 'image',
    src,
    alt,
    fit: 'contain',
    ...placed(slide, round(w), round(h)),
  }
}

// ---------------------------------------------------------------- text ↔ content

const ROLE_FIELDS: TextRole[] = ['title', 'subtitle', 'body', 'caption', 'quote', 'cite']

/** Is this a text element whose text comes from the slide's `content`? */
export const isRoleElement = (e: SlideElement): e is TextElement =>
  e.kind === 'text' && ROLE_FIELDS.includes(e.role)

/** Write an edited role element's text back into the slide content. */
export function contentFromText(slide: Slide, role: TextRole, text: string): SlideContent {
  const c = slide.content
  switch (role) {
    case 'title':
    case 'subtitle':
    case 'body':
      return { ...c, [role]: text }
    case 'caption': {
      // layout renders `**title** — subtitle` (or just the title).
      const m = /^\*\*(.+?)\*\*\s+—\s+([\s\S]*)$/.exec(text)
      return m ? { ...c, title: m[1], subtitle: m[2] } : { ...c, title: text, subtitle: '' }
    }
    case 'quote': {
      const q = text
        .trim()
        .replace(/^[“"]\s*/, '')
        .replace(/\s*[”"]$/, '')
      if (c.quote) return { ...c, quote: { ...c.quote, text: q } }
      // The quote layout falls back to body (or title) when there is no explicit quote.
      return c.body.trim() ? { ...c, body: q } : { ...c, title: q }
    }
    case 'cite': {
      const cite = text.trim().replace(/^—\s*/, '')
      return { ...c, quote: { text: c.quote?.text ?? '', cite } }
    }
    default:
      return c
  }
}

/**
 * Inline text edit. Role elements write back to `content` (so exports stay right); on an auto
 * slide that re-lays it out and it stays auto. Free text boxes and manual slides just change the
 * element's text.
 */
export function updateText(slide: Slide, id: string, text: string): Slide {
  const e = getElement(slide, id)
  if (!e || e.kind !== 'text' || e.text === text) return slide
  const withText: Slide = {
    ...slide,
    elements: slide.elements.map((x) => (x.id === id ? { ...x, text } : x)),
  }
  if (!isRoleElement(e)) return withText
  const content = contentFromText(slide, e.role, text)
  if (slide.manual) return { ...withText, content }
  return relayout({ ...slide, content })
}

/** The content form: patch content; an auto slide re-lays out. */
export function setContent(slide: Slide, patch: Partial<SlideContent>): Slide {
  const next = { ...slide, content: { ...slide.content, ...patch } }
  return slide.manual ? next : relayout(next)
}

export function setLayout(slide: Slide, layout: LayoutName): Slide {
  return relayout(slide, layout)
}

// ---------------------------------------------------------------- slides in a deck

export function updateSlide(deck: Deck, index: number, fn: (s: Slide) => Slide): Deck {
  const s = deck.slides[index]
  if (!s) return deck
  const next = fn(s)
  if (next === s) return deck
  const slides = [...deck.slides]
  slides[index] = next
  return { ...deck, slides }
}

/** Move slide `from` to position `to`. */
export function moveSlide(deck: Deck, from: number, to: number): Deck {
  const n = deck.slides.length
  if (from < 0 || from >= n) return deck
  to = clamp(to, 0, n - 1)
  if (from === to) return deck
  const slides = [...deck.slides]
  const [s] = slides.splice(from, 1)
  slides.splice(to, 0, s)
  return { ...deck, slides }
}

export function insertSlide(deck: Deck, at: number, slide: Slide): Deck {
  const slides = [...deck.slides]
  slides.splice(clamp(at, 0, slides.length), 0, slide)
  return { ...deck, slides }
}

/** A new, empty-ish slide for the chosen layout (placeholder text so it is visible). */
export function blankSlide(layout: LayoutName): Slide {
  const content: Partial<SlideContent> =
    layout === 'blank'
      ? {}
      : layout === 'quote'
        ? { quote: { text: 'Quote', cite: 'Someone' } }
        : layout === 'title'
          ? { title: 'Title', subtitle: 'Subtitle' }
          : layout === 'section'
            ? { title: 'Section' }
            : layout === 'bullets'
              ? { title: 'Title', body: '- Point one\n- Point two' }
              : { title: 'Title' }
  return makeSlide(content, '', layout)
}

export function duplicateSlide(deck: Deck, index: number): Deck {
  const s = deck.slides[index]
  return s ? insertSlide(deck, index + 1, cloneSlide(s)) : deck
}

/** Delete a slide; a deck always keeps at least one. */
export function deleteSlide(deck: Deck, index: number): Deck {
  if (deck.slides.length <= 1 || !deck.slides[index]) return deck
  return { ...deck, slides: deck.slides.filter((_, i) => i !== index) }
}

// ---------------------------------------------------------------- undo / redo

export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** Commits with the same group as the last one replace it (one drag / one typing burst = one step). */
  group: string | null
}

export const HISTORY_CAP = 100

export function history<T>(present: T): History<T> {
  return { past: [], present, future: [], group: null }
}

export function commit<T>(h: History<T>, next: T, group: string | null = null): History<T> {
  if (next === h.present) return h
  if (group !== null && group === h.group) return { past: h.past, present: next, future: [], group }
  const past = [...h.past, h.present]
  if (past.length > HISTORY_CAP) past.splice(0, past.length - HISTORY_CAP)
  return { past, present: next, future: [], group }
}

/** End the current coalescing group, so the next commit is its own step. */
export const seal = <T>(h: History<T>): History<T> => (h.group === null ? h : { ...h, group: null })

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h
  const past = h.past.slice(0, -1)
  return { past, present: h.past[h.past.length - 1], future: [h.present, ...h.future], group: null }
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h
  const [present, ...future] = h.future
  return { past: [...h.past, h.present], present, future, group: null }
}
