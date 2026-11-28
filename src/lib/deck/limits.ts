// Size limits shared by the server (defaults) and the browser (the 413 message).
// The server stays the source of truth: `DECK_MAX_MB` in its env overrides the default below.
// Images are links (ADR 0002), so a deck is only text and 1 MB is a lot of slides.

export const MB = 1024 * 1024

/** Largest publish request body the server accepts by default (env `DECK_MAX_MB`). */
export const DECK_MAX_MB = 1
