// Images are links (ADR 0002 / SL-0011): URL inputs, legacy detection, export fallbacks.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/svelte'
import Inspector from '$lib/components/editor/Inspector.svelte'
import { makeDeck, makeSlide } from '$lib/deck/factory'
import { altFromUrl, checkImageUrl, slidesWithUploadedImages } from '$lib/deck/images'
import { deckHtml, missingImagesMessage, withInlineImages } from '$lib/client/downloads'
import type { Slide } from '$lib/deck/types'

const URL_OK = 'https://upload.wikimedia.org/wikipedia/commons/8/8a/H96566k.jpg'

describe('checkImageUrl', () => {
  it('accepts http(s) links (trimmed)', () => {
    expect(checkImageUrl(`  ${URL_OK} `)).toEqual({ ok: true, src: URL_OK })
    expect(checkImageUrl('http://a.org/x.png')).toEqual({ ok: true, src: 'http://a.org/x.png' })
  })
  it.each([
    ['', /Paste a link/],
    ['photo.jpg', /starts with https/],
    ['./img/a.png', /starts with https/],
    ['javascript:alert(1)', /starts with https/],
    ['ftp://a.org/x.png', /starts with https/],
    ['data:image/png;base64,AA==', /not embedded image data/],
  ])('refuses %j', (input, why) => {
    const c = checkImageUrl(input)
    expect(c.ok).toBe(false)
    if (!c.ok) expect(c.error).toMatch(why)
  })
  it('suggests alt text from the file name', () => {
    expect(altFromUrl(URL_OK)).toBe('H96566k')
    expect(
      altFromUrl(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Felis_catus-cat_on_snow.jpg/1280px-Felis_catus-cat_on_snow.jpg',
      ),
    ).toBe('Felis catus cat on snow')
    expect(altFromUrl('https://commons.wikimedia.org/wiki/Special:FilePath/Big_red-fox.jpg')).toBe(
      'Big red fox',
    )
  })
})

describe('slidesWithUploadedImages', () => {
  it('lists the 1-based slides with data: images, in content or placed by hand', () => {
    const old = 'data:image/png;base64,AA=='
    const placed = makeSlide({ title: 'P' })
    const d = makeDeck('x', 'dark', [
      makeSlide({ images: [{ src: URL_OK, alt: '' }] }),
      makeSlide({ images: [{ src: old, alt: '' }] }),
      {
        ...placed,
        elements: [
          { id: 'i', kind: 'image', src: old, alt: '', fit: 'cover', x: 0, y: 0, w: 9, h: 9 },
        ],
      },
    ])
    expect(slidesWithUploadedImages(d)).toEqual([2, 3])
    expect(slidesWithUploadedImages(makeDeck())).toEqual([])
  })
})

describe('exports with linked images', () => {
  afterEach(() => vi.unstubAllGlobals())

  const twoImages = () =>
    makeDeck('Pics', 'dark', [
      makeSlide({ title: 'Open', images: [{ src: 'https://cors.example/a.png', alt: 'a' }] }),
      makeSlide({ title: 'Closed', images: [{ src: 'https://no-cors.example/b.png', alt: 'b' }] }),
      makeSlide({ title: 'Again', images: [{ src: 'https://no-cors.example/b.png', alt: 'b' }] }),
    ])

  /** CORS-friendly host answers; the other one fails like a CORS refusal (TypeError). */
  const corsFetch = () =>
    vi.fn((url: string, init?: RequestInit) => {
      expect(init?.mode).toBe('cors')
      if (String(url).startsWith('https://cors.example'))
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
        })
      return Promise.reject(new TypeError('Failed to fetch'))
    })

  it('inlines what CORS allows and counts each distinct image it could not', async () => {
    vi.stubGlobal('fetch', corsFetch())
    const { deck, failed } = await withInlineImages(twoImages(), () => 'BROKEN')
    const srcs = deck.slides.map((s) => s.elements.find((e) => e.kind === 'image')!)
    expect((srcs[0] as { src: string }).src).toMatch(/^data:image\/png;base64,/)
    expect((srcs[1] as { src: string }).src).toBe('BROKEN')
    expect((srcs[2] as { src: string }).src).toBe('BROKEN')
    expect(failed).toBe(1)
  })

  it('names how many images were left out', () => {
    expect(missingImagesMessage(0, 'raster')).toBeNull()
    expect(missingImagesMessage(1, 'raster')).toMatch(/^1 image could not be included/)
    expect(missingImagesMessage(3, 'html')).toMatch(/^3 images stayed as links/)
  })

  it('the HTML download keeps a link it could not inline, without a referrer', async () => {
    vi.stubGlobal('fetch', corsFetch())
    const onMissing = vi.fn()
    // jsdom never loads images: settle the off-screen slides' images by hand.
    const settle = setInterval(() => {
      for (const img of document.querySelectorAll('img')) img.dispatchEvent(new Event('load'))
    }, 20)
    const html = await deckHtml(twoImages(), { onMissing }).finally(() => clearInterval(settle))
    expect(onMissing).toHaveBeenCalledWith(1)
    expect(html).toContain('src="https://no-cors.example/b.png"')
    expect(html).not.toContain('https://cors.example/a.png')
    expect(html).toMatch(/<img[^>]*referrerpolicy="no-referrer"/)
  })
})

describe('Inspector image links', () => {
  it('replaces a selected image by pasting a link', async () => {
    const base = makeSlide({ title: 'T', images: [{ src: 'https://e.org/old.png', alt: 'old' }] })
    const el = base.elements.find((e) => e.kind === 'image')!
    const onslide = vi.fn()
    render(Inspector, { slide: base, element: el, theme: 'dark', onslide })
    const input = screen.getByLabelText('Image URL') as HTMLInputElement
    expect(input.value).toBe('https://e.org/old.png')
    expect(document.querySelector('input[type="file"]')).toBeNull()
    await fireEvent.input(input, { target: { value: URL_OK } })
    const preview = document.querySelector(`.url-field img[src="${URL_OK}"]`)
    expect(preview).toHaveAttribute('referrerpolicy', 'no-referrer')
    await fireEvent.click(screen.getByRole('button', { name: 'Replace image' }))
    const next = onslide.mock.calls.at(-1)![0](base) as Slide
    expect(next.elements.find((e) => e.id === el.id)).toMatchObject({ src: URL_OK })
  })

  it('refuses something that is not a link', async () => {
    const base = makeSlide({ title: 'T' })
    const onslide = vi.fn()
    render(Inspector, { slide: base, element: undefined, theme: 'dark', onslide })
    await fireEvent.input(screen.getByLabelText('Add an image by URL'), {
      target: { value: 'my-photo.jpg' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Add image' }))
    expect(onslide).not.toHaveBeenCalled()
    expect(screen.getByText(/full link that starts with https/)).toBeInTheDocument()
  })

  it('adds a content image with its alt text', async () => {
    const base = makeSlide({ title: 'T' })
    const onslide = vi.fn()
    render(Inspector, { slide: base, element: undefined, theme: 'dark', onslide })
    await fireEvent.input(screen.getByLabelText('Add an image by URL'), {
      target: { value: URL_OK },
    })
    const alt = screen.getByLabelText('Alt text') as HTMLInputElement
    expect(alt.value).toBe('H96566k')
    await fireEvent.input(alt, { target: { value: 'A nebula' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Add image' }))
    const next = onslide.mock.calls.at(-1)![0](base) as Slide
    expect(next.content.images).toEqual([{ src: URL_OK, alt: 'A nebula' }])
  })

  it('flags a legacy uploaded image and does not prefill its data', () => {
    const base = makeSlide({ title: 'T', images: [{ src: 'data:image/png;base64,AA==', alt: '' }] })
    const el = base.elements.find((e) => e.kind === 'image')!
    render(Inspector, { slide: base, element: el, theme: 'dark', onslide: vi.fn() })
    expect(screen.getByText(/Replace it with a link to publish/)).toBeInTheDocument()
    expect((screen.getByLabelText('Image URL') as HTMLInputElement).value).toBe('')
  })
})
