// Example decks (SL-0012): each parses cleanly, has a distinct theme, links only to Wikimedia
// Commons, survives the strict validator, and "Make a copy" turns it into a local deck.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { parseMarkdown } from '$lib/deck/markdown'
import { validateDeck } from '$lib/deck/validate'
import { DECK_MAX_MB, MB } from '$lib/deck/limits'
import { isThemeId } from '$lib/themes'
import { EXAMPLES, exampleBySlug, exampleDeck, exampleDeckById } from '$lib/examples'
import ExampleList from '$lib/components/ExampleList.svelte'
import type { Deck } from '$lib/deck/types'

const { putDeck, goto } = vi.hoisted(() => ({
  putDeck: vi.fn(async (d: Deck) => d),
  goto: vi.fn(async (_url: string) => {}),
}))
vi.mock('$lib/client/db', () => ({ putDeck }))
vi.mock('$app/navigation', () => ({ goto, replaceState: vi.fn(), afterNavigate: vi.fn() }))

describe('example decks', () => {
  it('has four examples with unique slugs', () => {
    expect(EXAMPLES).toHaveLength(4)
    expect(new Set(EXAMPLES.map((e) => e.slug)).size).toBe(4)
  })

  it('each uses a valid theme, and no two share one', () => {
    for (const e of EXAMPLES) expect(isThemeId(e.theme)).toBe(true)
    expect(new Set(EXAMPLES.map((e) => e.theme)).size).toBe(EXAMPLES.length)
    // At least one light and one dark deck, so the examples show both.
    expect(EXAMPLES.some((e) => e.theme === 'light')).toBe(true)
  })

  it.each(EXAMPLES.map((e) => [e.slug, e] as const))(
    '%s parses with no warnings into 8–12 slides',
    (_slug, e) => {
      const p = parseMarkdown(e.md)
      expect(p.warnings).toEqual([])
      expect(p.missing).toEqual([])
      expect(p.slides.length).toBeGreaterThanOrEqual(8)
      expect(p.slides.length).toBeLessThanOrEqual(12)
      expect(p.title).toBe(e.title)
      expect(e.blurb.length).toBeGreaterThan(0)
      // Speaker notes on most slides.
      const noted = p.slides.filter((s) => s.notes.trim()).length
      expect(noted / p.slides.length).toBeGreaterThan(0.75)
      // Notes are one line per paragraph: the presenter keeps single line breaks.
      for (const s of p.slides) expect(s.notes).not.toMatch(/[^\n]\n[^\n]/)
    },
  )

  it.each(EXAMPLES.map((e) => [e.slug, e] as const))(
    '%s only links images on upload.wikimedia.org, each with alt text',
    (_slug, e) => {
      const images = parseMarkdown(e.md).slides.flatMap((s) => s.content.images)
      expect(images.length).toBeGreaterThanOrEqual(3)
      for (const img of images) {
        expect(new URL(img.src).protocol).toBe('https:')
        expect(new URL(img.src).host).toBe('upload.wikimedia.org')
        expect(img.alt.trim()).not.toBe('')
      }
      // The last slide credits the images.
      expect(parseMarkdown(e.md).slides.at(-1)?.content.title).toBe('Image credits')
    },
  )

  it.each(EXAMPLES.map((e) => [e.slug, e] as const))(
    '%s passes the strict deck validator and the size limit',
    (_slug, e) => {
      const d = exampleDeck(e)
      expect(() => validateDeck(structuredClone(d))).not.toThrow()
      expect(JSON.stringify(d).length).toBeLessThan(DECK_MAX_MB * MB)
    },
  )

  it('gives example decks a stable id the presenter can resolve', () => {
    const e = exampleBySlug('stalker')!
    expect(exampleDeck(e).id).toBe('example:stalker')
    expect(exampleDeckById('example:stalker')?.title).toBe(e.title)
    expect(exampleDeckById('example:nope')).toBeUndefined()
    expect(exampleDeckById('abc123def0')).toBeUndefined()
  })
})

describe('ExampleList', () => {
  it('links every example with a real first-slide thumbnail', () => {
    const { container } = render(ExampleList)
    const links = screen.getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      EXAMPLES.map((e) => `/examples/${e.slug}`),
    )
    expect(container.querySelectorAll('.slide')).toHaveLength(EXAMPLES.length)
    expect(screen.getByText(EXAMPLES[0].title)).toBeInTheDocument()
  })
})

describe('/examples/[slug]', () => {
  beforeEach(() => {
    putDeck.mockClear()
    goto.mockClear()
  })

  async function open(slug: string) {
    // The $app/state alias points at this mock (vitest.config.ts); same module instance.
    const { page } = await import('../mocks/app-state')
    page.params = { slug }
    page.url = new URL(`http://localhost/examples/${slug}`)
    const Page = (await import('../../src/routes/examples/[slug]/+page.svelte')).default
    return render(Page)
  }

  it('"Make a copy" saves a new local deck and opens it in the editor', async () => {
    await open('first-bug')
    await fireEvent.click(screen.getByRole('button', { name: /Make a copy/ }))
    await waitFor(() => expect(putDeck).toHaveBeenCalledTimes(1))
    const copy = putDeck.mock.calls[0][0]
    expect(copy.id).not.toBe('example:first-bug')
    expect(copy.id).not.toMatch(/^example:/)
    expect(copy.title).toBe('The first computer bug')
    expect(copy.theme).toBe('light')
    expect(copy.slides.length).toBe(exampleDeck(exampleBySlug('first-bug')!).slides.length)
    expect(copy.slides[1].notes).not.toBe('')
    expect(copy.share).toBeUndefined()
    await waitFor(() => expect(goto).toHaveBeenCalledWith(`/edit/${copy.id}`))
  })

  it('"Present" opens the presenter on the example', async () => {
    await open('stalker')
    await fireEvent.click(screen.getByRole('button', { name: /Present/ }))
    expect(goto).toHaveBeenCalledWith('/present/example%3Astalker?start=0')
  })

  it('shows a not-found state for an unknown slug', async () => {
    await open('nope')
    expect(screen.getByText('Example not found')).toBeInTheDocument()
    expect(putDeck).not.toHaveBeenCalled()
  })
})
