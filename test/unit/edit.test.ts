import { describe, expect, it } from 'vitest'
import {
  blankSlide,
  commit,
  contentFromText,
  deleteElement,
  deleteSlide,
  duplicateSlide,
  history,
  HISTORY_CAP,
  insertElement,
  insertSlide,
  isRoleElement,
  KEEP_VISIBLE,
  moveBox,
  moveSlide,
  newImage,
  newShape,
  newTextBox,
  nudge,
  redo,
  reorderElement,
  resizeBox,
  MIN_SIZE,
  seal,
  setBox,
  setContent,
  setLayout,
  snapMove,
  snapResize,
  snapTargets,
  undo,
  updateElement,
  updateSlide,
  updateText,
} from '$lib/deck/edit'
import { makeDeck, makeSlide } from '$lib/deck/factory'
import { CANVAS_H, CANVAS_W, LAYOUTS, type Slide } from '$lib/deck/types'

const box = { x: 100, y: 100, w: 200, h: 100 }

describe('moveBox', () => {
  it('moves by the delta', () => {
    expect(moveBox(box, 10, -20)).toEqual({ x: 110, y: 80, w: 200, h: 100 })
  })
  it('keeps part of the box on the canvas', () => {
    const far = moveBox(box, 5000, 5000)
    expect(far.x).toBe(CANVAS_W - KEEP_VISIBLE)
    expect(far.y).toBe(CANVAS_H - KEEP_VISIBLE)
    const neg = moveBox(box, -5000, -5000)
    expect(neg.x + neg.w).toBe(KEEP_VISIBLE)
    expect(neg.y + neg.h).toBe(KEEP_VISIBLE)
  })
})

describe('resizeBox', () => {
  it.each([
    ['e', 50, 0, { x: 100, y: 100, w: 250, h: 100 }],
    ['w', 50, 0, { x: 150, y: 100, w: 150, h: 100 }],
    ['s', 0, 30, { x: 100, y: 100, w: 200, h: 130 }],
    ['n', 0, 30, { x: 100, y: 130, w: 200, h: 70 }],
    ['se', 10, 10, { x: 100, y: 100, w: 210, h: 110 }],
    ['nw', -10, -10, { x: 90, y: 90, w: 210, h: 110 }],
    ['ne', 10, -10, { x: 100, y: 90, w: 210, h: 110 }],
    ['sw', -10, 10, { x: 90, y: 100, w: 210, h: 110 }],
  ] as const)('%s handle', (h, dx, dy, out) => {
    expect(resizeBox(box, h, dx, dy)).toEqual(out)
  })
  it('never goes below the minimum and keeps the opposite edge', () => {
    const r = resizeBox(box, 'w', 1000, 0)
    expect(r.w).toBe(MIN_SIZE)
    expect(r.x + r.w).toBe(300)
  })
  it('keeps the ratio on corners when asked', () => {
    const r = resizeBox(box, 'se', 100, 0, true)
    expect(r.w / r.h).toBeCloseTo(2)
    const nw = resizeBox(box, 'nw', -100, 0, true)
    expect(nw.x + nw.w).toBe(300)
    expect(nw.y + nw.h).toBe(200)
  })
})

describe('snapping', () => {
  const slide: Slide = {
    ...makeSlide({}, '', 'blank'),
    elements: [
      { ...newShape(makeSlide(), 'rect'), id: 'a', x: 400, y: 300, w: 100, h: 100 },
      { ...newShape(makeSlide(), 'rect'), id: 'b', x: 1000, y: 600, w: 100, h: 100 },
    ],
  }
  it('collects canvas + other element lines, excluding the dragged one', () => {
    const t = snapTargets(slide, 'a')
    expect(t.xs).toEqual(expect.arrayContaining([0, 800, 1600, 1000, 1050, 1100]))
    expect(t.xs).not.toContain(400)
  })
  it('snaps the box centre to the canvas centre and reports a guide', () => {
    const { box: b, guides } = snapMove({ x: 696, y: 20, w: 200, h: 100 }, snapTargets(slide, null))
    expect(b.x).toBe(700)
    expect(guides.v).toEqual([800])
  })
  it('snaps to another element edge', () => {
    const { box: b, guides } = snapMove({ x: 1104, y: 300, w: 50, h: 50 }, snapTargets(slide, null))
    expect(b.x).toBe(1100)
    expect(guides.v).toEqual([1100])
    // y: top at 300 snaps to element a's top
    expect(guides.h).toEqual([300])
  })
  it('does nothing out of range', () => {
    const r = snapMove({ x: 200, y: 200, w: 30, h: 30 }, snapTargets(slide, null))
    expect(r.box).toEqual({ x: 200, y: 200, w: 30, h: 30 })
    expect(r.guides).toEqual({ v: [], h: [] })
  })
  it('snaps only the moving edges on resize', () => {
    const r = snapResize({ x: 100, y: 100, w: 295, h: 100 }, 'e', snapTargets(slide, null))
    expect(r.box).toEqual({ x: 100, y: 100, w: 300, h: 100 })
    expect(r.guides.v).toEqual([400])
    const w = snapResize({ x: 5, y: 100, w: 300, h: 100 }, 'w', snapTargets(slide, null))
    expect(w.box).toEqual({ x: 0, y: 100, w: 305, h: 100 })
    const n = snapResize({ x: 100, y: 896, w: 100, h: 2 }, 'n', snapTargets(slide, null))
    expect(n.box.h).toBe(2) // snapping would shrink below the minimum → skipped
  })
})

describe('element edits and invariant 2', () => {
  const auto = () => makeSlide({ title: 'Hello', body: '- a\n- b' })
  it('moving/resizing flips manual, style changes do not', () => {
    const s = auto()
    const title = s.elements[0]
    expect(s.manual).toBe(false)
    expect(updateElement(s, title.id, { size: 'xl' }).manual).toBe(false)
    expect(setBox(s, title.id, { ...title, x: title.x + 5 }).manual).toBe(true)
    expect(nudge(s, title.id, 10, 0).elements[0].x).toBe(title.x + 10)
  })
  it('setBox with the same box is a no-op', () => {
    const s = auto()
    expect(setBox(s, s.elements[0].id, s.elements[0])).toBe(s)
  })
  it('inserting and deleting flip manual', () => {
    const s = auto()
    const t = newTextBox(s)
    const withT = insertElement(s, t)
    expect(withT.manual).toBe(true)
    expect(withT.elements.at(-1)).toBe(t)
    expect(t.id.startsWith(s.id)).toBe(true)
    const del = deleteElement(s, s.elements[1].id)
    expect(del.manual).toBe(true)
    expect(del.elements).toHaveLength(1)
    expect(deleteElement(s, 'nope')).toBe(s)
  })
  it('editing a role element on an auto slide writes content and stays auto', () => {
    const s = auto()
    const title = s.elements.find((e) => e.kind === 'text' && e.role === 'title')!
    const next = updateText(s, title.id, 'A much longer title now')
    expect(next.manual).toBe(false)
    expect(next.content.title).toBe('A much longer title now')
    expect(next.elements.find((e) => e.id === title.id)).toMatchObject({
      text: 'A much longer title now',
    })
  })
  it('editing on a manual slide keeps positions but still updates content', () => {
    const a = auto()
    const s = setBox(a, a.elements[0].id, { x: 10, y: 10, w: 500, h: 100 })
    const next = updateText(s, s.elements[0].id, 'Moved title')
    expect(next.manual).toBe(true)
    expect(next.elements[0]).toMatchObject({ x: 10, y: 10, text: 'Moved title' })
    expect(next.content.title).toBe('Moved title')
  })
  it('free text boxes do not touch content', () => {
    const s = insertElement(auto(), newTextBox(auto(), 'free'))
    const id = s.elements.at(-1)!.id
    const next = updateText(s, id, 'changed')
    expect(next.content).toEqual(s.content)
    expect(next.elements.at(-1)).toMatchObject({ text: 'changed' })
    expect(isRoleElement(next.elements.at(-1)!)).toBe(false)
  })
  it('maps caption / quote / cite text back to content', () => {
    const img = makeSlide({
      title: 'T',
      subtitle: 'S',
      images: [{ src: 'https://x/y.png', alt: '' }],
    })
    expect(contentFromText(img, 'caption', '**New** — sub')).toMatchObject({
      title: 'New',
      subtitle: 'sub',
    })
    expect(contentFromText(img, 'caption', 'Just title')).toMatchObject({
      title: 'Just title',
      subtitle: '',
    })
    const q = makeSlide({ quote: { text: 'Old', cite: 'Me' } })
    expect(contentFromText(q, 'quote', '“New words”').quote).toEqual({
      text: 'New words',
      cite: 'Me',
    })
    expect(contentFromText(q, 'cite', '— You').quote).toEqual({ text: 'Old', cite: 'You' })
    const bodyQuote = makeSlide({ body: 'from body' }, '', 'quote')
    expect(contentFromText(bodyQuote, 'quote', '“x”').body).toBe('x')
  })
  it('content form re-lays out auto slides only', () => {
    const s = auto()
    const next = setContent(s, { subtitle: 'Sub' })
    expect(next.elements.some((e) => e.kind === 'text' && e.role === 'subtitle')).toBe(true)
    const manual = { ...s, manual: true }
    const m = setContent(manual, { subtitle: 'Sub' })
    expect(m.elements).toBe(manual.elements)
    expect(m.content.subtitle).toBe('Sub')
  })
  it('setLayout re-applies the layout and clears manual', () => {
    const s = { ...auto(), manual: true, elements: [] }
    const next = setLayout(s, 'section')
    expect(next.layout).toBe('section')
    expect(next.manual).toBe(false)
    expect(next.elements.length).toBeGreaterThan(0)
  })
})

describe('z-order', () => {
  const s = makeSlide({ title: 'T', subtitle: 'S', body: 'B' }, '', 'title')
  const ids = s.elements.map((e) => e.id)
  it.each([
    ['forward', 0, [1, 0, 2]],
    ['backward', 2, [0, 2, 1]],
    ['front', 0, [1, 2, 0]],
    ['back', 2, [2, 0, 1]],
  ] as const)('%s', (move, i, order) => {
    expect(reorderElement(s, ids[i], move).elements.map((e) => e.id)).toEqual(
      order.map((k) => ids[k]),
    )
  })
  it('is a no-op at the end', () => {
    expect(reorderElement(s, ids[2], 'forward')).toBe(s)
  })
})

describe('new elements', () => {
  const s = makeSlide()
  it('images keep their aspect ratio within 60% of the canvas', () => {
    const im = newImage(s, 'data:image/webp;base64,AAAA', 'a', { w: 2000, h: 1000 })
    expect(im.w / im.h).toBeCloseTo(2)
    expect(im.w).toBeLessThanOrEqual(CANVAS_W * 0.6)
  })
  it('shapes: lines are thin and stroked', () => {
    expect(newShape(s, 'line')).toMatchObject({ fill: 'none', stroke: 'fg', h: 16 })
    expect(newShape(s, 'ellipse')).toMatchObject({ fill: 'accent', w: 320, h: 320 })
  })
})

describe('slides in a deck', () => {
  const deck = () =>
    makeDeck('D', 'dark', [
      makeSlide({ title: 'A' }),
      makeSlide({ title: 'B' }),
      makeSlide({ title: 'C' }),
    ])
  const titles = (d: ReturnType<typeof deck>) => d.slides.map((s) => s.content.title)
  it('moves slides', () => {
    expect(titles(moveSlide(deck(), 0, 2))).toEqual(['B', 'C', 'A'])
    expect(titles(moveSlide(deck(), 2, -5))).toEqual(['C', 'A', 'B'])
    const d = deck()
    expect(moveSlide(d, 1, 1)).toBe(d)
  })
  it('inserts, duplicates, deletes (never the last one)', () => {
    expect(titles(insertSlide(deck(), 1, makeSlide({ title: 'X' })))).toEqual(['A', 'X', 'B', 'C'])
    const dup = duplicateSlide(deck(), 0)
    expect(titles(dup)).toEqual(['A', 'A', 'B', 'C'])
    expect(dup.slides[1].id).not.toBe(dup.slides[0].id)
    expect(titles(deleteSlide(deck(), 1))).toEqual(['A', 'C'])
    const one = makeDeck()
    expect(deleteSlide(one, 0)).toBe(one)
  })
  it('updateSlide returns the same deck when nothing changed', () => {
    const d = deck()
    expect(updateSlide(d, 0, (s) => s)).toBe(d)
    expect(updateSlide(d, 9, (s) => ({ ...s, notes: 'x' }))).toBe(d)
    expect(updateSlide(d, 0, (s) => ({ ...s, notes: 'x' })).slides[0].notes).toBe('x')
  })
  it.each(LAYOUTS)('blankSlide(%s) uses that layout', (l) => {
    const s = blankSlide(l)
    expect(s.layout).toBe(l)
    expect(s.manual).toBe(false)
    if (l !== 'blank') expect(s.elements.length).toBeGreaterThan(0)
  })
})

describe('history', () => {
  it('undoes and redoes', () => {
    let h = history(1)
    h = commit(h, 2)
    h = commit(h, 3)
    h = undo(h)
    expect(h.present).toBe(2)
    h = undo(h)
    expect(h.present).toBe(1)
    expect(undo(h)).toBe(h)
    h = redo(h)
    expect(h.present).toBe(2)
    h = commit(h, 9)
    expect(h.future).toEqual([])
    expect(redo(h)).toBe(h)
  })
  it('coalesces a group into one step until sealed', () => {
    let h = history(0)
    h = commit(h, 1, 'drag')
    h = commit(h, 2, 'drag')
    h = commit(h, 3, 'drag')
    expect(h.past).toEqual([0])
    h = seal(h)
    h = commit(h, 4, 'drag')
    expect(h.past).toEqual([0, 3])
    expect(undo(h).present).toBe(3)
  })
  it('ignores identical commits and caps the past', () => {
    let h = history(0)
    expect(commit(h, 0)).toBe(h)
    for (let i = 1; i <= HISTORY_CAP + 20; i++) h = commit(h, i)
    expect(h.past).toHaveLength(HISTORY_CAP)
    expect(h.past[0]).toBe(20)
  })
})
