// /new keeps its drafts in module state: switching tabs (which unmounts panels) or peeking at the
// format help never loses what you typed. Reset after a deck is created.

import { nanoid } from 'nanoid'
import type { QuickBlock } from '$lib/deck/quick'
import { DEFAULT_THEME, type ThemeId } from '$lib/themes'

export interface DraftBlock extends QuickBlock {
  key: string
}

export const blankBlock = (title = '', text = ''): DraftBlock => ({
  key: nanoid(6),
  title,
  text,
  images: [],
})

class QuickDraft {
  title = $state('')
  theme = $state<ThemeId>(DEFAULT_THEME)
  mode = $state<'blocks' | 'text'>('blocks')
  blocks = $state<DraftBlock[]>([blankBlock(), blankBlock()])
  text = $state('')

  reset() {
    this.title = ''
    this.theme = DEFAULT_THEME
    this.mode = 'blocks'
    this.blocks = [blankBlock(), blankBlock()]
    this.text = ''
  }
}

class MarkdownDraft {
  source = $state('')
  fileName = $state('')
  /** Image file name → compressed data URL. */
  assets = $state<Record<string, string>>({})
  /** User overrides of the front-matter title / theme (null = use the file's). */
  title = $state<string | null>(null)
  theme = $state<ThemeId | null>(null)

  reset() {
    this.source = ''
    this.fileName = ''
    this.assets = {}
    this.title = null
    this.theme = null
  }
}

export const quick = new QuickDraft()
export const markdown = new MarkdownDraft()
