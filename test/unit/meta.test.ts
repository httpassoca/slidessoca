import { describe, expect, it } from 'vitest'
import { copyDeck, makeDeck, makeSlide } from '$lib/deck/factory'
import { deckDescription, slideText, truncate } from '$lib/deck/meta'

describe('slideText / deckDescription', () => {
  it('describes a deck by slide count and first slide text', () => {
    const d = makeDeck('Quarterly', 'dark', [
      makeSlide({ title: 'Q3 **results**', subtitle: 'Growth everywhere' }, '', 'title'),
      makeSlide({ title: 'Next' }),
    ])
    expect(slideText(d.slides[0])).toBe('Q3 results · Growth everywhere')
    expect(deckDescription(d)).toBe('2 slides — Q3 results · Growth everywhere')
  })

  it('handles a single empty slide', () => {
    const d = makeDeck('Empty', 'dark', [makeSlide({}, '', 'blank')])
    expect(deckDescription(d)).toBe('1 slide')
  })

  it('truncates on a word boundary', () => {
    expect(truncate('short', 10)).toBe('short')
    const t = truncate('one two three four five six seven', 20)
    expect(t.length).toBeLessThanOrEqual(20)
    expect(t.endsWith('…')).toBe(true)
    expect(t).toBe('one two three four…')
  })
})

describe('copyDeck', () => {
  it('gets a fresh id, drops the share and keeps the content', () => {
    const d = {
      ...makeDeck('Shared'),
      share: { id: 'abcdefghij', token: 't', expiresAt: 'x', publishedAt: 'y' },
    }
    const c = copyDeck(d, new Date('2026-11-27T10:00:00Z'))
    expect(c.id).not.toBe(d.id)
    expect(c.share).toBeUndefined()
    expect('share' in c).toBe(false)
    expect(c.title).toBe('Shared')
    expect(c.slides).toEqual(d.slides)
    expect(c.slides).not.toBe(d.slides)
    expect(c.createdAt).toBe('2026-11-27T10:00:00.000Z')
  })
})
