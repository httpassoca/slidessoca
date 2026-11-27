// Tiny fixed-window limiter per client IP for write endpoints. In-memory is enough: one process.
const hits = new Map<string, { n: number; reset: number }>()

export function allow(key: string, limit = 30, windowMs = 3_600_000, now = Date.now()): boolean {
  const h = hits.get(key)
  if (!h || h.reset <= now) {
    hits.set(key, { n: 1, reset: now + windowMs })
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k)
    return true
  }
  h.n++
  return h.n <= limit
}
