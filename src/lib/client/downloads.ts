// Deck downloads (SL-0007), browser-only:
//   downloadHtml(deck, { notes }) — one self-contained .html (static slides + tiny player)
//   downloadJpgs(deck)            — .zip of 1920×1080 JPGs (slide-01.jpg …)
//   downloadPdf(deck)             — .pdf, one 16:9 page per slide (the same JPGs)
//
// Slides are drawn by SlideView itself (invariant 1): it is mounted off-screen, left to settle
// (images, fonts, auto-fit), and its markup is taken as-is. Its CSS is the scoped rules the page
// already loaded for it, plus dssoca's theme. Rasterising draws that markup in an SVG
// <foreignObject> onto a canvas; fonts and images are inlined as data: URLs first because an
// SVG image cannot load anything itself.
import { flushSync, mount, unmount } from 'svelte'
import { toast, toasts } from 'dssoca'
import themeCssRaw from 'dssoca/theme.css?raw'
import SlideView from '$lib/components/SlideView.svelte'
import { renderMarkdown } from '$lib/deck/render'
import type { Deck } from '$lib/deck/types'
import { zipStore } from '$lib/deck/zip'
import { buildDeckHtml } from '$lib/export/html'
import { downloadName, slideImageName } from '$lib/export/names'
import { buildPdf, type PdfImage } from '$lib/export/pdf'
import { presetCss, themeEntry } from '$lib/themes'
import { download } from './export'

export const RASTER_W = 1920
export const RASTER_H = 1080

const FONTS_URL =
  /@import url\("([^"]+)"\);/.exec(themeCssRaw)?.[1] ??
  'https://fonts.googleapis.com/css2?family=Electrolize&family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400;1,700&display=swap'

/** dssoca's theme without the remote @import and the self-hosted (/fonts/…) faces. */
const THEME_CSS = themeCssRaw
  .replace(/@import url\([^)]*\);?/g, '')
  .replace(/@font-face\s*\{[^}]*url\("\/fonts\/[^}]*\}/g, '')

/** The preset palette override for one deck theme (empty for plain dark/light). */
function paletteCss(palette: string | null): string {
  if (!palette) return ''
  return presetCss
    .split('\n')
    .filter((l) => l.includes(`[data-palette='${palette}']`))
    .join('\n')
}

const nextFrame = () =>
  new Promise<void>((r) =>
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(() => r())
      : setTimeout(r, 16),
  )

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(b)
  })

let fontCache: Promise<string | null> | null = null

/**
 * The deck fonts (Electrolize, JetBrains Mono — latin + latin-ext subsets) as @font-face rules
 * with data: URLs, or null when they can't be fetched (offline): text then uses system fonts.
 */
export function embeddedFontCss(): Promise<string | null> {
  fontCache ??= (async () => {
    try {
      const css = await (await fetch(FONTS_URL)).text()
      const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
        .filter(([, subset]) => subset === 'latin' || subset === 'latin-ext')
        .map(([, , block]) => block)
      if (!blocks.length) return null
      const out = await Promise.all(
        blocks.map(async (block) => {
          const url = /url\(([^)]+)\)/.exec(block)?.[1]?.replace(/["']/g, '')
          if (!url) return block
          const data = await blobToDataUrl(await (await fetch(url)).blob())
          return block.replace(/url\([^)]+\)/, `url(${data})`)
        }),
      )
      return out.join('\n')
    } catch {
      fontCache = null
      return null
    }
  })()
  return fontCache
}

/** http(s) image → data: URL, or null when it can't be fetched (CORS, offline, 404). */
async function inlineImage(src: string): Promise<string | null> {
  try {
    const res = await fetch(src, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/') || blob.type.includes('svg')) return null
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}

/** A raster src that is guaranteed to fail, so SlideView draws its quiet "missing" frame. */
const BROKEN = 'data:image/png;base64,AA=='

/** Deck copy whose http images are data: URLs (or `fallback(src)` when that fails). */
async function withInlineImages(deck: Deck, fallback: (src: string) => string): Promise<Deck> {
  const cache = new Map<string, Promise<string>>()
  const resolve = (src: string) => {
    if (!/^https?:/i.test(src)) return Promise.resolve(src)
    if (!cache.has(src))
      cache.set(
        src,
        inlineImage(src).then((d) => d ?? fallback(src)),
      )
    return cache.get(src)!
  }
  const slides = await Promise.all(
    deck.slides.map(async (s) => ({
      ...s,
      elements: await Promise.all(
        s.elements.map(async (e) => (e.kind === 'image' ? { ...e, src: await resolve(e.src) } : e)),
      ),
    })),
  )
  return { ...deck, slides }
}

interface Mounted {
  host: HTMLElement
  nodes: HTMLElement[]
  /** SlideView's scoped CSS, collected from the page's stylesheets. */
  css: string
  destroy: () => void
}

/** Scoped CSS rules for the component whose root carries `hash` (svelte-xxxx). */
function scopedCss(hash: string | undefined): string {
  if (!hash) return ''
  const out: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // cross-origin (Google Fonts)
    }
    for (const r of Array.from(rules)) if (r.cssText.includes(hash)) out.push(r.cssText)
  }
  return out.join('\n')
}

/** Mount SlideView for every slide off-screen at `width` px and wait until it has settled. */
async function mountSlides(deck: Deck, width: number): Promise<Mounted> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;inset-inline-start:-${width * 2}px;inset-block-start:0;inline-size:${width}px;pointer-events:none;contain:layout style;`
  document.body.append(host)
  const apps: ReturnType<typeof mount>[] = []
  const nodes: HTMLElement[] = []
  deck.slides.forEach((slide, i) => {
    const box = document.createElement('div')
    host.append(box)
    apps.push(
      mount(SlideView, {
        target: box,
        props: { slide, theme: deck.theme, label: `Slide ${i + 1} of ${deck.slides.length}` },
      }),
    )
  })
  flushSync()
  for (const box of Array.from(host.children)) nodes.push(box.firstElementChild as HTMLElement)

  // Images: load now (they are lazy), and let failures swap in the missing frame.
  const imgs = Array.from(host.querySelectorAll('img'))
  for (const img of imgs) img.loading = 'eager'
  await Promise.race([
    Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((r) => {
              img.addEventListener('load', () => r(), { once: true })
              img.addEventListener('error', () => r(), { once: true })
            }),
      ),
    ),
    new Promise((r) => setTimeout(r, 15000)),
  ])
  flushSync()
  await document.fonts?.ready
  // Auto-fit runs in rAF after each resize; give it a few frames.
  for (let i = 0; i < 4; i++) await nextFrame()

  const hash = Array.from(nodes[0]?.classList ?? []).find((c) => c.startsWith('svelte-'))
  return {
    host,
    nodes,
    css: scopedCss(hash),
    destroy() {
      for (const a of apps) unmount(a)
      host.remove()
    },
  }
}

/** The deck as one self-contained HTML document. */
export async function deckHtml(deck: Deck, opts: { notes?: boolean } = {}): Promise<string> {
  const ready = await withInlineImages(deck, (src) => src) // keep http as is when it can't load
  const [fonts, m] = await Promise.all([embeddedFontCss(), mountSlides(ready, 1600)])
  try {
    const t = themeEntry(deck.theme)
    return buildDeckHtml({
      title: deck.title,
      mode: t.mode,
      palette: t.palette,
      bg: t.bg,
      css: [fonts ?? '', THEME_CSS, paletteCss(t.palette), m.css].join('\n'),
      fontsHref: fonts ? undefined : FONTS_URL,
      slides: m.nodes.map((n, i) => ({
        html: n.outerHTML,
        notes: opts.notes ? renderMarkdown(deck.slides[i].notes ?? '') : undefined,
      })),
    })
  } finally {
    m.destroy()
  }
}

/** One 1920×1080 JPEG per slide (notes never included). */
export async function rasteriseDeck(
  deck: Deck,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array[]> {
  const ready = await withInlineImages(deck, () => BROKEN)
  const [fonts, m] = await Promise.all([embeddedFontCss(), mountSlides(ready, RASTER_W)])
  try {
    const t = themeEntry(deck.theme)
    const css = [fonts ?? '', THEME_CSS, paletteCss(t.palette), m.css].join('\n')
    const canvas = document.createElement('canvas')
    canvas.width = RASTER_W
    canvas.height = RASTER_H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot draw images')
    const ser = new XMLSerializer()
    const rootAttrs = `data-theme="${t.mode}"${t.palette ? ` data-palette="${t.palette}"` : ''}`
    const out: Uint8Array[] = []
    for (let i = 0; i < m.nodes.length; i++) {
      onProgress?.(i, m.nodes.length)
      const wrap = document.createElement('div')
      wrap.setAttribute('data-theme', t.mode)
      if (t.palette) wrap.setAttribute('data-palette', t.palette)
      wrap.style.cssText = `inline-size:${RASTER_W}px;block-size:${RASTER_H}px;margin:0;overflow:hidden;`
      const style = document.createElement('style')
      style.textContent = css
      wrap.append(style, m.nodes[i].cloneNode(true))
      const svg =
        // The theme sits on the SVG root too: dssoca derives tokens like --ss-primary on :root,
        // so the root must carry the deck's palette or it resolves them with the dark one.
        `<svg xmlns="http://www.w3.org/2000/svg" width="${RASTER_W}" height="${RASTER_H}" ${rootAttrs}>` +
        `<foreignObject x="0" y="0" width="${RASTER_W}" height="${RASTER_H}">` +
        ser.serializeToString(wrap) +
        '</foreignObject></svg>'
      const img = new Image()
      img.width = RASTER_W
      img.height = RASTER_H
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
      await img.decode()
      ctx.fillStyle = t.bg
      ctx.fillRect(0, 0, RASTER_W, RASTER_H)
      ctx.drawImage(img, 0, 0, RASTER_W, RASTER_H)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
      if (!blob) throw new Error('Could not encode a slide as JPG')
      out.push(new Uint8Array(await blob.arrayBuffer()))
    }
    onProgress?.(m.nodes.length, m.nodes.length)
    return out
  } finally {
    m.destroy()
  }
}

export type DeckDownload = 'html' | 'html-notes' | 'jpg' | 'pdf'

/** Run one download with a progress toast. Used by the editor, the home page and the viewer. */
export async function downloadDeck(deck: Deck, kind: DeckDownload): Promise<void> {
  const total = deck.slides.length
  if (!total) {
    toast.error('This deck has no slides')
    return
  }
  const id = toast.loading(kind.startsWith('html') ? 'Preparing HTML…' : 'Rendering slides…')
  try {
    if (kind === 'html' || kind === 'html-notes') {
      const html = await deckHtml(deck, { notes: kind === 'html-notes' })
      download(downloadName(deck.title, 'html'), new Blob([html], { type: 'text/html' }))
    } else {
      const jpgs = await rasteriseDeck(deck, (done) => {
        if (done < total) toasts.update(id, { message: `Rendering slide ${done + 1} of ${total}…` })
      })
      if (kind === 'jpg') {
        const zip = zipStore(jpgs.map((data, i) => ({ name: slideImageName(i, total), data })))
        download(
          downloadName(deck.title, 'jpg'),
          new Blob([zip as BlobPart], { type: 'application/zip' }),
        )
      } else {
        const pages: PdfImage[] = jpgs.map((jpeg) => ({
          jpeg,
          width: RASTER_W,
          height: RASTER_H,
        }))
        const pdf = buildPdf(pages, { title: deck.title })
        download(
          downloadName(deck.title, 'pdf'),
          new Blob([pdf as BlobPart], { type: 'application/pdf' }),
        )
      }
    }
    toasts.update(id, { kind: 'success', message: 'Download ready', timeout: 3000 })
  } catch (e) {
    toasts.update(id, {
      kind: 'error',
      message: `Download failed: ${(e as Error).message || 'unknown error'}`,
      timeout: 6000,
    })
  }
}
