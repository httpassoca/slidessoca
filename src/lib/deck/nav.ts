// Slide navigation logic shared by the viewer (/s/[id]) and the presenter (/present/[id]).
// Pure: no DOM, no Svelte — the player components translate events into these inputs.

export type NavAction =
  'next' | 'prev' | 'first' | 'last' | 'fullscreen' | 'overview' | 'notes' | 'select'

export interface KeyInput {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}

/** Clamp a slide index into [0, count - 1] (0 for an empty deck). */
export function clampIndex(i: number, count: number): number {
  if (count <= 0 || !Number.isFinite(i)) return 0
  return Math.min(count - 1, Math.max(0, Math.trunc(i)))
}

/** Keyboard shortcut → action. Modified keys (Ctrl/⌘/Alt) are left to the browser. */
export function keyAction(e: KeyInput): NavAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
    case 'l':
    case 'j':
      return 'next'
    case ' ':
    case 'Spacebar':
      return e.shiftKey ? 'prev' : 'next'
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
    case 'h':
    case 'k':
    case 'Backspace':
      return 'prev'
    case 'Home':
      return 'first'
    case 'End':
      return 'last'
    case 'f':
    case 'F':
      return 'fullscreen'
    case 'o':
    case 'O':
    case 'Escape':
      return 'overview'
    case 'n':
    case 'N':
      return 'notes'
    case 'Enter':
      return 'select'
    default:
      return null
  }
}

/** Where an action moves the current slide; `null` when it is not a movement. */
export function step(action: NavAction, i: number, count: number): number | null {
  switch (action) {
    case 'next':
      return clampIndex(i + 1, count)
    case 'prev':
      return clampIndex(i - 1, count)
    case 'first':
      return 0
    case 'last':
      return clampIndex(count - 1, count)
    default:
      return null
  }
}

/** `#3` (1-based, as people count slides) → index 2. Invalid or missing → null. */
export function indexFromHash(hash: string, count: number): number | null {
  const m = /^#?(\d{1,4})$/.exec(hash.trim())
  if (!m) return null
  const n = Number(m[1])
  if (n < 1) return null
  return clampIndex(n - 1, count)
}

export const hashFor = (i: number) => `#${i + 1}`

/** `?start=n` (0-based, the presenter contract) → index. */
export function indexFromStart(v: string | null, count: number): number {
  if (v == null || !/^\d{1,4}$/.test(v)) return 0
  return clampIndex(Number(v), count)
}

/** Indices worth preloading around the current slide. */
export function neighbours(i: number, count: number): number[] {
  return [i - 1, i + 1, i + 2].filter((j) => j >= 0 && j < count && j !== i)
}

export interface Gesture {
  /** Pointer movement between down and up, in px. */
  dx: number
  dy: number
  /** Duration in ms. */
  dt: number
  /** Where the pointer went up, relative to the stage's inline start, and the stage width. */
  x: number
  width: number
  pointerType: string
}

export type GestureResult = 'next' | 'prev' | 'middle' | null

const SWIPE_MIN = 40
const TAP_MAX = 10

/**
 * Touch gesture → movement. A mostly-horizontal swipe ≥ 40px moves (left = next, as on every
 * phone carousel). A tap (no real movement, < 500ms) on a touch/pen pointer uses thirds: left
 * third = previous, right third = next, middle = `middle` (callers may toggle chrome). Mouse
 * clicks never navigate — desktop users have keys and buttons, and slides can contain links.
 */
export function classifyGesture(g: Gesture): GestureResult {
  if (g.pointerType === 'mouse') return null
  const ax = Math.abs(g.dx)
  const ay = Math.abs(g.dy)
  if (ax >= SWIPE_MIN && ax > ay * 1.5 && g.dt < 1000) return g.dx < 0 ? 'next' : 'prev'
  if (ax <= TAP_MAX && ay <= TAP_MAX && g.dt < 500 && g.width > 0) {
    const r = g.x / g.width
    if (r < 1 / 3) return 'prev'
    if (r > 2 / 3) return 'next'
    return 'middle'
  }
  return null
}

/** Elapsed presenter time: `m:ss`, or `h:mm:ss` past an hour. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Messages between the presenter window and its audience window (BroadcastChannel). */
export type SyncMessage = { type: 'index'; index: number } | { type: 'hello' }

export function isSyncMessage(v: unknown): v is SyncMessage {
  if (typeof v !== 'object' || v === null) return false
  const m = v as Record<string, unknown>
  if (m.type === 'hello') return true
  return m.type === 'index' && typeof m.index === 'number' && Number.isInteger(m.index)
}

export const syncChannelName = (deckId: string) => `slidessoca:present:${deckId}`
