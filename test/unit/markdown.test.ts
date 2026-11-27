import { describe, expect, it } from 'vitest'
import { deckToMarkdown, parseMarkdown, parsedToDeck, splitSlides } from '$lib/deck/markdown'

const SAMPLE = `---
title: My talk
theme: dracula
---

# Hello world
A subtitle

---

## Agenda
- one
- two

Note:
say hi

---

<!-- layout: image-left -->
## Photo
Some text
![cat](./Cat.PNG)

---

> Simplicity is prerequisite for reliability.
> — Dijkstra

---

![a](https://example.com/a.png)
![b](https://example.com/b.png)
`

describe('markdown format', () => {
  it('reads front matter', () => {
    const p = parseMarkdown(SAMPLE, { 'cat.png': 'data:image/png;base64,AAAA' })
    expect(p.title).toBe('My talk')
    expect(p.theme).toBe('dracula')
    expect(p.slides).toHaveLength(5)
  })

  it('turns # + one line into a title slide', () => {
    const [s] = parseMarkdown(SAMPLE).slides
    expect(s.layout).toBe('title')
    expect(s.content).toMatchObject({ title: 'Hello world', subtitle: 'A subtitle', body: '' })
  })

  it('splits notes and body', () => {
    const s = parseMarkdown(SAMPLE).slides[1]
    expect(s.content.title).toBe('Agenda')
    expect(s.content.body).toBe('- one\n- two')
    expect(s.notes).toBe('say hi')
  })

  it('honours layout overrides and resolves uploaded images case-insensitively', () => {
    const p = parseMarkdown(SAMPLE, { 'photos/cat.png': 'data:image/png;base64,AAAA' })
    expect(p.slides[2].layout).toBe('image-left')
    expect(p.slides[2].content.images[0]).toEqual({ src: 'data:image/png;base64,AAAA', alt: 'cat' })
    expect(p.missing).toEqual([])
  })

  it('reports missing images', () => {
    expect(parseMarkdown(SAMPLE).missing).toEqual(['./Cat.PNG'])
  })

  it('parses quotes with a cite', () => {
    expect(parseMarkdown(SAMPLE).slides[3].content.quote).toEqual({
      text: 'Simplicity is prerequisite for reliability.',
      cite: 'Dijkstra',
    })
  })

  it('ignores --- inside fenced code', () => {
    expect(splitSlides('a\n```\n---\n```\n---\nb')).toHaveLength(2)
  })

  it('builds a deck with auto layouts', () => {
    const d = parsedToDeck(parseMarkdown(SAMPLE))
    expect(d.slides.map((s) => s.layout)).toEqual([
      'title',
      'bullets',
      'image-left',
      'quote',
      'gallery',
    ])
    expect(d.theme).toBe('dracula')
  })

  it('round-trips content through deckToMarkdown', () => {
    const d = parsedToDeck(parseMarkdown(SAMPLE, { 'cat.png': 'data:image/png;base64,AAAA' }))
    const again = parsedToDeck(parseMarkdown(deckToMarkdown(d)))
    expect(again.slides.map((s) => s.content)).toEqual(d.slides.map((s) => s.content))
    expect(again.slides.map((s) => s.layout)).toEqual(d.slides.map((s) => s.layout))
  })
})
