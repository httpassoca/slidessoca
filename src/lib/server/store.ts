// Shared-deck storage: one gzipped JSON file per deck on the VPS disk (ADR 0001 — the cheapest
// store there is: the server is already paid for, no database, no object storage bill).
//
// Expiry trick: each file's mtime IS its expiry time. Publishing sets mtime = now + TTL; the
// sweeper deletes every file whose mtime is in the past. No index, no second file.

import { createHash, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { nanoid } from 'nanoid'
import type { Deck } from '../deck/types.js'

export interface StoreConfig {
  dir: string
  ttlDays: number
  maxStoreBytes: number
}

interface Record {
  deck: Deck
  tokenHash: string
  createdAt: string
  publishedAt: string
}

export interface Published {
  id: string
  token: string
  expiresAt: string
  publishedAt: string
}

export class StoreError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

const ID_RE = /^[A-Za-z0-9_-]{10}$/
const hash = (t: string) => createHash('sha256').update(t).digest('hex')

function sameHash(a: string, b: string) {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && timingSafeEqual(x, y)
}

export function createStore(cfg: StoreConfig) {
  const dir = join(cfg.dir, 'decks')
  const file = (id: string) => join(dir, `${id}.json.gz`)
  const ttlMs = cfg.ttlDays * 86_400_000
  let usedBytes = -1

  async function ensure() {
    await mkdir(dir, { recursive: true })
  }

  async function used(): Promise<number> {
    if (usedBytes >= 0) return usedBytes
    await ensure()
    let total = 0
    for (const f of await readdir(dir)) {
      try {
        total += (await stat(join(dir, f))).size
      } catch {
        /* raced with a delete */
      }
    }
    usedBytes = total
    return total
  }

  async function write(id: string, rec: Record, expires: Date, previousSize = 0) {
    const buf = gzipSync(JSON.stringify(rec))
    if ((await used()) - previousSize + buf.length > cfg.maxStoreBytes)
      throw new StoreError(507, 'Storage is full right now. Try again later.')
    await ensure()
    const tmp = `${file(id)}.${nanoid(6)}.tmp`
    await writeFile(tmp, buf)
    await utimes(tmp, new Date(), expires)
    await rename(tmp, file(id))
    usedBytes = (await used()) - previousSize + buf.length
  }

  async function readRecord(
    id: string,
  ): Promise<{ rec: Record; expiresAt: Date; size: number } | null> {
    if (!ID_RE.test(id)) return null
    try {
      const st = await stat(file(id))
      if (st.mtimeMs < Date.now()) {
        await remove(id)
        return null
      }
      const rec = JSON.parse(gunzipSync(await readFile(file(id))).toString('utf8')) as Record
      return { rec, expiresAt: st.mtime, size: st.size }
    } catch {
      return null
    }
  }

  async function remove(id: string) {
    try {
      const st = await stat(file(id))
      await rm(file(id), { force: true })
      if (usedBytes >= 0) usedBytes = Math.max(0, usedBytes - st.size)
    } catch {
      /* already gone */
    }
  }

  return {
    async publish(deck: Deck): Promise<Published> {
      const id = nanoid(10)
      const token = nanoid(32)
      const now = new Date()
      const expires = new Date(now.getTime() + ttlMs)
      await write(
        id,
        {
          deck,
          tokenHash: hash(token),
          createdAt: now.toISOString(),
          publishedAt: now.toISOString(),
        },
        expires,
      )
      return { id, token, expiresAt: expires.toISOString(), publishedAt: now.toISOString() }
    },

    async get(id: string): Promise<{ deck: Deck; expiresAt: string; publishedAt: string } | null> {
      const r = await readRecord(id)
      return (
        r && {
          deck: r.rec.deck,
          expiresAt: r.expiresAt.toISOString(),
          publishedAt: r.rec.publishedAt,
        }
      )
    },

    /** Republish under the same link; the month restarts from now. */
    async update(id: string, token: string, deck: Deck): Promise<Published> {
      const r = await readRecord(id)
      if (!r) throw new StoreError(404, 'This shared deck does not exist or has expired.')
      if (!sameHash(r.rec.tokenHash, hash(token)))
        throw new StoreError(403, 'Not allowed to update this deck.')
      const now = new Date()
      const expires = new Date(now.getTime() + ttlMs)
      await write(id, { ...r.rec, deck, publishedAt: now.toISOString() }, expires, r.size)
      return { id, token, expiresAt: expires.toISOString(), publishedAt: now.toISOString() }
    },

    async delete(id: string, token: string): Promise<void> {
      const r = await readRecord(id)
      if (!r) return
      if (!sameHash(r.rec.tokenHash, hash(token)))
        throw new StoreError(403, 'Not allowed to delete this deck.')
      await remove(id)
    },

    /** Delete every expired deck. Returns how many were removed. */
    async sweep(now = Date.now()): Promise<number> {
      await ensure()
      let n = 0
      for (const f of await readdir(dir)) {
        const p = join(dir, f)
        try {
          const st = await stat(p)
          const staleTmp = f.endsWith('.tmp') && st.ctimeMs < now - 3_600_000
          if (st.mtimeMs < now || staleTmp) {
            await rm(p, { force: true })
            n++
          }
        } catch {
          /* raced */
        }
      }
      usedBytes = -1
      return n
    },

    used,
  }
}

export type DeckStore = ReturnType<typeof createStore>
