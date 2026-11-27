// Auto-layout: SlideContent → positioned elements. This is what makes "just give me a title, some
// text and images" turn into a finished slide. Pure and deterministic (ids derive from the slide
// id + role), so re-laying out a slide keeps element ids stable.

import {
  CANVAS_H,
  CANVAS_W,
  type ImageElement,
  type LayoutName,
  type Slide,
  type SlideContent,
  type SlideElement,
  type TextElement,
  type TextSize,
} from './types.js'

const M = 96 // outer margin
const GAP = 48

/** Pick a layout from what the content contains. */
export function autoLayout(c: SlideContent): LayoutName {
  const hasBody = c.body.trim() !== ''
  const imgs = c.images.length
  const hasTitle = c.title.trim() !== ''
  if (c.quote && !hasBody && imgs === 0) return 'quote'
  if (imgs >= 2 && !hasBody) return 'gallery'
  if (imgs === 1 && !hasBody) return 'image-full'
  if (imgs >= 1 && hasBody) return 'image-right'
  if (hasTitle && !hasBody && c.subtitle.trim() !== '') return 'title'
  if (hasTitle && !hasBody) return 'section'
  if (!hasTitle && !hasBody && !c.quote) return 'blank'
  return 'bullets'
}

/** Title size that keeps long titles on ~2 lines in the given width. */
export function titleSize(text: string, width: number, big = false): TextSize {
  const perLine = width / 40 // rough chars-per-line at the `lg` size
  const len = text.length
  if (big) return len < perLine * 0.55 ? 'xxl' : len < perLine * 1.1 ? 'xl' : 'lg'
  return len < perLine * 0.9 ? 'xl' : len < perLine * 1.8 ? 'lg' : 'md'
}

/** Body size from how much text there is (auto-fit in the renderer is the safety net). */
export function bodySize(body: string, area: number): TextSize {
  const density = body.length / (area / 10_000)
  if (density < 6) return 'lg'
  if (density < 14) return 'md'
  if (density < 26) return 'sm'
  return 'xs'
}

function text(
  slideId: string,
  role: TextElement['role'],
  value: string,
  box: { x: number; y: number; w: number; h: number },
  over: Partial<TextElement> = {},
): TextElement {
  return {
    id: `${slideId}-${role}`,
    kind: 'text',
    role,
    text: value,
    size: 'md',
    align: 'start',
    valign: 'top',
    color: role === 'subtitle' || role === 'caption' || role === 'cite' ? 'muted' : 'fg',
    font: role === 'title' || role === 'quote' ? 'display' : 'body',
    ...box,
    ...over,
  }
}

function image(
  slideId: string,
  i: number,
  ref: { src: string; alt: string },
  box: { x: number; y: number; w: number; h: number },
  fit: ImageElement['fit'] = 'contain',
): ImageElement {
  return { id: `${slideId}-img${i}`, kind: 'image', src: ref.src, alt: ref.alt, fit, ...box }
}

/** Lay out content with a given layout. Missing pieces simply produce no element. */
export function layoutElements(
  slideId: string,
  layout: LayoutName,
  c: SlideContent,
): SlideElement[] {
  const out: SlideElement[] = []
  const innerW = CANVAS_W - 2 * M
  const title = c.title.trim()
  const sub = c.subtitle.trim()
  const body = c.body.trim()

  // Shared header for content-ish layouts.
  const header = (w = innerW) => {
    if (!title) return M
    const size = titleSize(title, w)
    const h = size === 'xl' ? 120 : size === 'lg' ? 150 : 130
    out.push(text(slideId, 'title', title, { x: M, y: M - 16, w, h }, { size, valign: 'bottom' }))
    let y = M - 16 + h + 12
    if (sub) {
      out.push(text(slideId, 'subtitle', sub, { x: M, y, w, h: 56 }, { size: 'sm' }))
      y += 56 + 8
    }
    return y + GAP / 2
  }

  switch (layout) {
    case 'title': {
      const size = titleSize(title, innerW, true)
      out.push(
        text(
          slideId,
          'title',
          title,
          { x: M, y: 220, w: innerW, h: 300 },
          { size, valign: 'bottom', align: 'start' },
        ),
      )
      if (sub)
        out.push(
          text(slideId, 'subtitle', sub, { x: M, y: 548, w: innerW, h: 120 }, { size: 'md' }),
        )
      if (body)
        out.push(
          text(
            slideId,
            'body',
            body,
            { x: M, y: 690, w: innerW, h: 120 },
            { size: 'sm', color: 'muted' },
          ),
        )
      break
    }
    case 'section': {
      out.push(
        text(
          slideId,
          'title',
          title,
          { x: M, y: 300, w: innerW, h: 220 },
          { size: titleSize(title, innerW, true), valign: 'middle', color: 'accent' },
        ),
      )
      if (sub)
        out.push(
          text(slideId, 'subtitle', sub, { x: M, y: 540, w: innerW, h: 100 }, { size: 'md' }),
        )
      break
    }
    case 'bullets': {
      const top = header()
      const h = CANVAS_H - top - M
      if (body)
        out.push(
          text(
            slideId,
            'body',
            body,
            { x: M, y: top, w: innerW, h },
            { size: bodySize(body, innerW * h) },
          ),
        )
      break
    }
    case 'image-right':
    case 'image-left': {
      const colW = (innerW - GAP) / 2
      const top = header()
      const h = CANVAS_H - top - M
      const textX = layout === 'image-right' ? M : M + colW + GAP
      const imgX = layout === 'image-right' ? M + colW + GAP : M
      if (body)
        out.push(
          text(
            slideId,
            'body',
            body,
            { x: textX, y: top, w: colW, h },
            { size: bodySize(body, colW * h) },
          ),
        )
      c.images
        .slice(0, 1)
        .forEach((ref, i) => out.push(image(slideId, i, ref, { x: imgX, y: top, w: colW, h })))
      break
    }
    case 'image-full': {
      const ref = c.images[0]
      if (ref) out.push(image(slideId, 0, ref, { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H }, 'cover'))
      if (title)
        out.push(
          text(
            slideId,
            'caption',
            sub ? `**${title}** — ${sub}` : title,
            { x: M, y: CANVAS_H - M - 110, w: innerW, h: 110 },
            { size: 'md', valign: 'bottom', color: 'fg', font: 'display' },
          ),
        )
      break
    }
    case 'gallery': {
      const top = header()
      const imgs = c.images.slice(0, 6)
      const cols = imgs.length <= 3 ? imgs.length : Math.ceil(imgs.length / 2)
      const rows = Math.ceil(imgs.length / cols)
      const cw = (innerW - GAP * (cols - 1)) / cols
      const ch = (CANVAS_H - top - M - GAP * (rows - 1)) / rows
      imgs.forEach((ref, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        out.push(
          image(
            slideId,
            i,
            ref,
            { x: M + col * (cw + GAP), y: top + row * (ch + GAP), w: cw, h: ch },
            'cover',
          ),
        )
      })
      break
    }
    case 'quote': {
      const q = c.quote ?? { text: body || title, cite: '' }
      out.push(
        text(
          slideId,
          'quote',
          `“${q.text.trim()}”`,
          { x: M + 80, y: 180, w: innerW - 160, h: 420 },
          {
            size: q.text.length < 90 ? 'xl' : q.text.length < 200 ? 'lg' : 'md',
            valign: 'middle',
            italic: true,
          },
        ),
      )
      if (q.cite)
        out.push(
          text(
            slideId,
            'cite',
            `— ${q.cite}`,
            { x: M + 80, y: 630, w: innerW - 160, h: 70 },
            { size: 'sm', align: 'end' },
          ),
        )
      break
    }
    case 'blank':
      break
  }
  return out
}

/** Re-apply the slide's layout from its content (clears `manual`). */
export function relayout(slide: Slide, layout: LayoutName = slide.layout): Slide {
  return {
    ...slide,
    layout,
    manual: false,
    elements: layoutElements(slide.id, layout, slide.content),
  }
}
