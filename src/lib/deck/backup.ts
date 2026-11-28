// "Back up all decks" (SL-0010): every local deck as its `.slidessoca.json` inside one STORE zip,
// read back by /new → Import JSON. Plus the home reminder's rules: relative time text and
// whether anything changed since the last backup. Pure — no DOM, no storage.

import { deckToJson, slugify } from './bundle.js'
import { newId } from './factory.js'
import type { Deck } from './types.js'
import { validateDeck } from './validate.js'
import { zipStore, type ZipEntry } from './zip.js'

const pad2 = (n: number) => String(n).padStart(2, '0')

/** `slidessoca-backup-2026-11-28.zip` (local date). */
export function backupFileName(when = new Date()): string {
  return `slidessoca-backup-${when.getFullYear()}-${pad2(when.getMonth() + 1)}-${pad2(when.getDate())}.zip`
}

/** One `<slug>.slidessoca.json` per deck; same-titled decks get `-2`, `-3`… */
export function backupEntries(decks: Deck[]): ZipEntry[] {
  const enc = new TextEncoder()
  const used = new Set<string>()
  return decks.map((d) => {
    const base = slugify(d.title)
    let name = `${base}.slidessoca.json`
    for (let n = 2; used.has(name); n++) name = `${base}-${n}.slidessoca.json`
    used.add(name)
    return { name, data: enc.encode(deckToJson(d)) }
  })
}

export const buildBackupZip = (decks: Deck[], when = new Date()): Uint8Array =>
  zipStore(backupEntries(decks), when)

export interface RestoredBackup {
  decks: Deck[]
  /** Entries that were not decks (other files, invalid JSON, failed validation). */
  skipped: string[]
}

/**
 * Zip entries (from `unzip`) → new local decks: validated, fresh ids (so restoring never
 * overwrites a deck), original timestamps kept so the list keeps its order. Throws when the zip
 * holds no deck at all.
 */
export function decksFromBackup(entries: ZipEntry[]): RestoredBackup {
  const dec = new TextDecoder()
  const out: RestoredBackup = { decks: [], skipped: [] }
  for (const e of entries) {
    const base = e.name.split('/').pop() ?? e.name
    // Archive tool litter (macOS resource forks, dotfiles) is not worth reporting.
    if (/(^|\/)(__MACOSX|\.)/.test(e.name)) continue
    if (!/\.json$/i.test(base)) {
      out.skipped.push(e.name)
      continue
    }
    try {
      const deck = validateDeck(JSON.parse(dec.decode(e.data)))
      out.decks.push({ ...deck, id: newId() })
    } catch {
      out.skipped.push(e.name)
    }
  }
  if (!out.decks.length) throw new Error('No slidessoca decks in this zip')
  return out
}

const time = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : null
}

/** True when there are decks and none was ever backed up, or one changed after the last backup. */
export function needsBackup(decks: { updatedAt: string }[], lastBackup: string | null): boolean {
  if (!decks.length) return false
  const last = time(lastBackup)
  if (last === null) return true
  return decks.some((d) => (time(d.updatedAt) ?? Infinity) > last)
}

const UNITS: [limit: number, ms: number, unit: string][] = [
  [60 * 60_000, 60_000, 'minute'],
  [24 * 3_600_000, 3_600_000, 'hour'],
  [7 * 86_400_000, 86_400_000, 'day'],
  [30 * 86_400_000, 7 * 86_400_000, 'week'],
  [365 * 86_400_000, 30 * 86_400_000, 'month'],
  [Infinity, 365 * 86_400_000, 'year'],
]

/** `just now`, `5 minutes ago`, `yesterday`, `3 days ago`, `2 weeks ago`… */
export function timeAgo(iso: string, now = Date.now()): string {
  const t = time(iso)
  if (t === null) return 'some time ago'
  const diff = Math.max(0, now - t)
  if (diff < 60_000) return 'just now'
  for (const [limit, ms, unit] of UNITS) {
    if (diff >= limit) continue
    const n = Math.floor(diff / ms)
    if (unit === 'day' && n === 1) return 'yesterday'
    return `${n} ${unit}${n === 1 ? '' : 's'} ago`
  }
  return 'some time ago'
}

/** The reminder's status line. */
export function backupStatus(lastBackup: string | null, now = Date.now()): string {
  return time(lastBackup) === null ? 'Never backed up' : `Last backup ${timeAgo(lastBackup!, now)}`
}
