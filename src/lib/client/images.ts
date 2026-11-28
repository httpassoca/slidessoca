// Images are links (ADR 0002): no image file ever enters a deck. These helpers turn a drop or a
// paste into either an image link or a short "links only" toast, never a silent no-op.

import { toast } from 'dssoca'
import { checkImageUrl, LINKS_ONLY_MESSAGE } from '../deck/images.js'

type Transfer = Pick<DataTransfer, 'getData'> & {
  files?: ArrayLike<File> | null
  items?: ArrayLike<Pick<DataTransferItem, 'kind'>> | null
}

/** Does this drop / paste carry files (rather than text or a link)? */
export function hasFiles(dt: Transfer | null | undefined): boolean {
  if (!dt) return false
  if ((dt.files?.length ?? 0) > 0) return true
  return Array.from(dt.items ?? []).some((i) => i.kind === 'file')
}

/** The first valid image link in a drop / paste (dragging an image from another tab gives one). */
export function transferredUrl(dt: Transfer | null | undefined): string | null {
  if (!dt) return null
  const raw = [dt.getData('text/uri-list'), dt.getData('text/plain')].join('\n')
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    const c = checkImageUrl(line)
    if (c.ok) return c.src
  }
  return null
}

/**
 * A drop / paste → an image link, or null. When it only carries files, `notify` (a toast by
 * default) says that images are links.
 */
export function imageFromTransfer(
  dt: Transfer | null | undefined,
  notify: (msg: string) => void = (m) => toast.info(m),
): string | null {
  const url = transferredUrl(dt)
  if (url) return url
  if (hasFiles(dt)) notify(LINKS_ONLY_MESSAGE)
  return null
}

/** Natural size of a linked image (for placing it), or undefined when it does not load. */
export function naturalSize(src: string): Promise<{ w: number; h: number } | undefined> {
  return new Promise((resolve) => {
    const im = new Image()
    im.referrerPolicy = 'no-referrer'
    const timer = setTimeout(() => resolve(undefined), 8000)
    im.onload = () => {
      clearTimeout(timer)
      resolve({ w: im.naturalWidth, h: im.naturalHeight })
    }
    im.onerror = () => {
      clearTimeout(timer)
      resolve(undefined)
    }
    im.src = src
  })
}
