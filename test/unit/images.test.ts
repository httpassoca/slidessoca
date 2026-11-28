import { describe, expect, it } from 'vitest'
import { KEEP_ORIGINAL_BYTES, MAX_IMAGE_EDGE, shouldKeepOriginal } from '$lib/client/images'

const ok = { type: 'image/jpeg', width: 1200, height: 800, bytes: 200 * 1024 }

describe('shouldKeepOriginal', () => {
  it('keeps small JPEG and WebP files', () => {
    expect(shouldKeepOriginal(ok)).toBe(true)
    expect(shouldKeepOriginal({ ...ok, type: 'image/webp' })).toBe(true)
    expect(shouldKeepOriginal({ ...ok, type: 'IMAGE/JPEG' })).toBe(true)
  })

  it('keeps files exactly at the limits', () => {
    expect(
      shouldKeepOriginal({
        ...ok,
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        bytes: KEEP_ORIGINAL_BYTES,
      }),
    ).toBe(true)
  })

  it('re-encodes other formats', () => {
    for (const type of ['image/png', 'image/avif', 'image/gif', 'image/jpg', ''])
      expect(shouldKeepOriginal({ ...ok, type })).toBe(false)
  })

  it('re-encodes when an edge is too long', () => {
    expect(shouldKeepOriginal({ ...ok, width: MAX_IMAGE_EDGE + 1 })).toBe(false)
    expect(shouldKeepOriginal({ ...ok, height: MAX_IMAGE_EDGE + 1 })).toBe(false)
  })

  it('re-encodes when the file is too big', () => {
    expect(shouldKeepOriginal({ ...ok, bytes: KEEP_ORIGINAL_BYTES + 1 })).toBe(false)
  })

  it('re-encodes when the size is unknown', () => {
    expect(shouldKeepOriginal({ ...ok, width: 0 })).toBe(false)
  })
})
