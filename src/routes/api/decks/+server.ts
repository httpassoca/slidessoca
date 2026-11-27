import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { store } from '$lib/server/instance'
import { limitWrites, readDeck, storeFail } from '$lib/server/http'

/** Publish a deck: returns the public id, the secret edit token and the expiry. */
export const POST: RequestHandler = async (event) => {
  limitWrites(event)
  const deck = await readDeck(event)
  try {
    return json(await store.publish(deck), { status: 201 })
  } catch (e) {
    storeFail(e)
  }
}
