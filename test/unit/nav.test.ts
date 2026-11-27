import { describe, expect, it } from 'vitest'
import {
  clampIndex,
  classifyGesture,
  formatElapsed,
  hashFor,
  indexFromHash,
  indexFromStart,
  isSyncMessage,
  keyAction,
  neighbours,
  step,
  type Gesture,
} from '$lib/deck/nav'

describe('clampIndex', () => {
  it('keeps indices inside the deck', () => {
    expect(clampIndex(-3, 5)).toBe(0)
    expect(clampIndex(9, 5)).toBe(4)
    expect(clampIndex(2.7, 5)).toBe(2)
    expect(clampIndex(3, 0)).toBe(0)
    expect(clampIndex(NaN, 5)).toBe(0)
  })
})

describe('keyAction', () => {
  it.each([
    ['ArrowRight', 'next'],
    ['ArrowDown', 'next'],
    ['PageDown', 'next'],
    [' ', 'next'],
    ['ArrowLeft', 'prev'],
    ['ArrowUp', 'prev'],
    ['PageUp', 'prev'],
    ['Home', 'first'],
    ['End', 'last'],
    ['f', 'fullscreen'],
    ['F', 'fullscreen'],
    ['o', 'overview'],
    ['Escape', 'overview'],
    ['n', 'notes'],
    ['Enter', 'select'],
  ])('%s → %s', (key, action) => {
    expect(keyAction({ key })).toBe(action)
  })

  it('Shift+Space goes back', () => {
    expect(keyAction({ key: ' ', shiftKey: true })).toBe('prev')
  })

  it('leaves modified keys and unknown keys to the browser', () => {
    expect(keyAction({ key: 'ArrowRight', ctrlKey: true })).toBeNull()
    expect(keyAction({ key: 'f', metaKey: true })).toBeNull()
    expect(keyAction({ key: 'Home', altKey: true })).toBeNull()
    expect(keyAction({ key: 'x' })).toBeNull()
  })
})

describe('step', () => {
  it('moves and stops at the ends', () => {
    expect(step('next', 0, 3)).toBe(1)
    expect(step('next', 2, 3)).toBe(2)
    expect(step('prev', 0, 3)).toBe(0)
    expect(step('prev', 2, 3)).toBe(1)
    expect(step('first', 2, 3)).toBe(0)
    expect(step('last', 0, 3)).toBe(2)
  })

  it('returns null for non-movement actions', () => {
    expect(step('overview', 1, 3)).toBeNull()
    expect(step('fullscreen', 1, 3)).toBeNull()
    expect(step('notes', 1, 3)).toBeNull()
  })
})

describe('hash and start params', () => {
  it('reads 1-based #n and clamps', () => {
    expect(indexFromHash('#1', 5)).toBe(0)
    expect(indexFromHash('#3', 5)).toBe(2)
    expect(indexFromHash('3', 5)).toBe(2)
    expect(indexFromHash('#99', 5)).toBe(4)
  })

  it('ignores garbage', () => {
    expect(indexFromHash('', 5)).toBeNull()
    expect(indexFromHash('#0', 5)).toBeNull()
    expect(indexFromHash('#abc', 5)).toBeNull()
    expect(indexFromHash('#-2', 5)).toBeNull()
  })

  it('round-trips with hashFor', () => {
    expect(indexFromHash(hashFor(4), 10)).toBe(4)
  })

  it('reads 0-based ?start', () => {
    expect(indexFromStart('2', 5)).toBe(2)
    expect(indexFromStart('20', 5)).toBe(4)
    expect(indexFromStart(null, 5)).toBe(0)
    expect(indexFromStart('x', 5)).toBe(0)
  })
})

describe('neighbours', () => {
  it('lists the slides around the current one, inside the deck', () => {
    expect(neighbours(0, 5)).toEqual([1, 2])
    expect(neighbours(2, 5)).toEqual([1, 3, 4])
    expect(neighbours(4, 5)).toEqual([3])
    expect(neighbours(0, 1)).toEqual([])
  })
})

describe('classifyGesture', () => {
  const g = (p: Partial<Gesture>): Gesture => ({
    dx: 0,
    dy: 0,
    dt: 100,
    x: 200,
    width: 390,
    pointerType: 'touch',
    ...p,
  })

  it('swipe left = next, swipe right = previous', () => {
    expect(classifyGesture(g({ dx: -80, dy: 5 }))).toBe('next')
    expect(classifyGesture(g({ dx: 80, dy: -10 }))).toBe('prev')
  })

  it('ignores mostly-vertical, short, slow or mouse movement', () => {
    expect(classifyGesture(g({ dx: -60, dy: 70 }))).toBeNull()
    expect(classifyGesture(g({ dx: -25 }))).toBeNull()
    expect(classifyGesture(g({ dx: -120, dt: 1500 }))).toBeNull()
    expect(classifyGesture(g({ dx: -120, pointerType: 'mouse' }))).toBeNull()
    expect(classifyGesture(g({ x: 10, pointerType: 'mouse' }))).toBeNull()
  })

  it('taps use thirds', () => {
    expect(classifyGesture(g({ x: 50 }))).toBe('prev')
    expect(classifyGesture(g({ x: 200 }))).toBe('middle')
    expect(classifyGesture(g({ x: 350 }))).toBe('next')
    expect(classifyGesture(g({ x: 350, dt: 900 }))).toBeNull()
  })
})

describe('formatElapsed', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(61_500)).toBe('1:01')
    expect(formatElapsed(3_725_000)).toBe('1:02:05')
    expect(formatElapsed(-5)).toBe('0:00')
  })
})

describe('isSyncMessage', () => {
  it('accepts only well-formed presenter messages', () => {
    expect(isSyncMessage({ type: 'hello' })).toBe(true)
    expect(isSyncMessage({ type: 'index', index: 3 })).toBe(true)
    expect(isSyncMessage({ type: 'index', index: 1.5 })).toBe(false)
    expect(isSyncMessage({ type: 'index' })).toBe(false)
    expect(isSyncMessage('hello')).toBe(false)
    expect(isSyncMessage(null)).toBe(false)
  })
})
