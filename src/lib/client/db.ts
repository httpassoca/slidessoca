// Decks live in this browser's IndexedDB (localStorage's ~5 MB is too small once images are in).
// The server only ever holds *published* copies. Browser-only module.

import type { Deck } from '../deck/types.js'

const DB = 'slidessoca'
const STORE = 'decks'

export interface DeckSummary {
  id: string
  title: string
  theme: Deck['theme']
  slides: number
  updatedAt: string
  shared: boolean
  firstSlide: Deck['slides'][number] | undefined
}

let dbp: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const r = fn(t.objectStore(STORE))
        t.oncomplete = () => resolve(r.result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

export const getDeck = (id: string) => tx<Deck | undefined>('readonly', (s) => s.get(id))
export const putDeck = (d: Deck) =>
  tx('readwrite', (s) => s.put(JSON.parse(JSON.stringify(d)))).then(() => d)
export const deleteDeck = (id: string) => tx('readwrite', (s) => s.delete(id))

/** Every full deck (for "Back up all decks"), newest first. */
export async function allDecks(): Promise<Deck[]> {
  const all = await tx<Deck[]>('readonly', (s) => s.getAll())
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function listDecks(): Promise<DeckSummary[]> {
  const all = await tx<Deck[]>('readonly', (s) => s.getAll())
  return all
    .map((d) => ({
      id: d.id,
      title: d.title,
      theme: d.theme,
      slides: d.slides.length,
      updatedAt: d.updatedAt,
      shared: !!d.share && new Date(d.share.expiresAt).getTime() > Date.now(),
      firstSlide: d.slides[0],
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
