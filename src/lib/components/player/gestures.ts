// Pointer gestures on the slide stage → navigation (swipe, tap thirds). The decision is the
// pure `classifyGesture` in $lib/deck/nav; this attachment only measures.
import type { Attachment } from 'svelte/attachments'
import { classifyGesture, type GestureResult } from '$lib/deck/nav'

const INTERACTIVE = 'a, button, input, textarea, select, [contenteditable]'

export function gestures(on: (r: Exclude<GestureResult, null>) => void): Attachment<HTMLElement> {
  return (node) => {
    let start: { x: number; y: number; t: number; id: number } | null = null
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.pointerType === 'mouse') return
      if ((e.target as Element | null)?.closest?.(INTERACTIVE)) return
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId }
    }
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      const r = node.getBoundingClientRect()
      const rtl = getComputedStyle(node).direction === 'rtl'
      const x = rtl ? r.right - e.clientX : e.clientX - r.left
      const dx = (e.clientX - start.x) * (rtl ? -1 : 1)
      const res = classifyGesture({
        dx,
        dy: e.clientY - start.y,
        dt: e.timeStamp - start.t,
        x,
        width: r.width,
        pointerType: e.pointerType,
      })
      start = null
      if (res) on(res)
    }
    const cancel = () => (start = null)
    node.addEventListener('pointerdown', down)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', cancel)
    return () => {
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', cancel)
    }
  }
}
