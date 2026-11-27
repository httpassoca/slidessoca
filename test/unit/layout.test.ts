import { describe, expect, it } from 'vitest'
import { autoLayout, layoutElements, relayout } from '$lib/deck/layout'
import { makeSlide } from '$lib/deck/factory'
import { CANVAS_H, CANVAS_W, emptyContent, LAYOUTS, type SlideContent } from '$lib/deck/types'

const img = { src: 'https://x/y.png', alt: 'y' }

describe('autoLayout', () => {
  it.each([
    [{ title: 'T', subtitle: 'S' }, 'title'],
    [{ title: 'T' }, 'section'],
    [{ title: 'T', body: '- a' }, 'bullets'],
    [{ title: 'T', body: 'x', images: [img] }, 'image-right'],
    [{ images: [img] }, 'image-full'],
    [{ images: [img, img] }, 'gallery'],
    [{ quote: { text: 'q', cite: '' } }, 'quote'],
    [{}, 'blank'],
  ] as [Partial<SlideContent>, string][])('%o → %s', (c, layout) => {
    expect(autoLayout({ ...emptyContent(), ...c })).toBe(layout)
  })
})

describe('layoutElements', () => {
  const full = {
    ...emptyContent(),
    title: 'Title',
    subtitle: 'Sub',
    body: '- a\n- b',
    images: [img, img, img],
    quote: { text: 'q', cite: 'c' },
  }
  it.each(LAYOUTS)('%s keeps every element inside the canvas', (l) => {
    for (const e of layoutElements('s1', l, full)) {
      expect(e.x).toBeGreaterThanOrEqual(0)
      expect(e.y).toBeGreaterThanOrEqual(0)
      expect(e.x + e.w).toBeLessThanOrEqual(CANVAS_W)
      expect(e.y + e.h).toBeLessThanOrEqual(CANVAS_H)
    }
  })
  it('uses stable ids', () => {
    const a = layoutElements('s1', 'bullets', full).map((e) => e.id)
    expect(layoutElements('s1', 'bullets', full).map((e) => e.id)).toEqual(a)
  })
  it('relayout clears manual', () => {
    const s = { ...makeSlide({ title: 'x' }), manual: true, elements: [] }
    const r = relayout(s, 'bullets')
    expect(r.manual).toBe(false)
    expect(r.elements.length).toBeGreaterThan(0)
  })
})
