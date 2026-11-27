import { describe, expect, it } from 'vitest'
import { validateDeck, DeckError } from '$lib/deck/validate'
import { makeDeck, makeSlide, publicDeck } from '$lib/deck/factory'

describe('validateDeck', () => {
  it('accepts a generated deck and strips share info', () => {
    const d = makeDeck('T', 'nord', [
      makeSlide({
        title: 'a',
        body: 'b',
        images: [{ src: 'data:image/png;base64,AA==', alt: '' }],
      }),
    ])
    const withShare = { ...d, share: { id: 'x', token: 't', expiresAt: '', publishedAt: '' } }
    const v = validateDeck(JSON.parse(JSON.stringify(withShare)))
    expect(v).toEqual(publicDeck(d))
    expect('share' in v).toBe(false)
  })
  it.each([
    ['javascript:alert(1)'],
    ['data:image/svg+xml;base64,PHN2Zz4='],
    ['data:text/html;base64,AA=='],
  ])('rejects unsafe image src %s', (src) => {
    const d = makeDeck('T', 'dark', [makeSlide({ images: [{ src: 'https://ok/x.png', alt: '' }] })])
    ;(d.slides[0].elements[0] as { src: string }).src = src
    expect(() => validateDeck(JSON.parse(JSON.stringify(d)))).toThrow(DeckError)
  })
  it('rejects unknown themes and empty decks', () => {
    const d = makeDeck()
    expect(() => validateDeck({ ...d, theme: 'pink' })).toThrow(DeckError)
    expect(() => validateDeck({ ...d, slides: [] })).toThrow(DeckError)
  })
})
