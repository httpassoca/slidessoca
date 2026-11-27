import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { store } from '$lib/server/instance'

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  const r = await store.get(params.id)
  if (!r) error(404, 'This shared deck does not exist or has expired.')
  setHeaders({ 'cache-control': 'no-store' })
  return r
}
