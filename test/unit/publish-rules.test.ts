import { describe, expect, it, vi } from 'vitest'
import { copyDeck, makeDeck, makeSlide, publicDeck } from '$lib/deck/factory'
import { deckToJson } from '$lib/deck/bundle'
import {
  byteLength,
  DECK_MAX_MB,
  DECK_WARN_MB,
  formatMb,
  IMAGE_FILE_MAX_MB,
  MB,
  sizeLevel,
} from '$lib/deck/limits'
import {
  acceptImages,
  checkImageFile,
  checkImageSize,
  IMAGE_FILE_MAX_BYTES,
  IMAGE_TYPE_MESSAGE,
} from '$lib/client/images'
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
  it('server default is the shared constant', () => {
    expect(DECK_MAX_MB).toBe(15)
    expect(DECK_WARN_MB).toBe(12)
    expect(IMAGE_FILE_MAX_MB).toBe(20)
    expect(config.maxDeckBytes).toBe(DECK_MAX_MB * MB)
  })

  it('measures UTF-8 bytes', () => {
    expect(byteLength('abc')).toBe(3)
    expect(byteLength('é')).toBe(2)
  })

  it('levels: ok below 12 MB, warn from 12 MB, blocked from 15 MB', () => {
    expect(sizeLevel(0)).toBe('ok')
    expect(sizeLevel(12 * MB - 1)).toBe('ok')
    expect(sizeLevel(12 * MB)).toBe('warn')
    expect(sizeLevel(15 * MB - 1)).toBe('warn')
    expect(sizeLevel(15 * MB)).toBe('blocked')
  })

  it('formats MB with one decimal', () => {
    expect(formatMb(4.2 * MB)).toBe('4.2 MB')
    expect(formatMb(0)).toBe('0.0 MB')
    expect(formatMb(300)).toBe('0.1 MB')
  })
})

describe('image file gate', () => {
  const file = (name: string, size: number, type = 'image/jpeg') => ({ name, size, type })

  it('accepts images up to 20 MB', () => {
    expect(IMAGE_FILE_MAX_BYTES).toBe(20 * MB)
    expect(checkImageFile(file('a.jpg', 20 * MB))).toBeNull()
  })

  it('refuses images over 20 MB by name', () => {
    expect(checkImageFile(file('huge.jpg', 20 * MB + 1))).toBe('huge.jpg is over 20 MB')
    expect(checkImageSize({ name: 'z.png', size: 21 * MB })).toBe('z.png is over 20 MB')
  })

  it('refuses non-images', () => {
    expect(checkImageFile(file('a.svg', 10, 'image/svg+xml'))).toBe(IMAGE_TYPE_MESSAGE)
  })

  it('acceptImages keeps the good files and reports each refusal', () => {
    const notify = vi.fn()
    const ok = acceptImages(
      [
        file('a.jpg', 10),
        file('big.png', 25 * MB, 'image/png'),
        file('b.txt', 1, 'text/plain'),
        file('c.svg', 1, 'image/svg+xml'),
      ],
      notify,
    )
    expect(ok.map((f) => f.name)).toEqual(['a.jpg'])
    expect(notify.mock.calls.map((c) => c[0])).toEqual([
      'big.png is over 20 MB',
      IMAGE_TYPE_MESSAGE,
    ])
  })

  it('Markdown / zip import skips oversized images before compressing them', async () => {
    const big = new File([new Uint8Array(20 * MB + 1)], 'photo.jpg', { type: 'image/jpeg' })
    const md = new File(['# Hi'], 'deck.md', { type: 'text/markdown' })
    const res = await readImportFiles([md, big])
    expect(res.markdown?.name).toBe('deck.md')
    expect(res.assets).toEqual({})
    expect(res.skipped).toEqual(['photo.jpg'])
    expect(res.tooLarge).toEqual(['photo.jpg is over 20 MB'])
  })
})
