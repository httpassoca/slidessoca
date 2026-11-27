// Keyboard → NavAction for the players, leaving typing and focused controls alone.
import { keyAction, type NavAction } from '$lib/deck/nav'

const TYPING = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
const ACTIVATES = 'button, a[href], summary, [role="button"]'

export function playerKey(e: KeyboardEvent): NavAction | null {
  if (e.defaultPrevented || e.isComposing) return null
  const t = e.target instanceof Element ? e.target : null
  if (t?.closest(TYPING)) return null
  // A modal dialog (e.g. the share dialog) owns the keyboard while it is open.
  if (t?.closest('dialog')) return null
  // Space / Enter on a focused button must press the button, not change slides.
  if ((e.key === ' ' || e.key === 'Enter') && t?.closest(ACTIVATES)) return null
  return keyAction(e)
}
