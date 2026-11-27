// The slide counter is slidessoca's signature detail: zero-padded mono figures, `03 / 12`,
// used wherever slides are counted (sorter, previews, viewer, presenter, deck cards).

/** Pad `n` to the width of `total` (at least 2 digits). */
export function pad(n: number, total: number): string {
  return String(n).padStart(Math.max(2, String(total).length), '0')
}

/** `03 / 12` for 0-based index 2 of 12. */
export function counter(index: number, total: number): string {
  return `${pad(total ? index + 1 : 0, total)} / ${pad(total, total)}`
}

/** `1 slide`, `12 slides`. */
export function slidesLabel(n: number): string {
  return `${n} ${n === 1 ? 'slide' : 'slides'}`
}
