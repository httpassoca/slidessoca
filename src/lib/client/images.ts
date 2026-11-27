// Every uploaded image is downscaled and re-encoded in the browser before it enters a deck:
// that is what keeps published decks small (cheap storage, fast links on mobile data).

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

export const isImageFile = (f: File) => /^image\/(png|jpe?g|webp|gif|avif)$/i.test(f.type)
