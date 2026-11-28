import { describe, expect, it, vi } from 'vitest'
import { copyDeck, makeDeck, makeSlide, publicDeck } from '$lib/deck/factory'
import { deckToJson } from '$lib/deck/bundle'
import { DECK_MAX_MB, MB } from '$lib/deck/limits'
import { hasFiles, imageFromTransfer, transferredUrl } from '$lib/client/images'
import { LINKS_ONLY_MESSAGE } from '$lib/deck/images'
import { readImportFiles } from '$lib/client/import'
import { publishBody } from '$lib/client/share'
import { config } from '$lib/server/instance'
import type { Deck } from '$lib/deck/types'

const withNotes = (): Deck => ({
  ...makeDeck('Talk', 'dark', [
    makeSlide({ title: 'One' }, 'secret note one'),
    makeSlide({ title: 'Two' }, 'secret note two'),
  ]),
  share: { id: 'x', token: 'tok', expiresAt: '', publishedAt: '' },
  publishNotes: true,
})

describe('publicDeck', () => {
  it('strips speaker notes by default, keeps everything else', () => {
    const d = withNotes()
    const out = publicDeck(d)
    expect(out.slides.map((s) => s.notes)).toEqual(['', ''])
    expect(out.slides.map((s) => s.content.title)).toEqual(['One', 'Two'])
    // The local deck is untouched.
    expect(d.slides[0].notes).toBe('secret note one')
  })

  it('keeps notes when asked', () => {
    expect(publicDeck(withNotes(), { notes: true }).slides[1].notes).toBe('secret note two')
  })

  it('never carries private fields (share token, notes choice)', () => {
    const out = publicDeck(withNotes(), { notes: true })
    expect('share' in out).toBe(false)
    expect('publishNotes' in out).toBe(false)
    expect('publishNotes' in copyDeck(withNotes())).toBe(false)
  })

  it('JSON export (a backup) keeps notes but not private fields', () => {
    const j = JSON.parse(deckToJson(withNotes()))
    expect(j.slides[0].notes).toBe('secret note one')
    expect(j.share).toBeUndefined()
    expect(j.publishNotes).toBeUndefined()
  })
})

describe('publishBody', () => {
  it('follows the deck’s remembered choice and never contains the flag or token', () => {
    const on = publishBody(withNotes())
    expect(on).toContain('secret note one')
    const off = publishBody({ ...withNotes(), publishNotes: false })
    expect(off).not.toContain('secret note')
    expect(publishBody({ ...withNotes(), publishNotes: undefined })).not.toContain('secret note')
    for (const b of [on, off]) {
      expect(b).not.toContain('publishNotes')
      expect(b).not.toContain('tok')
      expect(JSON.parse(b).deck.title).toBe('Talk')
    }
  })
})

describe('limits', () => {
  it('server default is the shared constant: 1 MB, decks are text (images are links)', () => {
    expect(DECK_MAX_MB).toBe(1)
    expect(config.maxDeckBytes).toBe(DECK_MAX_MB * MB)
  })
})

describe('images are links: drops and pastes', () => {
  const transfer = (data: Record<string, string>, files: File[] = []) => ({
    getData: (t: string) => data[t] ?? '',
    files,
    items: files.map(() => ({ kind: 'file' as const })),
  })
  const png = new File([new Uint8Array(4)], 'cat.png', { type: 'image/png' })

  it('a dropped image file gives the links-only toast, never a silent no-op', () => {
    const notify = vi.fn()
    expect(imageFromTransfer(transfer({}, [png]), notify)).toBeNull()
    expect(notify).toHaveBeenCalledWith(LINKS_ONLY_MESSAGE)
    expect(hasFiles(transfer({}, [png]))).toBe(true)
  })

  it('a dragged web image gives its link (and no toast)', () => {
    const notify = vi.fn()
    const dt = transfer({ 'text/uri-list': '# comment\nhttps://upload.wikimedia.org/a.jpg' }, [png])
    expect(imageFromTransfer(dt, notify)).toBe('https://upload.wikimedia.org/a.jpg')
    expect(notify).not.toHaveBeenCalled()
  })

  it('plain text that is not a link is ignored quietly', () => {
    const notify = vi.fn()
    expect(transferredUrl(transfer({ 'text/plain': 'hello' }))).toBeNull()
    expect(imageFromTransfer(transfer({ 'text/plain': 'hello' }), notify)).toBeNull()
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('Markdown / zip import', () => {
  it('takes the .md and reports image files without embedding them', async () => {
    const md = new File(['# Hi'], 'deck.md', { type: 'text/markdown' })
    const res = await readImportFiles([md, png(), new File(['x'], 'notes.pdf')])
    expect(res.markdown?.name).toBe('deck.md')
    expect(res.images).toEqual(['photo.jpg'])
    expect(res.skipped).toEqual(['notes.pdf'])
  })
})

const png = () => new File([new Uint8Array(8)], 'photo.jpg', { type: 'image/jpeg' })
