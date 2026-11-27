import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/svelte'

afterEach(() => cleanup())

// jsdom lacks matchMedia; dssoca's Toaster (via Svelte's prefersReducedMotion) reads it at import.
if (typeof window !== 'undefined' && !window.matchMedia) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}

// SlideView's auto-fit uses ResizeObserver.
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (typeof Element !== 'undefined' && !('animate' in Element.prototype)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Element.prototype as any).animate = () => ({
    cancel() {},
    finish() {},
    play() {},
    pause() {},
    addEventListener() {},
    removeEventListener() {},
    finished: Promise.resolve(),
    onfinish: null,
  })
}
