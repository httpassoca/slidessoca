// Every uploaded image is downscaled and re-encoded in the browser before it enters a deck:
// that is what keeps published decks small (cheap storage, fast links on mobile data).

import { toast } from 'dssoca'
import { IMAGE_FILE_MAX_MB, MB } from '../deck/limits.js'

export const MAX_IMAGE_EDGE = 1920
export const IMAGE_QUALITY = 0.82

function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) return createImageBitmap(file)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/** File → compressed data URL (WebP, JPEG fallback). Animated GIFs pass through untouched. */
export async function compressImage(file: Blob): Promise<string> {
  if (file.type === 'image/gif') return blobToDataUrl(file)
  const img = await loadBitmap(file)
  const w0 = 'naturalWidth' in img ? img.naturalWidth : img.width
  const h0 = 'naturalHeight' in img ? img.naturalHeight : img.height
  const k = Math.min(1, MAX_IMAGE_EDGE / Math.max(w0, h0))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w0 * k)
  canvas.height = Math.round(h0 * k)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  let url = canvas.toDataURL('image/webp', IMAGE_QUALITY)
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', IMAGE_QUALITY)
  return url
}

export function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })
}

export const isImageFile = (f: Pick<File, 'type'>) =>
  /^image\/(png|jpe?g|webp|gif|avif)$/i.test(f.type)

// ---------------------------------------------------------------- the gate before compressImage
// Every place a picked / dropped / imported image enters a deck runs it through here first, so a
// huge camera RAW-ish file is refused with a clear message instead of freezing the tab decoding.

export const IMAGE_FILE_MAX_BYTES = IMAGE_FILE_MAX_MB * MB
export const IMAGE_TYPE_MESSAGE = 'Only PNG, JPEG, WebP, GIF or AVIF images'

type FileLike = Pick<File, 'name' | 'size' | 'type'>

/** Size check only (for importers that work the type out from the file name). */
export const checkImageSize = (f: Pick<File, 'name' | 'size'>): string | null =>
  f.size > IMAGE_FILE_MAX_BYTES ? `${f.name} is over ${IMAGE_FILE_MAX_MB} MB` : null

/** Why this file cannot go into a deck (wrong type, over 20 MB), or null when it can. */
export function checkImageFile(f: FileLike): string | null {
  if (!isImageFile(f)) return IMAGE_TYPE_MESSAGE
  return checkImageSize(f)
}

/**
 * The files that may be compressed; every refused one is reported through `notify` (a toast by
 * default): one message for wrong types, one per file that is too large.
 */
export function acceptImages<F extends FileLike>(
  files: F[],
  notify: (msg: string) => void = (m) => toast.error(m),
): F[] {
  const ok: F[] = []
  let wrongType = false
  for (const f of files) {
    const why = checkImageFile(f)
    if (!why) ok.push(f)
    else if (why === IMAGE_TYPE_MESSAGE) wrongType = true
    else notify(why)
  }
  if (wrongType) notify(IMAGE_TYPE_MESSAGE)
  return ok
}
