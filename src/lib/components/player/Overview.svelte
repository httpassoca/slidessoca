<!--
  "Check every page": every slide as a thumbnail; pick one to jump there. Rendered inside the
  player root (absolute overlay) so it also works in fullscreen.
-->
<script lang="ts">
  import { pad } from '$lib/deck/count'
  import { Button, Icon } from 'dssoca'
  import SlideView from '$lib/components/SlideView.svelte'
  import type { Deck } from '$lib/deck/types'
  import { icon } from './icons'

  interface Props {
    deck: Deck
    index: number
    onpick: (i: number) => void
    onclose: () => void
  }

  let { deck, index, onpick, onclose }: Props = $props()
  let grid = $state<HTMLElement>()

  // Keep the highlighted slide focused and visible (arrow keys move it from the player).
  $effect(() => {
    const el = grid?.querySelector<HTMLElement>(`[data-i="${index}"]`)
    if (!el) return
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: 'nearest' })
  })
</script>

<div class="overview" role="dialog" aria-modal="true" aria-label="All slides">
  <header class="head">
    <h2>All slides <span class="count">{pad(deck.slides.length, deck.slides.length)}</span></h2>
    <Button variant="ghost" size="sm" iconOnly label="Close overview (Esc)" onclick={onclose}>
      <Icon name={icon('close')} />
    </Button>
  </header>
  <ol class="grid" bind:this={grid}>
    {#each deck.slides as s, i (s.id)}
      <li>
        <button
          type="button"
          class="thumb"
          data-i={i}
          aria-current={i === index ? 'true' : undefined}
          aria-label="Slide {i + 1}"
          onclick={() => onpick(i)}
        >
          <SlideView slide={s} theme={deck.theme} thumbnail />
          <span class="num">{pad(i + 1, deck.slides.length)}</span>
        </button>
      </li>
    {/each}
  </ol>
</div>

<style lang="scss">
  .overview {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    background: var(--ss-bg);
    color: var(--ss-fg);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ss-s-3);
    padding: var(--ss-s-2) var(--ss-s-4);
    border-block-end: 1px solid var(--ss-line);
    h2 {
      margin: 0;
      font-family: var(--ss-font-display);
      font-size: var(--ss-size-h3);
    }
  }
  .count {
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
    margin-inline-start: var(--ss-s-2);
  }
  .grid {
    flex: 1;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(220px, 40vw), 1fr));
    align-content: start;
    gap: var(--ss-s-4);
    margin: 0;
    padding: var(--ss-s-4);
    list-style: none;
  }
  .thumb {
    position: relative;
    display: block;
    inline-size: 100%;
    padding: 0;
    border: 2px solid var(--ss-line);
    background: none;
    cursor: pointer;
    &:hover {
      border-color: var(--ss-line-strong);
    }
    &[aria-current='true'] {
      border-color: var(--ss-primary);
    }
    &:focus-visible {
      outline: 2px solid var(--ss-primary);
      outline-offset: 2px;
    }
  }
  .num {
    position: absolute;
    inset-block-end: 0;
    inset-inline-start: 0;
    min-inline-size: 24px;
    padding: 0 var(--ss-s-1);
    background: var(--ss-bg-elev);
    color: var(--ss-fg);
    font-family: var(--ss-font-mono);
    font-size: var(--ss-size-xs);
    line-height: 24px;
    text-align: center;
  }
  [aria-current='true'] .num {
    background: var(--ss-primary);
    color: var(--ss-fg-on-primary);
  }
</style>
