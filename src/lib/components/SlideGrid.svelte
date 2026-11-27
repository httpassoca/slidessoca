<!-- Numbered grid of slide thumbnails (previews on /new). Drawn with SlideView, like everything. -->
<script lang="ts">
  import SlideView from './SlideView.svelte'
  import type { Slide } from '$lib/deck/types'
  import type { ThemeId } from '$lib/themes'

  interface Props {
    slides: Slide[]
    theme: ThemeId
    label?: string
  }
  let { slides, theme, label = 'Slide preview' }: Props = $props()
</script>

<ol class="grid" aria-label={label}>
  <!-- Keyed by position: ids are regenerated on every keystroke while previewing. -->
  {#each slides as s, i (i)}
    <li>
      <SlideView slide={s} {theme} thumbnail />
      <span class="meta"><span class="n">{i + 1}</span>{s.content.title || s.layout}</span>
    </li>
  {/each}
</ol>

<style lang="scss">
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
    gap: var(--ss-s-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    gap: var(--ss-s-1);
    min-inline-size: 0;
    :global(.slide) {
      outline: 1px solid var(--ss-line);
    }
  }
  .meta {
    display: flex;
    gap: var(--ss-s-2);
    font-size: var(--ss-size-xs);
    color: var(--ss-fg-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .n {
    color: var(--ss-primary);
    font-family: var(--ss-font-mono);
  }
</style>
