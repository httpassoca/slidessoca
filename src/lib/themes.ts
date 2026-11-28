// Deck themes = the passoca.dev theme menu: dssoca's own dark/light plus every dssoca preset
// palette. A theme is applied by putting `data-theme` (+ `data-palette`) on the slide root, so a
// deck can wear a different theme than the editor chrome around it.

import tokensCss from 'dssoca/tokens.css?raw'
import { PRESET_THEMES, presetPalette, paletteSlotVar, PALETTE_SLOTS } from 'dssoca'
import type { PresetName, ThemePalette } from 'dssoca'

export type ThemeMode = 'dark' | 'light'
export type ThemeId = ThemeMode | PresetName

export interface ThemeEntry {
  id: ThemeId
  label: string
  mode: ThemeMode
  palette: PresetName | null
  /** Swatch for pickers. */
  swatch: string
  /** Page background (meta theme-color, thumbnails before paint). */
  bg: string
}

export const THEMES: readonly ThemeEntry[] = [
  { id: 'dark', label: 'Dark', mode: 'dark', palette: null, swatch: '#66ef73', bg: '#100f10' },
  { id: 'light', label: 'Light', mode: 'light', palette: null, swatch: '#2b7c34', bg: '#ebf2eb' },
  ...PRESET_THEMES.map((p): ThemeEntry => {
    const mode: ThemeMode = p.dark ? 'dark' : 'light'
    return {
      id: p.name,
      label: p.label,
      mode,
      palette: p.name,
      swatch: p.accent,
      bg: (p.dark ?? p.light)!.bg,
    }
  }),
]

export const DEFAULT_THEME: ThemeId = 'dark'

export function isThemeId(v: unknown): v is ThemeId {
  return THEMES.some((t) => t.id === v)
}

export function themeEntry(id: ThemeId): ThemeEntry {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

/** Attributes to spread on a slide/deck root so tokens below it use the theme. */
export function themeAttributes(id: ThemeId): Record<string, string | undefined> {
  const e = themeEntry(id)
  return { 'data-theme': e.mode, 'data-palette': e.palette ?? undefined, 'data-deck-theme': '' }
}

const block = (sel: string, t: ThemePalette) =>
  `${sel}{${PALETTE_SLOTS.map((s) => `${paletteSlotVar(s)}:${t[s]}`).join(';')}}`

/**
 * Per-preset `--ss-*` slot overrides keyed on `[data-palette][data-theme]` (specificity 0,2,0 beats
 * tokens.css). Same technique as passoca.dev. Injected once in the root layout.
 */
export const presetCss = PRESET_THEMES.map((p) => {
  const pal = presetPalette(p.name)
  return (
    block(`[data-palette='${p.name}'][data-theme='dark']`, pal.dark) +
    block(`[data-palette='${p.name}'][data-theme='light']`, pal.light)
  )
}).join('\n')

/**
 * dssoca derives its semantic tokens (`--ss-primary`, `--ss-fg-muted`, `--ss-bg-elev`…) from the
 * palette slots on `:root` only, and custom properties resolve where they are declared. A light
 * deck inside the dark app chrome would inherit the root's dark-derived values (bright green
 * accent on a light slide). Re-declaring the semantic layers on every themed deck root makes them
 * resolve against that deck's own slots. Extracted from dssoca's tokens.css so it never drifts.
 */
export function semanticBlocks(css: string): { base: string; light: string } {
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(),
    body: m[2],
  }))
  const isSlotBlock = (b: string) => /--ss-bg:/.test(b) && /--ss-black:/.test(b)
  const base = blocks.find((b) => b.sel.includes(':root') && b.body.includes('--ss-primary:'))
  const light = blocks.find(
    (b) => b.sel === '[data-theme=light]' && !isSlotBlock(b.body) && b.body.includes('--ss-'),
  )
  return { base: base?.body.trim() ?? '', light: light?.body.trim() ?? '' }
}

const sem = semanticBlocks(tokensCss)
export const deckTokenCss =
  `[data-deck-theme][data-theme]{${sem.base}}` +
  `[data-deck-theme][data-theme='light']{${sem.light}}`
