import { describe, expect, it } from 'vitest'
import { safeImageSrc, validateDeck, DeckError } from '$lib/deck/validate'
import { makeDeck, makeSlide, publicDeck } from '$lib/deck/factory'

describe('validateDeck', () => {
  it('accepts a generated deck and strips share info', () => {
    const d = makeDeck('T', 'nord', [
      makeSlide({
        title: 'a',
        body: 'b',
        images: [{ src: 'https://upload.wikimedia.org/a.jpg', alt: '' }],
      }),
    ])
    const withShare = { ...d, share: { id: 'x', token: 't', expiresAt: '', publishedAt: '' } }
    const v = validateDeck(JSON.parse(JSON.stringify(withShare)))
    expect(v).toEqual(publicDeck(d, { notes: true }))
    expect('share' in v).toBe(false)
  })
  it.each([
    ['javascript:alert(1)'],
    ['data:image/svg+xml;base64,PHN2Zz4='],
    ['data:text/html;base64,AA=='],
    ['photo.jpg'],
  ])('rejects unsafe image src %s, even on the legacy path', (src) => {
    const d = makeDeck('T', 'dark', [makeSlide({ images: [{ src: 'https://ok/x.png', alt: '' }] })])
    ;(d.slides[0].elements[0] as { src: string }).src = src
    const json = JSON.parse(JSON.stringify(d))
    expect(() => validateDeck(json)).toThrow(DeckError)
    expect(() => validateDeck(json, { allowDataImages: true })).toThrow(DeckError)
  })

  describe('embedded (data:) images', () => {
    const legacy = () =>
      JSON.parse(
        JSON.stringify(
          makeDeck('T', 'dark', [
            makeSlide({ title: 'one' }),
            makeSlide({ images: [{ src: 'data:image/png;base64,AA==', alt: 'old' }] }),
          ]),
        ),
      )

    it('are refused by default (the server path) with a message naming the slide', () => {
      expect(() => validateDeck(legacy())).toThrow(
        /^Slide 2 has an uploaded image\. .*https:\/\/ image link/,
      )
    })

    it('still load on the legacy local path', () => {
      const v = validateDeck(legacy(), { allowDataImages: true })
      expect(v.slides[1].content.images[0].src).toBe('data:image/png;base64,AA==')
    })

    it('safeImageSrc accepts http(s) links and caps their length', () => {
      expect(safeImageSrc('http://a.org/x.png', 'p')).toBe('http://a.org/x.png')
      expect(() => safeImageSrc('https://a.org/' + 'x'.repeat(5000), 'p')).toThrow(DeckError)
    })
  })
  it('rejects unknown themes and empty decks', () => {
    const d = makeDeck()
    expect(() => validateDeck({ ...d, theme: 'pink' })).toThrow(DeckError)
    expect(() => validateDeck({ ...d, slides: [] })).toThrow(DeckError)
  })
})
