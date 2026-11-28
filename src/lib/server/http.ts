import { error, type RequestEvent } from '@sveltejs/kit'
import { DeckError, validateDeck } from '../deck/validate.js'
import type { Deck } from '../deck/types.js'
import { config } from './instance.js'
import { allow } from './ratelimit.js'
import { StoreError } from './store.js'

export function clientIp(event: RequestEvent): string {
  // Behind nginx (only it reaches the container on 127.0.0.1), X-Real-IP is trustworthy.
  return event.request.headers.get('x-real-ip') ?? event.getClientAddress()
}

export function limitWrites(event: RequestEvent) {
  if (!allow(clientIp(event)))
    error(429, 'Too many publishes from this address. Try again in an hour.')
}

export async function readDeck(event: RequestEvent): Promise<Deck> {
  const len = Number(event.request.headers.get('content-length') ?? 0)
  if (len > config.maxDeckBytes) error(413, 'Deck is too large. Split it into smaller decks.')
  const raw = await event.request.text()
  if (raw.length > config.maxDeckBytes)
    error(413, 'Deck is too large. Split it into smaller decks.')
  try {
    const body = JSON.parse(raw)
    return validateDeck(body?.deck)
  } catch (e) {
    if (e instanceof DeckError) error(400, e.message)
    error(400, 'Invalid JSON')
  }
}

export function bearer(event: RequestEvent): string {
  const h = event.request.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(\S+)$/i.exec(h)
  if (!m) error(401, 'Missing edit token')
  return m[1]
}

export function storeFail(e: unknown): never {
  if (e instanceof StoreError) error(e.status, e.message)
  throw e
}
