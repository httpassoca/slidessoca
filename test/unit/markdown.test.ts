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
    const p = parseMarkdown(SAMPLE)
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

  it('honours layout overrides and keeps https image links', () => {
    const p = parseMarkdown(SAMPLE)
    expect(p.slides[2].layout).toBe('image-left')
    expect(p.slides[4].content.images).toEqual([
      { src: 'https://example.com/a.png', alt: 'a' },
      { src: 'https://example.com/b.png', alt: 'b' },
    ])
  })

  it('does not embed local or data: images: one warning per image asks for an https link', () => {
    const p = parseMarkdown(SAMPLE + '\n---\n\n## Inline\n![x](data:image/png;base64,AAAA)\n')
    expect(p.slides[2].content.images).toEqual([])
    expect(p.missing).toEqual(['./Cat.PNG', 'data:image/png;base64,AAAA'])
    expect(p.warnings).toEqual([
      'Slide 3: ./Cat.PNG is not a link, use a full https link to the image',
      'Slide 6: data:image/png;base64,AAAA is not a link, use a full https link to the image',
    ])
    expect(parseMarkdown('# Hi\n![a](https://x.org/a.png)').warnings).toEqual([])
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
    const d = parsedToDeck(parseMarkdown(SAMPLE))
    const again = parsedToDeck(parseMarkdown(deckToMarkdown(d)))
    expect(again.slides.map((s) => s.content)).toEqual(d.slides.map((s) => s.content))
    expect(again.slides.map((s) => s.layout)).toEqual(d.slides.map((s) => s.layout))
  })
})
