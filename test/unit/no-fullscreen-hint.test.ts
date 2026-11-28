import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import NoFullscreenHint from '$lib/components/player/NoFullscreenHint.svelte'
import { PREFS } from '$lib/client/prefs'

const HINT = /Fullscreen isn't available on this browser/

function setFullscreen(enabled: boolean | undefined) {
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: enabled })
}

describe('NoFullscreenHint', () => {
  beforeEach(() => {
    localStorage.clear()
    setFullscreen(false) // iPhone Safari: no element fullscreen
  })
  afterEach(() => setFullscreen(undefined))

  it('shows in a polite live region where fullscreen is unavailable', async () => {
    render(NoFullscreenHint)
    await tick()
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(HINT)
    expect(status).toHaveTextContent(/Tap the middle of the slide to hide the controls/)
  })

  it('speaks about the slide only when there is no control bar', async () => {
    render(NoFullscreenHint, { chrome: false })
    await tick()
    expect(screen.getByRole('status')).not.toHaveTextContent(/hide the controls/)
    expect(screen.getByRole('status')).toHaveTextContent(HINT)
  })

  it('stays hidden where fullscreen is supported', async () => {
    setFullscreen(true)
    render(NoFullscreenHint)
    await tick()
    expect(screen.queryByText(HINT)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dismiss hint' })).toBeNull()
  })

  it('dismisses for good and returns focus', async () => {
    const target = document.createElement('button')
    document.body.append(target)
    const first = render(NoFullscreenHint, { returnFocus: () => target })
    await tick()
    const close = screen.getByRole('button', { name: 'Dismiss hint' })
    close.focus()
    await fireEvent.click(close)
    expect(screen.queryByText(HINT)).toBeNull()
    expect(document.activeElement).toBe(target)
    expect(localStorage.getItem(PREFS.noFullscreenHint)).toBeTruthy()

    first.unmount()
    render(NoFullscreenHint)
    await tick()
    expect(screen.queryByText(HINT)).toBeNull()
    target.remove()
  })

  it('still works when localStorage throws', async () => {
    const get = Storage.prototype.getItem
    const set = Storage.prototype.setItem
    Storage.prototype.getItem = () => {
      throw new Error('blocked')
    }
    Storage.prototype.setItem = () => {
      throw new Error('blocked')
    }
    try {
      render(NoFullscreenHint)
      await tick()
      await fireEvent.click(screen.getByRole('button', { name: 'Dismiss hint' }))
      expect(screen.queryByText(HINT)).toBeNull()
    } finally {
      Storage.prototype.getItem = get
      Storage.prototype.setItem = set
    }
  })

  it('tucks away with the bar without dismissing', async () => {
    const { container, rerender } = render(NoFullscreenHint, { hidden: true })
    await tick()
    expect(container.querySelector('.hint')).toHaveClass('tucked')
    await rerender({ hidden: false })
    expect(container.querySelector('.hint')).not.toHaveClass('tucked')
    expect(localStorage.getItem(PREFS.noFullscreenHint)).toBeNull()
  })
})
