import { describe, expect, it } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { bytesToDataUrl, crc32, dataUrlToBytes, unzip, zipStore } from '$lib/deck/zip'

const enc = (s: string) => new TextEncoder().encode(s)
const dec = (b: Uint8Array) => new TextDecoder().decode(b)

describe('zip', () => {
  it('crc32 matches the reference value', () => {
    expect(crc32(enc('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })

  it('writes a valid STORE archive that reads back', async () => {
    const bytes = zipStore([
      { name: 'deck.md', data: enc('# Hi\n') },
      { name: 'images/slide-1-1.webp', data: new Uint8Array([1, 2, 3, 255]) },
      { name: 'ünïcode.txt', data: enc('ok') },
    ])
    // Local header signature first, end-of-central-directory last.
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect([...bytes.subarray(bytes.length - 22, bytes.length - 18)]).toEqual([
      0x50, 0x4b, 0x05, 0x06,
    ])
    const back = await unzip(bytes)
    expect(back.map((e) => e.name)).toEqual(['deck.md', 'images/slide-1-1.webp', 'ünïcode.txt'])
    expect(dec(back[0].data)).toBe('# Hi\n')
    expect([...back[1].data]).toEqual([1, 2, 3, 255])
  })

  it('reads DEFLATE entries (zips made by other tools)', async () => {
    const text = 'hello '.repeat(200)
    const raw = new Uint8Array(deflateRawSync(enc(text)))
    // Build a STORE zip, then patch the entry to method 8 with the deflated payload.
    const name = enc('a.md')
    const store = zipStore([{ name: 'a.md', data: raw }])
    const v = new DataView(store.buffer)
    v.setUint16(8, 8, true) // local method
    const central = 30 + name.length + raw.length
    v.setUint16(central + 10, 8, true) // central method
    v.setUint32(central + 24, text.length, true) // uncompressed size
    const [e] = await unzip(store)
    expect(dec(e.data)).toBe(text)
  })

  it('rejects non-zips', async () => {
    await expect(unzip(enc('nope, not a zip at all, definitely not'))).rejects.toThrow(/zip/i)
  })

  it('converts data URLs to bytes and back', () => {
    const url = bytesToDataUrl(new Uint8Array([0, 1, 2, 250]), 'image/png')
    expect(url).toBe('data:image/png;base64,AAEC+g==')
    expect(dataUrlToBytes(url)).toEqual({
      mime: 'image/png',
      data: new Uint8Array([0, 1, 2, 250]),
    })
    expect(dataUrlToBytes('https://x')).toBeNull()
  })
})
