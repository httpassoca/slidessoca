// Warm the browser cache for images on the slides around the current one.
import type { Slide } from '$lib/deck/types'

const seen = new Set<string>()

export function preloadSlides(slides: Slide[]): void {
  if (typeof Image === 'undefined') return
  for (const s of slides)
    for (const e of s.elements)
      if (e.kind === 'image' && !seen.has(e.src)) {
        seen.add(e.src)
        const img = new Image()
        img.decoding = 'async'
        img.referrerPolicy = 'no-referrer' // same as SlideView: many hosts block hotlinks by referrer
        img.src = e.src
      }
}
