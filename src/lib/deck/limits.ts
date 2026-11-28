// Size limits shared by the server (defaults) and the browser (Share dialog meter, upload gate).
// The server stays the source of truth: `DECK_MAX_MB` in its env overrides the default below.

export const MB = 1024 * 1024

/** Largest publish request body the server accepts by default (env `DECK_MAX_MB`). */
export const DECK_MAX_MB = 15
/** From here on the Share dialog warns that the deck is heavy for viewers on mobile data. */
export const DECK_WARN_MB = 12
/** Picked image files above this are refused before they are even decoded. */
export const IMAGE_FILE_MAX_MB = 20

export type SizeLevel = 'ok' | 'warn' | 'blocked'

/** UTF-8 byte length of a string (what the request body weighs on the wire). */
export const byteLength = (s: string) => new TextEncoder().encode(s).length

/** Where a publish body of `bytes` stands against the limits. */
export function sizeLevel(bytes: number, maxMb = DECK_MAX_MB, warnMb = DECK_WARN_MB): SizeLevel {
  if (bytes >= maxMb * MB) return 'blocked'
  if (bytes >= warnMb * MB) return 'warn'
  return 'ok'
}

/** "4.2 MB" (one decimal; a small non-empty deck reads "0.1 MB", never "0.0 MB"). */
export function formatMb(bytes: number): string {
  const mb = bytes / MB
  return `${bytes > 0 && mb < 0.1 ? '0.1' : mb.toFixed(1)} MB`
}
