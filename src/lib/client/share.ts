// Publishing = upload a copy to the server and keep the secret edit token in the local deck.
import { publicDeck } from '../deck/factory.js'
import type { Deck, ShareInfo } from '../deck/types.js'

async function call(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      msg = (await res.json()).message ?? msg
    } catch {
      /* not json */
    }
    throw new Error(msg)
  }
  return res
}

/** Publish (first time) or republish (same link) — returns the deck with fresh share info. */
export async function publish(deck: Deck): Promise<Deck> {
  const body = JSON.stringify({ deck: publicDeck(deck) })
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  let res: Response
  if (deck.share) {
    headers.authorization = `Bearer ${deck.share.token}`
    try {
      res = await call(`/api/decks/${deck.share.id}`, { method: 'PUT', headers, body })
    } catch (e) {
      // Expired or deleted on the server: publish as a new link.
      if (/does not exist|expired|404/i.test(String(e)))
        return publish({ ...deck, share: undefined })
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
  await call(`/api/decks/${deck.share.id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${deck.share.token}` },
  })
  return { ...deck, share: undefined }
}

export const shareUrl = (s: ShareInfo, origin = location.origin) => `${origin}/s/${s.id}`
