// Every uploaded image is downscaled and re-encoded in the browser before it enters a deck:
// that is what keeps published decks small (cheap storage, fast links on mobile data).

export const MAX_IMAGE_EDGE = 1920
export const IMAGE_QUALITY = 0.82
/** An already-compressed image at most this big (and ≤ MAX_IMAGE_EDGE) keeps its bytes. */
export const KEEP_ORIGINAL_BYTES = 500 * 1024

/**
 * Should an upload keep its original bytes instead of being re-encoded? Yes when it is already
 * WebP or JPEG, fits in MAX_IMAGE_EDGE on both edges and is at most KEEP_ORIGINAL_BYTES — so a
 * deck exported and imported again does not lose quality each round trip. Pure.
 */
export function shouldKeepOriginal(f: {
  type: string
  width: number
  height: number
  bytes: number
}): boolean {
  return (
    /^image\/(webp|jpeg)$/i.test(f.type) &&
    f.width > 0 &&
    f.height > 0 &&
    f.width <= MAX_IMAGE_EDGE &&
    f.height <= MAX_IMAGE_EDGE &&
    f.bytes <= KEEP_ORIGINAL_BYTES
  )
}

function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) return createImageBitmap(file)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/**
 * File → compressed data URL (WebP, JPEG fallback). Animated GIFs pass through untouched, and so
 * do small WebP / JPEG files that are already within limits (`shouldKeepOriginal`).
 */
export async function compressImage(file: Blob): Promise<string> {
  if (file.type === 'image/gif') return blobToDataUrl(file)
  const img = await loadBitmap(file)
  const w0 = 'naturalWidth' in img ? img.naturalWidth : img.width
  const h0 = 'naturalHeight' in img ? img.naturalHeight : img.height
  if (shouldKeepOriginal({ type: file.type, width: w0, height: h0, bytes: file.size })) {
    if ('close' in img) img.close()
    return blobToDataUrl(file)
  }
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

export const isImageFile = (f: File) => /^image\/(png|jpe?g|webp|gif|avif)$/i.test(f.type)
