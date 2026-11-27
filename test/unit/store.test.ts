import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readdir, rm, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore, StoreError } from '$lib/server/store'
import { makeDeck } from '$lib/deck/factory'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'slidessoca-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const mk = (max = 10_000_000) => createStore({ dir, ttlDays: 30, maxStoreBytes: max })

describe('deck store', () => {
  it('publishes, reads, updates with the token and expires in 30 days', async () => {
    const s = mk()
    const deck = makeDeck('A')
    const p = await s.publish(deck)
    expect(p.id).toMatch(/^[\w-]{10}$/)
    const days = (Date.parse(p.expiresAt) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    expect((await s.get(p.id))?.deck.title).toBe('A')
    await s.update(p.id, p.token, { ...deck, title: 'B' })
    expect((await s.get(p.id))?.deck.title).toBe('B')
  })

  it('refuses updates and deletes with a wrong token', async () => {
    const s = mk()
    const p = await s.publish(makeDeck())
    await expect(s.update(p.id, 'nope', makeDeck())).rejects.toMatchObject({ status: 403 })
    await expect(s.delete(p.id, 'nope')).rejects.toBeInstanceOf(StoreError)
    await s.delete(p.id, p.token)
    expect(await s.get(p.id)).toBeNull()
  })

  it('treats expired decks as gone and sweeps them', async () => {
    const s = mk()
    const a = await s.publish(makeDeck())
    const b = await s.publish(makeDeck())
    const past = new Date(Date.now() - 1000)
    await utimes(join(dir, 'decks', `${a.id}.json.gz`), past, past)
    expect(await s.get(a.id)).toBeNull()
    await utimes(join(dir, 'decks', `${b.id}.json.gz`), past, past)
    expect(await s.sweep()).toBe(1)
    expect(await readdir(join(dir, 'decks'))).toEqual([])
  })

  it('rejects ids that are not ours (no path traversal)', async () => {
    expect(await mk().get('../../etc/passwd')).toBeNull()
  })

  it('enforces the store quota', async () => {
    const s = mk(50)
    await expect(s.publish(makeDeck())).rejects.toMatchObject({ status: 507 })
  })
})
