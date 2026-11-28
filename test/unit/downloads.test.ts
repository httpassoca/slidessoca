import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPdf, jpegInfo } from '$lib/export/pdf'
import { buildDeckHtml } from '$lib/export/html'
import { downloadName, slideImageName } from '$lib/export/names'
import { deckHtml } from '$lib/client/downloads'
import { makeDeck, makeSlide } from '$lib/deck/factory'
import type { Deck } from '$lib/deck/types'

const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('')

/** A tiny fake JPEG: SOI, an SOF0 segment with the given size, EOI. */
function fakeJpeg(w: number, h: number, components = 3): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    h >> 8,
    h & 255,
    w >> 8,
    w & 255,
    components,
    1,
    0x11,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
    0xff,
    0xd9,
  ])
}

describe('jpegInfo', () => {
  it('reads the size from the SOF marker', () => {
    expect(jpegInfo(fakeJpeg(1920, 1080))).toEqual({ width: 1920, height: 1080, components: 3 })
  })
  it('rejects non-JPEG bytes', () => {
    expect(jpegInfo(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
  })
})

describe('buildPdf', () => {
  const pages = [1, 2, 3].map(() => ({ jpeg: fakeJpeg(1920, 1080), width: 1920, height: 1080 }))
  const pdf = buildPdf(pages, { title: 'Tâlk (draft)' })
  const s = latin1(pdf)

  it('has a PDF header and an EOF marker', () => {
    expect(s.startsWith('%PDF-1.4\n')).toBe(true)
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('has one page per image, 16:9', () => {
    expect(s).toContain('/Count 3')
    expect(s.match(/\/Type \/Page /g)).toHaveLength(3)
    expect(s.match(/\/MediaBox \[0 0 960 540\]/g)).toHaveLength(3)
    expect(s.match(/\/Filter \/DCTDecode/g)).toHaveLength(3)
  })

  it('has correct xref offsets and startxref', () => {
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(s)![1])
    expect(s.slice(startxref, startxref + 4)).toBe('xref')
    const head = /xref\n0 (\d+)\n/.exec(s.slice(startxref))!
    const count = Number(head[1])
    expect(count).toBe(4 + 3 * 3)
    const lines = s
      .slice(startxref + head[0].length)
      .split('\n')
      .slice(0, count)
    expect(lines[0]).toBe('0000000000 65535 f ')
    for (let n = 1; n < count; n++) {
      expect(lines[n]).toMatch(/^\d{10} 00000 n $/)
      const off = Number(lines[n].slice(0, 10))
      expect(s.slice(off, off + `${n} 0 obj`.length)).toBe(`${n} 0 obj`)
    }
    expect(s).toContain(`/Size ${count}`)
  })

  it('embeds the JPEG bytes unchanged with the right /Length', () => {
    const at = s.indexOf('stream\n\xff\xd8')
    expect(at).toBeGreaterThan(0)
    expect(s).toContain(`/Length ${pages[0].jpeg.length} >>`)
  })

  it('stores the title as UTF-16 hex', () => {
    expect(s).toContain('/Title <FEFF')
    expect(s).not.toContain('(draft)')
  })
})

describe('names', () => {
  it('names downloads after the deck slug', () => {
    expect(downloadName('My Talk: 2026!', 'html')).toBe('my-talk-2026.html')
    expect(downloadName('My Talk', 'pdf')).toBe('my-talk.pdf')
    expect(downloadName('My Talk', 'jpg')).toBe('my-talk-slides.zip')
    expect(downloadName('', 'pdf')).toBe('deck.pdf')
  })
  it('zero-pads slide images to the deck width', () => {
    expect(slideImageName(0, 3)).toBe('slide-01.jpg')
    expect(slideImageName(11, 12)).toBe('slide-12.jpg')
    expect(slideImageName(4, 120)).toBe('slide-005.jpg')
  })
})

describe('buildDeckHtml', () => {
  const base = {
    title: 'A <b>talk</b>',
    mode: 'dark' as const,
    palette: null,
    bg: '#100f10',
    css: '.slide{color:red}</style><script>x</script>',
  }

  it('contains every slide, the first one visible', () => {
    const html = buildDeckHtml({
      ...base,
      slides: [{ html: '<p>one</p>' }, { html: '<p>two</p>' }],
    })
    expect(html.match(/<section class="x-frame"/g)).toHaveLength(2)
    expect(html).toContain('<p>one</p>')
    expect(html).toContain('<p>two</p>')
    expect(html).toContain('aria-label="Slide 2 of 2" hidden')
    expect(html).toContain('<title>A &lt;b&gt;talk&lt;/b&gt;</title>')
  })

  it('cannot be broken out of its <style>', () => {
    const html = buildDeckHtml({ ...base, slides: [{ html: '' }] })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(doc.querySelectorAll('script')).toHaveLength(1)
    expect(html).not.toContain('</style><script>')
  })

  it('has no notes UI unless notes are given', () => {
    const none = buildDeckHtml({ ...base, slides: [{ html: 'a', notes: '' }, { html: 'b' }] })
    expect(none).not.toContain('class="x-notes"')
    expect(none).not.toContain('data-x="notes"')
    const some = buildDeckHtml({ ...base, slides: [{ html: 'a', notes: '<p>say hi</p>' }] })
    expect(some).toContain('class="x-notes"')
    expect(some).toContain('<p>say hi</p>')
  })

  it('carries the theme on the root and a preset palette when set', () => {
    const html = buildDeckHtml({ ...base, palette: 'nord', mode: 'light', slides: [] })
    expect(html).toContain('<html lang="en" data-theme="light" data-palette="nord">')
  })
})

describe('deckHtml (SlideView markup)', () => {
  let deck: Deck
  beforeEach(() => {
    // No network in tests: fonts fall back to the stylesheet link.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )
    const a = makeSlide(
      { title: 'Hello <script>alert(1)</script>', subtitle: '<img src=x onerror=alert(2)>' },
      'Remember **this** <script>alert(3)</script>',
      'title',
    )
    const b = makeSlide({ title: 'Second', body: '- one\n- two' }, '', 'bullets')
    deck = makeDeck('Evil deck', 'dark', [a, b])
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders every slide through SlideView with deck text sanitised', async () => {
    const html = await deckHtml(deck)
    expect(html.match(/<section class="x-frame"/g)).toHaveLength(2)
    expect(html).toContain('Second')
    expect(html.match(/<script>/g)).toHaveLength(1) // only the player
    expect(html).not.toMatch(/<img[^>]*onerror/i)
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('fonts.googleapis.com')
  })

  it('leaves notes out unless asked, and sanitises them when included', async () => {
    expect(await deckHtml(deck)).not.toContain('Remember')
    const withNotes = await deckHtml(deck, { notes: true })
    expect(withNotes).toContain('<strong>this</strong>')
    expect(withNotes.match(/<script>/g)).toHaveLength(1)
    expect(withNotes).not.toContain('alert(3)</script>')
  })
})
