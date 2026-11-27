// Files picked or dropped on /new → what the Markdown / JSON importers need. Browser-only
// (compressImage needs a canvas). A .zip is opened and treated as the files inside it.

import { MIME_BY_EXT } from '../deck/bundle.js'
import { unzip } from '../deck/zip.js'
import { compressImage } from './images.js'

export interface ImportedFiles {
  /** The Markdown document found (the first .md / .markdown / .txt). */
  markdown: { name: string; text: string } | null
  /** Image file name (as written in the zip / picked) → compressed data URL. */
  assets: Record<string, string>
  /** Names we could not use (wrong type, unreadable image). */
  skipped: string[]
}

const ext = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? ''
export const isMarkdownName = (name: string) => /^(md|markdown|txt)$/.test(ext(name))
const imageMime = (f: { name: string; type?: string }) =>
  f.type && /^image\/(png|jpe?g|webp|gif|avif)$/i.test(f.type) ? f.type : MIME_BY_EXT[ext(f.name)]

/** Expand zips into plain File objects (directories flattened only in the asset lookup). */
async function expand(files: File[]): Promise<File[]> {
  const out: File[] = []
  for (const f of files) {
    if (ext(f.name) !== 'zip') {
      out.push(f)
      continue
    }
    const entries = await unzip(new Uint8Array(await f.arrayBuffer()))
    for (const e of entries) {
      if (/(^|\/)(__MACOSX|\.)/.test(e.name)) continue
      out.push(
        new File([e.data as BlobPart], e.name, {
          type: imageMime({ name: e.name }) ?? 'text/plain',
        }),
      )
    }
  }
  return out
}

export async function readImportFiles(files: File[]): Promise<ImportedFiles> {
  const res: ImportedFiles = { markdown: null, assets: {}, skipped: [] }
  for (const f of await expand(files)) {
    if (isMarkdownName(f.name)) {
      if (!res.markdown) res.markdown = { name: f.name, text: await f.text() }
      else res.skipped.push(f.name)
      continue
    }
    const mime = imageMime(f)
    if (!mime) {
      res.skipped.push(f.name)
      continue
    }
    try {
      const blob = f.type === mime ? f : new Blob([f], { type: mime })
      res.assets[f.name] = await compressImage(blob)
    } catch {
      res.skipped.push(f.name)
    }
  }
  return res
}
