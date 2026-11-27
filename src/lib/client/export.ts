// CONTRACT (owned by SL-0003): deck downloads. Signatures are fixed; SL-0003 replaces the bodies
// (Markdown export with images as separate files, JSON import, etc.).
import { deckToMarkdown } from '../deck/markdown.js'
import { publicDeck } from '../deck/factory.js'
import type { Deck } from '../deck/types.js'

function download(name: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'deck'

export async function exportMarkdown(deck: Deck): Promise<void> {
  download(`${slug(deck.title)}.md`, new Blob([deckToMarkdown(deck)], { type: 'text/markdown' }))
}

export async function exportJson(deck: Deck): Promise<void> {
  download(
    `${slug(deck.title)}.slidessoca.json`,
    new Blob([JSON.stringify(publicDeck(deck))], { type: 'application/json' }),
  )
}
