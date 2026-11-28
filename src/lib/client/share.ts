// Publishing = upload a copy to the server and keep the secret edit token in the local deck.
import { publicDeck } from '../deck/factory.js'
import { DECK_MAX_MB } from '../deck/limits.js'
import type { Deck, ShareInfo } from '../deck/types.js'

/** A failed share request. `status` is the HTTP status, 0 when the server was unreachable. */
export class ShareError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function call(url: string, init: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ShareError(0, 'Could not reach the server. Check your connection and try again.')
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      msg = (await res.json()).message ?? msg
    } catch {
      /* not json */
    }
    throw new ShareError(res.status, msg)
  }
  return res
}

/**
 * The exact JSON body a publish uploads: the public copy, speaker notes only when the deck's
 * remembered choice (`publishNotes`) says so.
 */
export const publishBody = (deck: Deck) =>
  JSON.stringify({ deck: publicDeck(deck, { notes: deck.publishNotes === true }) })

/** Publish (first time) or republish (same link) — returns the deck with fresh share info. */
export async function publish(deck: Deck): Promise<Deck> {
  const body = publishBody(deck)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  let res: Response
  if (deck.share) {
    headers.authorization = `Bearer ${deck.share.token}`
    try {
      res = await call(`/api/decks/${deck.share.id}`, { method: 'PUT', headers, body })
    } catch (e) {
      // Expired or deleted on the server: publish as a new link.
      if (e instanceof ShareError && e.status === 404) return publish({ ...deck, share: undefined })
      throw e
    }
  } else {
    res = await call('/api/decks', { method: 'POST', headers, body })
  }
  const share = (await res.json()) as ShareInfo
  return { ...deck, share }
}

export async function unpublish(deck: Deck): Promise<Deck> {
  if (!deck.share) return deck
  try {
    await call(`/api/decks/${deck.share.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${deck.share.token}` },
    })
  } catch (e) {
    // Already gone on the server: forgetting the link locally is what the user wants.
    if (!(e instanceof ShareError && e.status === 404)) throw e
  }
  return { ...deck, share: undefined }
}

export const shareUrl = (s: ShareInfo, origin = location.origin) => `${origin}/s/${s.id}`

/** Is the published copy still online (per the expiry the server gave us)? */
export const isLive = (s: ShareInfo | undefined, now = Date.now()) =>
  !!s && Date.parse(s.expiresAt) > now

/** Human message for a failed publish / unpublish. */
export function shareErrorMessage(e: unknown): string {
  const status = e instanceof ShareError ? e.status : -1
  switch (status) {
    case 0:
      return 'Could not reach the server. Check your connection and try again.'
    case 413:
      return `This deck is too large to publish (${DECK_MAX_MB} MB max). Split it into smaller decks.`
    case 429:
      return 'Too many publishes from this network. Try again in an hour.'
    case 507:
      return 'The server is out of storage right now. Try again later.'
    case 403:
      return 'This browser is not allowed to change that link any more.'
    default:
      return e instanceof Error ? e.message : 'Something went wrong. Try again.'
  }
}
