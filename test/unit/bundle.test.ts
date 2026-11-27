import { describe, expect, it } from 'vitest'
import { deckToBundle, deckToJson, importDeckJson, slugify } from '$lib/deck/bundle'
import { makeDeck, makeSlide } from '$lib/deck/factory'
import { parseMarkdown, parsedToDeck } from '$lib/deck/markdown'
import { DeckError } from '$lib/deck/validate'
import { bytesToDataUrl } from '$lib/deck/zip'

const png = bytesToDataUrl(new Uint8Array([137, 80, 78, 71]), 'image/png')
const webp = bytesToDataUrl(new Uint8Array([82, 73, 70, 70]), 'image/webp')

function deck() {
  return makeDeck('My: talk', 'light', [
    makeSlide({ title: 'Cover', subtitle: 'sub' }),
    makeSlide({
      title: 'Pics',
      images: [
        { src: png, alt: 'a' },
        { src: webp, alt: 'b' },
      ],
    }),
    makeSlide({ title: 'Again', body: 'x', images: [{ src: png, alt: 'same' }] }),
    makeSlide({ title: 'Remote', body: 'y', images: [{ src: 'https://e.com/r.png', alt: 'r' }] }),
  ])
}

describe('deckToBundle', () => {
  it('writes deck.md plus one file per embedded image', () => {
    const files = deckToBundle(deck())
    expect(files.map((f) => f.name)).toEqual([
      'deck.md',
      'images/slide-2-1.png',
      'images/slide-2-2.webp',
    ])
    const md = new TextDecoder().decode(files[0].data)
    expect(md).toContain('![a](images/slide-2-1.png)')
    expect(md).toContain('![same](images/slide-2-1.png)')
    expect(md).toContain('![r](https://e.com/r.png)')
  })

  it('round-trips through parseMarkdown with the files as assets', () => {
    const d = deck()
    const [md, ...imgs] = deckToBundle(d)
    const assets = Object.fromEntries(
      imgs.map((f) => [f.name, f.name.endsWith('png') ? png : webp]),
    )
    const p = parseMarkdown(new TextDecoder().decode(md.data), assets)
    expect(p.missing).toEqual([])
    expect(p.title).toBe('My: talk')
    expect(p.theme).toBe('light')
    const again = parsedToDeck(p)
    expect(again.slides.map((s) => s.content)).toEqual(d.slides.map((s) => s.content))
    expect(again.slides.map((s) => s.layout)).toEqual(d.slides.map((s) => s.layout))
  })
})

describe('JSON import', () => {
  it('validates and gives the deck a new local id without share data', () => {
    const d = { ...deck(), share: { id: 's', token: 't', expiresAt: '', publishedAt: '' } }
    const json = deckToJson(d)
    expect(json).not.toContain('"token"')
    const back = importDeckJson(json)
    expect(back.id).not.toBe(d.id)
    expect(back.share).toBeUndefined()
    expect(back.slides).toHaveLength(4)
    expect(back.title).toBe('My: talk')
  })

  it('rejects junk', () => {
    expect(() => importDeckJson('{"v":1}')).toThrow(DeckError)
    expect(() => importDeckJson('not json')).toThrow(SyntaxError)
  })
})

it('slugify', () => {
  expect(slugify('Café: Ünïcode talk!')).toBe('cafe-unicode-talk')
  expect(slugify('!!!')).toBe('deck')
})
