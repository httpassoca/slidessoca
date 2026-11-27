import { describe, expect, it } from 'vitest'
import { counter, pad, slidesLabel } from '$lib/deck/count'

describe('slide counter', () => {
  it('zero-pads to at least two digits and to the total width', () => {
    expect(pad(3, 9)).toBe('03')
    expect(pad(7, 120)).toBe('007')
    expect(counter(2, 12)).toBe('03 / 12')
    expect(counter(0, 0)).toBe('00 / 00')
  })
  it('pluralises', () => {
    expect(slidesLabel(1)).toBe('1 slide')
    expect(slidesLabel(5)).toBe('5 slides')
  })
})
