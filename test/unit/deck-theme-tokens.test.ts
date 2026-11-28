import { describe, expect, it } from 'vitest'
import { deckTokenCss, semanticBlocks, themeAttributes } from '$lib/themes'

describe('deck-scoped semantic tokens', () => {
  it('extracts the derived layer from dssoca tokens.css', () => {
    expect(deckTokenCss).toContain('--ss-primary: var(--ss-accent)')
    expect(deckTokenCss).toMatch(
      /\[data-deck-theme\]\[data-theme='light'\]\{[^}]*--ss-fg-on-primary/,
    )
    // The slot layer (palette values) must not be re-declared, or presets would be overridden.
    expect(deckTokenCss).not.toMatch(/--ss-black:/)
  })
  it('parses a minimal token file', () => {
    const css = `:root,[data-theme=dark]{--ss-bg:#000;--ss-black:#000}[data-theme=light]{--ss-bg:#fff;--ss-black:#111}:root,[data-theme=dark]{--ss-primary:var(--ss-accent)}[data-theme=light]{--ss-line:red}`
    expect(semanticBlocks(css)).toEqual({
      base: '--ss-primary:var(--ss-accent)',
      light: '--ss-line:red',
    })
  })
  it('marks deck roots', () => {
    expect(themeAttributes('light')).toMatchObject({ 'data-theme': 'light', 'data-deck-theme': '' })
  })
})
