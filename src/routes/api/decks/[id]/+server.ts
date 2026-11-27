import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { store } from '$lib/server/instance'
import { bearer, limitWrites, readDeck, storeFail } from '$lib/server/http'

export const GET: RequestHandler = async ({ params, setHeaders }) => {
  const r = await store.get(params.id)
  if (!r) error(404, 'This shared deck does not exist or has expired.')
  setHeaders({ 'cache-control': 'no-store' })
  return json(r)
}

/** Republish under the same link (owner only). Restarts the 30 days. */
export const PUT: RequestHandler = async (event) => {
  limitWrites(event)
  const token = bearer(event)
  const deck = await readDeck(event)
  try {
    return json(await store.update(event.params.id, token, deck))
  } catch (e) {
    storeFail(e)
  }
}

export const DELETE: RequestHandler = async (event) => {
  const token = bearer(event)
  try {
    await store.delete(event.params.id, token)
    return new Response(null, { status: 204 })
  } catch (e) {
    storeFail(e)
  }
}
