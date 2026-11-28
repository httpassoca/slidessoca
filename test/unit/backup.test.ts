import { describe, expect, it } from 'vitest'
import {
  backupEntries,
  backupFileName,
  backupStatus,
  buildBackupZip,
  decksFromBackup,
  needsBackup,
  timeAgo,
} from '$lib/deck/backup'
import { makeDeck, makeSlide } from '$lib/deck/factory'
import { unzip } from '$lib/deck/zip'

const enc = (s: string) => new TextEncoder().encode(s)

function decks() {
  const a = makeDeck('Talk', 'light', [makeSlide({ title: 'One', body: 'x' })])
  a.share = {
    id: 'abc',
    token: 'secret-token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    publishedAt: '2026-11-01T00:00:00.000Z',
  }
  const b = makeDeck('Talk', 'dark')
  const c = makeDeck('Ünïcode / deck', 'dark')
  return [a, b, c]
}

describe('backup zip', () => {
  it('names the file by local date', () => {
    expect(backupFileName(new Date(2026, 10, 8, 23, 59))).toBe('slidessoca-backup-2026-11-08.zip')
  })

  it('writes one unique .slidessoca.json per deck', () => {
    const names = backupEntries(decks()).map((e) => e.name)
    expect(new Set(names).size).toBe(3)
    expect(names[0]).toBe('talk.slidessoca.json')
    expect(names[1]).toBe('talk-2.slidessoca.json')
    for (const n of names) expect(n).toMatch(/\.slidessoca\.json$/)
  })

  it('round-trips every deck through the zip, without share tokens', async () => {
    const src = decks()
    const restored = decksFromBackup(await unzip(buildBackupZip(src)))
    expect(restored.skipped).toEqual([])
    expect(restored.decks.map((d) => d.title)).toEqual(src.map((d) => d.title))
    expect(restored.decks.map((d) => d.theme)).toEqual(src.map((d) => d.theme))
    expect(restored.decks[0].slides).toEqual(src[0].slides)
    // Fresh ids (restoring never overwrites), original timestamps, no edit token.
    restored.decks.forEach((d, i) => {
      expect(d.id).not.toBe(src[i].id)
      expect(d.updatedAt).toBe(src[i].updatedAt)
      expect(d.share).toBeUndefined()
    })
    expect(JSON.stringify(restored.decks)).not.toContain('secret-token')
  })

  it('skips non-deck entries and archive litter, rejects a zip with no decks', () => {
    const [good] = backupEntries(decks())
    const r = decksFromBackup([
      good,
      { name: 'notes.txt', data: enc('hi') },
      { name: 'broken.json', data: enc('{nope') },
      { name: 'other.json', data: enc('{"a":1}') },
      { name: '__MACOSX/._talk.slidessoca.json', data: enc('x') },
      { name: '.DS_Store', data: enc('x') },
    ])
    expect(r.decks).toHaveLength(1)
    expect(r.skipped).toEqual(['notes.txt', 'broken.json', 'other.json'])
    expect(() => decksFromBackup([{ name: 'notes.txt', data: enc('hi') }])).toThrow(/No slidessoca/)
  })
})

describe('needsBackup', () => {
  const at = (updatedAt: string) => ({ updatedAt })
  it('is false without decks', () => {
    expect(needsBackup([], null)).toBe(false)
  })
  it('is true when never backed up', () => {
    expect(needsBackup([at('2026-11-01T00:00:00Z')], null)).toBe(true)
    expect(needsBackup([at('2026-11-01T00:00:00Z')], 'garbage')).toBe(true)
  })
  it('is true only when a deck changed after the last backup', () => {
    const last = '2026-11-10T12:00:00.000Z'
    expect(needsBackup([at('2026-11-01T00:00:00Z'), at('2026-11-10T12:00:00Z')], last)).toBe(false)
    expect(needsBackup([at('2026-11-01T00:00:00Z'), at('2026-11-10T12:00:01Z')], last)).toBe(true)
  })
})

describe('timeAgo / backupStatus', () => {
  const now = Date.parse('2026-11-28T12:00:00Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()
  const min = 60_000
  const day = 86_400_000
  it('reads naturally', () => {
    expect(timeAgo(ago(10_000), now)).toBe('just now')
    expect(timeAgo(ago(-5 * min), now)).toBe('just now') // clock skew
    expect(timeAgo(ago(1 * min), now)).toBe('1 minute ago')
    expect(timeAgo(ago(59 * min), now)).toBe('59 minutes ago')
    expect(timeAgo(ago(60 * min), now)).toBe('1 hour ago')
    expect(timeAgo(ago(23 * 60 * min), now)).toBe('23 hours ago')
    expect(timeAgo(ago(day), now)).toBe('yesterday')
    expect(timeAgo(ago(3 * day), now)).toBe('3 days ago')
    expect(timeAgo(ago(7 * day), now)).toBe('1 week ago')
    expect(timeAgo(ago(20 * day), now)).toBe('2 weeks ago')
    expect(timeAgo(ago(45 * day), now)).toBe('1 month ago')
    expect(timeAgo(ago(800 * day), now)).toBe('2 years ago')
    expect(timeAgo('nonsense', now)).toBe('some time ago')
  })
  it('builds the status line', () => {
    expect(backupStatus(null, now)).toBe('Never backed up')
    expect(backupStatus(ago(3 * day), now)).toBe('Last backup 3 days ago')
  })
})
