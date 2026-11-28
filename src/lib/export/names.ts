// File names for deck downloads (SL-0007). Pure: the browser code only adds the bytes.
import { slugify } from '../deck/bundle.js'
import { pad } from '../deck/count.js'

export type DownloadKind = 'html' | 'jpg' | 'pdf'

/** `my-talk.html`, `my-talk-slides.zip` (one JPG per slide), `my-talk.pdf`. */
export function downloadName(title: string, kind: DownloadKind): string {
  const slug = slugify(title)
  if (kind === 'jpg') return `${slug}-slides.zip`
  return `${slug}.${kind}`
}

/** `slide-01.jpg` … `slide-12.jpg` (zero-padded to the deck's width, at least 2 digits). */
export function slideImageName(index: number, total: number): string {
  return `slide-${pad(index + 1, total)}.jpg`
}
