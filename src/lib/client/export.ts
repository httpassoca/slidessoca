// Deck downloads (owned by SL-0003). Signatures are a contract with the editor:
//   exportMarkdown(deck) — deck.md, or a .zip with deck.md + images/… when the deck embeds images
//   exportJson(deck)     — <slug>.slidessoca.json (re-importable on /new → Import JSON)
import { deckToBundle, deckToJson, slugify } from '../deck/bundle.js'
import type { Deck } from '../deck/types.js'
import { zipStore } from '../deck/zip.js'

export function download(name: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export async function exportMarkdown(deck: Deck): Promise<void> {
  const files = deckToBundle(deck)
  const name = slugify(deck.title)
  if (files.length === 1) {
    download(`${name}.md`, new Blob([files[0].data as BlobPart], { type: 'text/markdown' }))
    return
  }
  const zip = zipStore(files)
  download(`${name}.zip`, new Blob([zip as BlobPart], { type: 'application/zip' }))
}

export async function exportJson(deck: Deck): Promise<void> {
  download(
    `${slugify(deck.title)}.slidessoca.json`,
    new Blob([deckToJson(deck)], { type: 'application/json' }),
  )
}
