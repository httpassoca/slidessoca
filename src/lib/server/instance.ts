// The process-wide store, configured from env (see .env.example). Imported by API routes only.
import { env } from '$env/dynamic/private'
import { DECK_MAX_MB, MB } from '../deck/limits.js'
import { createStore } from './store.js'

const num = (v: string | undefined, d: number) => (v && Number.isFinite(+v) && +v > 0 ? +v : d)

export const config = {
  dir: env.DATA_DIR || './data',
  ttlDays: num(env.DECK_TTL_DAYS, 30),
  maxStoreBytes: num(env.STORE_MAX_MB, 2048) * MB,
  maxDeckBytes: num(env.DECK_MAX_MB, DECK_MAX_MB) * MB,
}

export const store = createStore(config)

// Sweep expired decks at boot and every hour.
const SWEEP_MS = 3_600_000
let timer: ReturnType<typeof setInterval> | undefined
if (!timer && !import.meta.env?.TEST) {
  store.sweep().catch(() => {})
  timer = setInterval(() => store.sweep().catch(() => {}), SWEEP_MS)
  timer.unref?.()
}
