// Images are links (ADR 0002). Pure helpers for the URL inputs and for spotting legacy decks
// that still embed uploaded (data:) images.

import type { Deck } from './types.js'
import { MAX_IMAGE_URL } from './validate.js'

/** Shown wherever an image file is dropped, pasted or picked. */
export const LINKS_ONLY_MESSAGE = 'Images are links: paste an https:// image URL instead of a file'

/** An embedded image (uploaded before images became links). */
export const isDataImage = (src: string) => /^data:/i.test(src)

/** 1-based numbers of the slides that hold at least one embedded (uploaded) image. */
export function slidesWithUploadedImages(deck: Pick<Deck, 'slides'>): number[] {
  const out: number[] = []
  deck.slides.forEach((s, i) => {
    if (
      s.content.images.some((im) => isDataImage(im.src)) ||
      s.elements.some((e) => e.kind === 'image' && isDataImage(e.src))
    )
      out.push(i + 1)
  })
  return out
}

export type ImageUrlCheck = { ok: true; src: string } | { ok: false; error: string }

/** What the user typed or pasted into an "Image URL" field → a link a deck can hold. */
export function checkImageUrl(input: string): ImageUrlCheck {
  const s = input.trim()
  if (!s) return { ok: false, error: 'Paste a link to an image' }
  if (isDataImage(s)) return { ok: false, error: 'Use a link (https://…), not embedded image data' }
  let url: URL
  try {
    url = new URL(s)
  } catch {
    return { ok: false, error: 'Use a full link that starts with https://' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    return { ok: false, error: 'Use a full link that starts with https://' }
  const href = url.href
  if (href.length > MAX_IMAGE_URL) return { ok: false, error: 'That link is too long' }
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(href))
    return { ok: false, error: 'Use a full link that starts with https://' }
  return { ok: true, src: href }
}

/** A readable default alt text from a link's file name ("my-cat_2.jpg" → "my cat 2"). */
export function altFromUrl(src: string): string {
  try {
    const last = decodeURIComponent(new URL(src).pathname.split('/').pop() ?? '')
    return last
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/^File:/i, '')
      .replace(/^\d+px-/i, '') // Wikimedia thumbnails: 1280px-Name.jpg
      .replace(/[-_]+/g, ' ')
      .trim()
  } catch {
    return ''
  }
}
