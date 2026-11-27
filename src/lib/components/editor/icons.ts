// Editor glyphs dssoca's curated set lacks. Trusted, hand-written markup (24×24, stroked).
import { registerIcon, type IconName } from 'dssoca'

const GLYPHS = {
  undo: '<path d="M9 7H4v5"/><path d="M4 12a8 8 0 1 1 2.3 5.7"/>',
  redo: '<path d="M15 7h5v5"/><path d="M20 12a8 8 0 1 0-2.3 5.7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12"/><path d="M4 16V4h12"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
  back: '<path d="M19 12H5M11 5l-7 7 7 7"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  share:
    '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/>',
  panel: '<rect x="3" y="4" width="18" height="16"/><path d="M3 14h18"/>',
} as const

for (const [name, paths] of Object.entries(GLYPHS)) registerIcon(name, paths)

/** Typed handle for a registered editor glyph. */
export const glyph = (name: keyof typeof GLYPHS) => name as unknown as IconName
