import { describe, expect, it } from 'vitest'
import { blockToSlide, blocksToSlides, quickDeck, splitQuickText } from '$lib/deck/quick'

const img = { src: 'data:image/webp;base64,AAAA', alt: 'cat' }

describe('splitQuickText', () => {
  it('splits slides on empty lines; first line is the title', () => {
    expect(splitQuickText('My talk\nby me\n\nAgenda\n- one\n- two\n\n\nThanks')).toEqual([
      { title: 'My talk', text: 'by me', images: [] },
      { title: 'Agenda', text: '- one\n- two', images: [] },
      { title: 'Thanks', text: '', images: [] },
    ])
  })

  it('switches to --- separators when there is one, keeping paragraphs together', () => {
    const blocks = splitQuickText('# Cover\nsub\n---\nStory\nPara one.\n\nPara two.\n---\n')
    expect(blocks).toEqual([
      { title: 'Cover', text: 'sub', images: [] },
      { title: 'Story', text: 'Para one.\n\nPara two.', images: [] },
    ])
  })

  it('a slide that starts with a quote or a list has no title line', () => {
    expect(splitQuickText('> Be brief.\n> — Me\n\n- a\n- b')).toEqual([
      { title: '', text: '> Be brief.\n> — Me', images: [] },
      { title: '', text: '- a\n- b', images: [] },
    ])
    const [q] = splitQuickText('Intro\n\n> Be brief.\n> — Me').slice(1)
    expect(blockToSlide(q, 1).layout).toBe('quote')
  })

  it('handles CRLF and blank input', () => {
    expect(splitQuickText('A\r\nb\r\n\r\nC')).toHaveLength(2)
    expect(splitQuickText('  \n\n ')).toEqual([])
  })
})

describe('blockToSlide', () => {
  it('makes the first block a cover when it has one line of text', () => {
    const s = blockToSlide({ title: 'Hello', text: 'world', images: [] }, 0)
    expect(s.layout).toBe('title')
    expect(s.content).toMatchObject({ title: 'Hello', subtitle: 'world', body: '' })
  })

  it('later blocks are bullets / sections', () => {
    expect(blockToSlide({ title: 'Agenda', text: '- a\n- b', images: [] }, 1).layout).toBe(
      'bullets',
    )
    expect(blockToSlide({ title: 'Part two', text: '', images: [] }, 2).layout).toBe('section')
  })

  it('places dropped images', () => {
    expect(blockToSlide({ title: 'Pic', text: 'look', images: [img] }, 1).layout).toBe(
      'image-right',
    )
    expect(blockToSlide({ title: 'Pic', text: '', images: [img] }, 1).layout).toBe('image-full')
    expect(blockToSlide({ title: '', text: '', images: [img, img] }, 1).layout).toBe('gallery')
    // A cover with an image is not a bare title slide.
    expect(blockToSlide({ title: 'Hi', text: 'sub', images: [img] }, 0).layout).not.toBe('title')
  })

  it('reads quotes, notes and layout overrides from the text', () => {
    const q = blockToSlide({ title: '', text: '> Be brief.\n> — Me', images: [] }, 1)
    expect(q.layout).toBe('quote')
    expect(q.content.quote).toEqual({ text: 'Be brief.', cite: 'Me' })
    const n = blockToSlide({ title: 'T', text: '- x\nNote:\nsay it', images: [] }, 1)
    expect(n.notes).toBe('say it')
    expect(n.content.body).toBe('- x')
    const o = blockToSlide(
      { title: 'T', text: '<!-- layout: image-left -->\nside', images: [img] },
      1,
    )
    expect(o.layout).toBe('image-left')
  })
})

describe('quickDeck', () => {
  it('skips empty blocks and names the deck', () => {
    const d = quickDeck('  ', 'nord', [
      { title: 'First', text: '', images: [] },
      { title: '', text: '', images: [] },
      { title: 'Second', text: 'x', images: [] },
    ])
    expect(d.title).toBe('First')
    expect(d.theme).toBe('nord')
    expect(d.slides).toHaveLength(2)
    expect(blocksToSlides([])).toEqual([])
  })

  it('an empty form still makes a one-slide deck', () => {
    const d = quickDeck('Empty', 'dark', [])
    expect(d.slides).toHaveLength(1)
    expect(d.title).toBe('Empty')
  })
})
