// The /api/decks handlers, called with minimal RequestEvent stand-ins against a temp store.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RequestEvent } from '@sveltejs/kit'
import { makeDeck } from '$lib/deck/factory'

let dir: string
// Loaded after DATA_DIR is set: the store reads its config at import.
let api: typeof import('../../src/routes/api/decks/+server')
let one: typeof import('../../src/routes/api/decks/[id]/+server')

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'slidessoca-api-'))
  process.env.DATA_DIR = dir
  process.env.DECK_MAX_MB = '1'
  api = await import('../../src/routes/api/decks/+server')
  one = await import('../../src/routes/api/decks/[id]/+server')
})
afterAll(() => rm(dir, { recursive: true, force: true }))

let ip = 0
function event(
  method: string,
  opts: { body?: string; id?: string; token?: string; ip?: string } = {},
): RequestEvent {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (opts.token) headers.set('authorization', `Bearer ${opts.token}`)
  headers.set('x-real-ip', opts.ip ?? `10.0.0.${++ip}`)
  const request = new Request('http://localhost/api/decks', {
    method,
    headers,
    body: opts.body,
  })
  return {
    request,
    params: { id: opts.id ?? '' },
    getClientAddress: () => '127.0.0.1',
    setHeaders: () => {},
  } as unknown as RequestEvent
}

/** Run a handler; SvelteKit's error() throws an HttpError with a status. */
async function call(
  fn: (e: RequestEvent) => Response | Promise<Response>,
  e: RequestEvent,
): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fn(e)
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null }
  } catch (err) {
    const h = err as { status?: number; body?: { message: string } }
    if (typeof h.status === 'number') return { status: h.status, body: h.body }
    throw err
  }
}

const body = (deck = makeDeck('API deck')) => JSON.stringify({ deck })
type Pub = { id: string; token: string; expiresAt: string }

describe('/api/decks', () => {
  it('publishes, reads, republishes and deletes', async () => {
    const pub = await call(api.POST as never, event('POST', { body: body() }))
    expect(pub.status).toBe(201)
    const p = pub.body as Pub
    expect(p.id).toMatch(/^[\w-]{10}$/)
    expect(p.token).toHaveLength(32)

    const got = await call(one.GET as never, event('GET', { id: p.id }))
    expect(got.status).toBe(200)
    expect((got.body as { deck: { title: string } }).deck.title).toBe('API deck')
    expect(JSON.stringify(got.body)).not.toContain(p.token)

    const put = await call(
      one.PUT as never,
      event('PUT', { id: p.id, token: p.token, body: body(makeDeck('Renamed')) }),
    )
    expect(put.status).toBe(200)

    const wrong = await call(
      one.PUT as never,
      event('PUT', { id: p.id, token: 'x'.repeat(32), body: body() }),
    )
    expect(wrong.status).toBe(403)

    const del = await call(one.DELETE as never, event('DELETE', { id: p.id, token: p.token }))
    expect(del.status).toBe(204)
    expect((await call(one.GET as never, event('GET', { id: p.id }))).status).toBe(404)
  })

  it('rejects invalid JSON and invalid decks with 400', async () => {
    expect((await call(api.POST as never, event('POST', { body: '{' }))).status).toBe(400)
    const bad = await call(
      api.POST as never,
      event('POST', { body: JSON.stringify({ deck: { v: 1 } }) }),
    )
    expect(bad.status).toBe(400)
  })

  it('rejects decks over the size limit with 413', async () => {
    const big = 'x'.repeat(1.2 * 1024 * 1024)
    const res = await call(api.POST as never, event('POST', { body: big }))
    expect(res.status).toBe(413)
  })

  it('requires a bearer token to change a deck', async () => {
    const res = await call(one.DELETE as never, event('DELETE', { id: 'abcdefghij' }))
    expect(res.status).toBe(401)
  })

  it('rate-limits publishes per address with 429', async () => {
    let last = 0
    for (let i = 0; i < 31; i++)
      last = (await call(api.POST as never, event('POST', { body: '{', ip: '10.9.9.9' }))).status
    expect(last).toBe(429)
  })

  it('returns 404 for unknown and malformed ids', async () => {
    expect((await call(one.GET as never, event('GET', { id: 'nopenopeno' }))).status).toBe(404)
    expect((await call(one.GET as never, event('GET', { id: '../etc' }))).status).toBe(404)
  })
})
