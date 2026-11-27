// Glyphs dssoca does not ship, registered once (trusted, authored here — never user input).
import { registerIcon, type IconName } from 'dssoca'

const EXTRA = {
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  copy: '<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v8h14v-8"/>',
  rows: '<rect x="4" y="3" width="16" height="8"/><rect x="4" y="13" width="16" height="8"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M7 4v16M17 4v16"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>',
  screen: '<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
} as const

for (const [k, v] of Object.entries(EXTRA)) registerIcon(k, v)

export type ExtraIcon = keyof typeof EXTRA
/** Name of a registered glyph, typed for `<Icon name>`. */
export const icon = (n: ExtraIcon | IconName) => n as IconName
