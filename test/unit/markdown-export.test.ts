import { describe, expect, it } from 'vitest'
import { deckToMarkdown, parseMarkdown, parsedToDeck } from '$lib/deck/markdown'
import { makeDeck, makeSlide } from '$lib/deck/factory'

describe('front matter', () => {
  it('strips # comments from unquoted values (the spec example has them)', () => {
    const p = parseMarkdown('---\ntitle: My talk # deck title\ntheme: nord # a theme\n---\n# A')
    expect(p.title).toBe('My talk')
    expect(p.theme).toBe('nord')
    const q = parseMarkdown('---\ntitle: "Issue #4: it\'s fine"\n---\n# A')
    expect(q.title).toBe("Issue #4: it's fine")
  })
})

describe('deckToMarkdown', () => {
  it('keeps layouts that auto-layout would not pick, and only those', () => {
    const d = makeDeck('T', 'dark', [
      makeSlide({ title: 'Part', subtitle: 'two' }, '', 'section'),
      makeSlide({ title: 'List', body: '- a' }, '', 'quote'),
      makeSlide({ title: 'Cover', subtitle: 'sub' }, '', 'title'),
      makeSlide({ title: 'Plain', body: '- b' }),
    ])
    const md = deckToMarkdown(d)
    expect(md).toContain('<!-- layout: section -->')
    expect(md).not.toContain('<!-- layout: title -->')
    expect(md).not.toContain('<!-- layout: bullets -->')
    const again = parsedToDeck(parseMarkdown(md))
    expect(again.slides.map((s) => s.layout)).toEqual(['section', 'quote', 'title', 'bullets'])
  })

  it('does not let a --- line in a body split the slide', () => {
    const d = makeDeck('T', 'dark', [makeSlide({ title: 'A', body: 'one\n---\ntwo' })])
    expect(parseMarkdown(deckToMarkdown(d)).slides).toHaveLength(1)
  })

  it('quotes deck titles that would read as comments', () => {
    const d = makeDeck('Talk #3', 'dark')
    expect(parseMarkdown(deckToMarkdown(d)).title).toBe('Talk #3')
  })
})
