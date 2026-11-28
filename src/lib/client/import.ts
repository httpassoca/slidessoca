// Files picked or dropped on /new → the Markdown document the importer needs. A .zip is opened
// and treated as the files inside it. Images are links (ADR 0002): image files (loose or inside
// the zip) are not embedded, they are only reported so the page can say "use https links".

import { unzip } from '../deck/zip.js'

export interface ImportedFiles {
  /** The Markdown document found (the first .md / .markdown / .txt). */
  markdown: { name: string; text: string } | null
  /** Image files that came along: not used, images in a deck are links. */
  images: string[]
  /** Other names we could not use (a second .md, unknown types). */
  skipped: string[]
}

const ext = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? ''
export const isMarkdownName = (name: string) => /^(md|markdown|txt)$/.test(ext(name))
const isImageName = (name: string) => /^(png|jpe?g|webp|gif|avif|svg|heic|bmp)$/.test(ext(name))

/** Expand zips into plain File objects. */
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
      out.push(new File([e.data as BlobPart], e.name))
    }
  }
  return out
}

export async function readImportFiles(files: File[]): Promise<ImportedFiles> {
  const res: ImportedFiles = { markdown: null, images: [], skipped: [] }
  for (const f of await expand(files)) {
    if (isMarkdownName(f.name)) {
      if (!res.markdown) res.markdown = { name: f.name, text: await f.text() }
      else res.skipped.push(f.name)
    } else if (isImageName(f.name) || f.type.startsWith('image/')) res.images.push(f.name)
    else res.skipped.push(f.name)
  }
  return res
}
