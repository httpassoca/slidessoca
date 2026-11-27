// Fullscreen API with the WebKit prefix (iPadOS Safari). iPhone Safari has no element
// fullscreen at all, so callers hide the button when `fullscreenSupported()` is false.

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
  webkitFullscreenEnabled?: boolean
}
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

export function fullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false
  const d = document as FsDoc
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled)
}

export function fullscreenElement(): Element | null {
  const d = document as FsDoc
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null
}

export async function toggleFullscreen(el: HTMLElement): Promise<void> {
  const d = document as FsDoc
  const f = el as FsEl
  try {
    if (fullscreenElement()) await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.())
    else await (f.requestFullscreen?.() ?? f.webkitRequestFullscreen?.())
  } catch {
    /* refused (no user gesture, iframe without allowfullscreen…) — nothing to do */
  }
}

/** Reactive fullscreen flags. Call during component init. */
export function fullscreenState() {
  let on = $state(false)
  let supported = $state(false)
  $effect(() => {
    supported = fullscreenSupported()
    const sync = () => (on = !!fullscreenElement())
    sync()
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  })
  return {
    get on() {
      return on
    },
    get supported() {
      return supported
    },
  }
}
