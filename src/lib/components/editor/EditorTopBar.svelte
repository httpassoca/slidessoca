<!-- Editor top bar: back, deck title, deck theme, undo/redo, present, share, downloads. -->
<script lang="ts">
  import { Button, Icon, Menu, type MenuItem } from 'dssoca'
  import { THEMES, themeEntry, type ThemeId } from '$lib/themes'
  import { glyph } from './icons'

  interface Props {
    title: string
    theme: ThemeId
    canUndo: boolean
    canRedo: boolean
    presentHref: string
    saved: boolean
    ontitle: (v: string) => void
    ontitleblur: () => void
    ontheme: (id: ThemeId) => void
    onundo: () => void
    onredo: () => void
    onshare: () => void
    onmarkdown: () => void
    onjson: () => void
    /** HTML (with speaker notes), JPGs (.zip) or PDF. */
    ondownload: (kind: 'html-notes' | 'jpg' | 'pdf') => void
  }

  let {
    title,
    theme,
    canUndo,
    canRedo,
    presentHref,
    saved,
    ontitle,
    ontitleblur,
    ontheme,
    onundo,
    onredo,
    onshare,
    onmarkdown,
    onjson,
    ondownload,
  }: Props = $props()

  const themeItems: MenuItem[] = $derived(
    THEMES.map((t) => ({
      id: t.id,
      label: t.label,
      swatch: t.swatch,
      selected: t.id === theme,
      onSelect: () => ontheme(t.id),
    })),
  )

  const moreItems: MenuItem[] = [
    { id: 'md', label: 'Download Markdown', onSelect: () => onmarkdown() },
    { id: 'json', label: 'Download JSON', onSelect: () => onjson() },
    { id: 'html', label: 'Download HTML', onSelect: () => ondownload('html-notes') },
    { id: 'jpg', label: 'Download JPGs (.zip)', onSelect: () => ondownload('jpg') },
    { id: 'pdf', label: 'Download PDF', onSelect: () => ondownload('pdf') },
  ]
</script>

<header class="bar">
  <a class="back" href="/" aria-label="All decks">
    <Icon name={glyph('back')} size="sm" />
  </a>
  <input
    class="title"
    aria-label="Deck title"
    value={title}
    oninput={(e) => ontitle(e.currentTarget.value)}
    onblur={ontitleblur}
    onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
  />
  <span class="status" aria-live="polite">{saved ? 'Saved' : 'Saving…'}</span>

  <div class="tools">
    <Menu items={themeItems} label="Deck theme" align="end" size="sm">
      <span class="swatch" style="background:{themeEntry(theme).swatch}" aria-hidden="true"></span>
      <span class="theme-label">{themeEntry(theme).label}</span>
    </Menu>
    <Button
      size="sm"
      variant="ghost"
      iconOnly
      label="Undo"
      title="Undo (Ctrl+Z)"
      disabled={!canUndo}
      onclick={onundo}
    >
      <Icon name={glyph('undo')} size="sm" />
    </Button>
    <Button
      size="sm"
      variant="ghost"
      iconOnly
      label="Redo"
      title="Redo (Ctrl+Shift+Z)"
      disabled={!canRedo}
      onclick={onredo}
    >
      <Icon name={glyph('redo')} size="sm" />
    </Button>
    <a class="present" href={presentHref} aria-label="Present">
      <Icon name={glyph('play')} size="sm" /><span class="present-label">Present</span>
    </a>
    <Button size="sm" variant="primary" onclick={onshare}>
      {#snippet leading()}<Icon name={glyph('share')} size="sm" />{/snippet}
      Share
    </Button>
    <Menu items={moreItems} label="More" align="end" size="sm">
      <Icon name={glyph('more')} size="sm" title="More" />
    </Menu>
  </div>
</header>

<style lang="scss">
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ss-s-2);
    padding: var(--ss-s-2) var(--ss-s-3);
    border-block-end: 1px solid var(--ss-line);
    background: var(--ss-bg-elev);
  }
  .back,
  .present {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--ss-s-1);
    min-block-size: 32px;
    min-inline-size: 32px;
    color: var(--ss-fg);
    text-decoration: none;
    border: 1px solid transparent;
    &:hover {
      border-color: var(--ss-line-strong);
    }
    &:focus-visible {
      outline: 2px solid var(--ss-primary);
    }
  }
  .present {
    padding-inline: var(--ss-s-2);
    border-color: var(--ss-line);
    font-size: var(--ss-size-sm);
  }
  .title {
    flex: 1 1 12rem;
    min-inline-size: 0;
    min-block-size: 32px;
    padding: 0 var(--ss-s-2);
    border: 1px solid transparent;
    border-radius: 0;
    background: transparent;
    color: var(--ss-fg);
    font-family: var(--ss-font-display);
    font-size: var(--ss-size-h3, 1.15rem);
    &:hover {
      border-color: var(--ss-line);
    }
    &:focus {
      outline: none;
      border-color: var(--ss-primary);
      background: var(--ss-bg);
    }
  }
  .status {
    color: var(--ss-fg-faint, var(--ss-fg-muted));
    font-size: var(--ss-size-xs);
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ss-s-1);
  }
  .swatch {
    display: inline-block;
    inline-size: 14px;
    block-size: 14px;
    outline: 1px solid var(--ss-line-strong);
  }
  @media (max-width: 760px) {
    .status,
    .theme-label,
    .present-label {
      display: none;
    }
    .tools {
      inline-size: 100%;
      flex-wrap: nowrap;
      justify-content: space-between;
    }
  }
</style>
