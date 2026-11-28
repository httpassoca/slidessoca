// Small per-browser flags in localStorage. Every access is guarded: storage can be missing or
// throw (private mode, blocked site data), and the app must work the same without it.

export const PREFS = {
  /** ISO time of the last "Back up all decks" download (SL-0010). */
  lastBackup: 'slidessoca:last-backup',
  /** Set once the "fullscreen isn't available" player hint was dismissed (SL-0010). */
  noFullscreenHint: 'slidessoca:hint-no-fullscreen',
} as const

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable: the flag just doesn't persist */
  }
}
