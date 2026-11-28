// A minimal PDF writer for image decks (SL-0007): one JPEG per page, embedded as-is
// (DCTDecode), so the file is the JPEGs plus a few hundred bytes of structure. Pure, no dependency.

export interface PdfImage {
  /** Baseline or progressive JPEG bytes (RGB or greyscale). */
  jpeg: Uint8Array
  width: number
  height: number
}

export interface PdfOptions {
  title?: string
  /** Page width in points; the height follows each image's aspect ratio. 960pt = 13.33in (16:9). */
  pageWidth?: number
}

export interface JpegInfo {
  width: number
  height: number
  components: number
}

/** Pixel size and colour components from a JPEG's SOF marker, or null if it isn't a JPEG. */
export function jpegInfo(b: Uint8Array): JpegInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  let p = 2
  while (p + 9 < b.length) {
    if (b[p] !== 0xff) return null
    const m = b[p + 1]
    if (m === 0xff) {
      p++
      continue
    }
    const len = (b[p + 2] << 8) | b[p + 3]
    // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC).
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return {
        height: (b[p + 5] << 8) | b[p + 6],
        width: (b[p + 7] << 8) | b[p + 8],
        components: b[p + 9],
      }
    }
    p += 2 + len
  }
  return null
}

/** PDF text string as UTF-16BE hex (`<FEFF…>`), safe for any title. */
function pdfText(s: string): string {
  let hex = 'FEFF'
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0')
  return `<${hex.toUpperCase()}>`
}

const num = (n: number) => String(Math.round(n * 100) / 100)

/** Build a PDF with one full-bleed image per page. */
export function buildPdf(images: PdfImage[], opts: PdfOptions = {}): Uint8Array {
  const enc = new TextEncoder()
  const pageW = opts.pageWidth ?? 960
  const chunks: Uint8Array[] = []
  const offsets: number[] = [] // offsets[objNo] = byte offset of "n 0 obj"
  let size = 0
  const put = (c: Uint8Array | string) => {
    const bytes = typeof c === 'string' ? enc.encode(c) : c
    chunks.push(bytes)
    size += bytes.length
  }
  const obj = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = size
    put(`${n} 0 obj\n${body}\n`)
    if (stream) {
      put('stream\n')
      put(stream)
      put('\nendstream\n')
    }
    put('endobj\n')
  }

  // Header + a binary comment so tools treat the file as binary.
  put('%PDF-1.4\n')
  put(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  const pageNo = (k: number) => 4 + k * 3
  const kids = images.map((_, k) => `${pageNo(k)} 0 R`).join(' ')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${images.length} >>`)
  obj(3, `<< /Title ${pdfText(opts.title ?? '')} /Producer (slidessoca) >>`)

  images.forEach((img, k) => {
    const n = pageNo(k)
    const w = pageW
    const h = (pageW * img.height) / img.width
    const cs = jpegInfo(img.jpeg)?.components === 1 ? '/DeviceGray' : '/DeviceRGB'
    const content = enc.encode(`q ${num(w)} 0 0 ${num(h)} 0 0 cm /Im0 Do Q`)
    obj(
      n,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(w)} ${num(h)}] ` +
        `/Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`,
    )
    obj(n + 1, `<< /Length ${content.length} >>`, content)
    obj(
      n + 2,
      `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} ` +
        `/ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>`,
      img.jpeg,
    )
  })

  const count = 4 + images.length * 3
  const xrefAt = size
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`
  for (let n = 1; n < count; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`
  put(xref)
  put(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`)

  const out = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}
