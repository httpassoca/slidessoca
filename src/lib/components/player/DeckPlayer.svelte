<!--
  The deck player: one slide at a time, letterboxed to any viewport. Used by the public viewer
  (/s/[id]) and the presenter's audience window (/present/[id]?audience=1).

  Keyboard: ←/→ PageUp/PageDown Space (Shift+Space back) Home/End · F fullscreen · O/Esc overview.
  Touch: swipe left/right, tap the left/right third; tapping the middle shows/hides the bar.
  `hash` keeps `#n` (1-based) in the URL so a slide can be linked to.
-->
<script lang="ts">
  import { counter } from '$lib/deck/count'
  import { onMount, type Snippet } from 'svelte'
  import { fly } from 'svelte/transition'
  import { prefersReducedMotion } from 'svelte/motion'
  import { replaceState } from '$app/navigation'
  import { Button, Icon } from 'dssoca'
  import SlideView from '$lib/components/SlideView.svelte'
  import type { Deck } from '$lib/deck/types'
  import { themeAttributes } from '$lib/themes'
  import {
    clampIndex,
    hashFor,
    indexFromHash,
    neighbours,
    step,
    type GestureResult,
    type NavAction,
  } from '$lib/deck/nav'
  import Stage from './Stage.svelte'
  import Overview from './Overview.svelte'
  import NoFullscreenHint from './NoFullscreenHint.svelte'
  import { gestures } from './gestures'
  import { playerKey } from './keys'
  import { fullscreenState, toggleFullscreen } from './fullscreen.svelte'
  import { preloadSlides } from './preload'
  import { icon } from './icons'

  interface Props {
    deck: Deck
    /** Current slide (0-based). Bindable. */
    index?: number
    /** Overview grid open. Bindable. */
    overview?: boolean
    /** Mirror the slide in the URL hash (#n, 1-based). */
    hash?: boolean
    /** Show the control bar (prev/next, counter, overview, fullscreen). */
    chrome?: boolean
    /** Listen to the keyboard (window-wide). */
    keyboard?: boolean
    /** Extra bar content after the counter (e.g. the deck title). */
    start?: Snippet
    /** Extra bar actions before overview / fullscreen. */
    end?: Snippet
    /** Actions the player does not handle itself (e.g. `notes`). */
    onaction?: (a: NavAction) => void
  }

  let {
    deck,
    index = $bindable(0),
    overview = $bindable(false),
    hash = false,
    chrome = true,
    keyboard = true,
    start,
    end,
    onaction,
  }: Props = $props()

  let root = $state<HTMLElement>()
  let bar = $state<HTMLElement>()
  let barHidden = $state(false)
  let dir = $state(1)
  let mounted = $state(false)
  const fs = fullscreenState()

  const count = $derived(deck.slides.length)
  const current = $derived(deck.slides[clampIndex(index, count)])
  const duration = $derived(prefersReducedMotion.current ? 0 : 220)

  export function go(i: number) {
    const next = clampIndex(i, count)
    if (next === index) return
    dir = next > index ? 1 : -1
    index = next
  }

  function act(a: NavAction): boolean {
    if (overview && (a === 'overview' || a === 'select')) {
      overview = false
      return true
    }
    const to = step(a, index, count)
    if (to !== null) {
      go(to)
      return true
    }
    if (a === 'fullscreen' && root && fs.supported) {
      toggleFullscreen(root)
      return true
    }
    if (a === 'overview') {
      overview = true
      return true
    }
    if (a === 'select') return false
    onaction?.(a)
    return !!onaction
  }

  function onkey(e: KeyboardEvent) {
    if (!keyboard) return
    const a = playerKey(e)
    if (a && act(a)) e.preventDefault()
  }

  function onGesture(r: Exclude<GestureResult, null>) {
    if (r === 'middle') barHidden = !barHidden
    else act(r)
  }
  const stageGestures = gestures(onGesture)

  function fromHash() {
    const h = indexFromHash(location.hash, count)
    if (h !== null) go(h)
  }

  onMount(() => {
    if (hash) fromHash()
    mounted = true
  })

  // Keep #n in the URL (shallow, no history entry per slide). A clean URL stays clean on slide 1.
  // Deferred: during hydration this runs before SvelteKit's router has its root component.
  $effect(() => {
    if (!hash || !mounted) return
    const i = clampIndex(index, count)
    const want = hashFor(i)
    const from = location.hash
    if (from === want || (i === 0 && !from)) return
    const t = setTimeout(() => {
      // If the URL moved meanwhile (user typed/followed a #n link), that wins.
      if (location.hash === from) replaceState(want, {})
    })
    return () => clearTimeout(t)
  })

  $effect(() => {
    preloadSlides(neighbours(index, count).map((i) => deck.slides[i]))
  })
</script>

<svelte:window onkeydown={onkey} onhashchange={() => hash && fromHash()} />

<div
  class="player"
  class:fs={fs.on}
  bind:this={root}
  tabindex="-1"
  {...themeAttributes(deck.theme)}
>
  <div class="viewport">
    {#if current}
      <Stage attach={stageGestures}>
        {#key current.id}
          <div class="slide" in:fly={{ x: dir * 40, duration, opacity: 0 }}>
            <SlideView slide={current} theme={deck.theme} label="Slide {index + 1} of {count}" />
          </div>
        {/key}
      </Stage>
    {:else}
      <p class="empty">This deck has no slides.</p>
    {/if}
  </div>

  <div class="progress" aria-hidden="true">
    <span style="inline-size: {count ? ((index + 1) / count) * 100 : 0}%"></span>
  </div>

  <NoFullscreenHint
    {chrome}
    hidden={chrome && barHidden}
    returnFocus={() => bar?.querySelector<HTMLElement>('button:not(:disabled)') ?? root}
  />

  {#if chrome && !barHidden}
    <nav class="bar" aria-label="Slide controls" bind:this={bar}>
      <div class="nav">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          label="Previous slide"
          disabled={index <= 0}
          onclick={() => go(index - 1)}
        >
          <Icon name="chevron" rotate={90} />
        </Button>
        <span class="counter">
          <span class="sr-only">Slide {count ? index + 1 : 0} of {count}</span><span
            aria-hidden="true"
          >
            {counter(index, count)}
          </span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          label="Next slide"
          disabled={index >= count - 1}
          onclick={() => go(index + 1)}
        >
          <Icon name="chevron" rotate={270} />
        </Button>
      </div>
      <div class="start">{@render start?.()}</div>
      <div class="end">
        {@render end?.()}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          label="All slides (O)"
          aria-pressed={overview}
          onclick={() => (overview = !overview)}
        >
          <Icon name="grid" />
        </Button>
        {#if fs.supported}
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            label={fs.on ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            onclick={() => root && toggleFullscreen(root)}
          >
            <Icon name={icon(fs.on ? 'shrink' : 'expand')} />
          </Button>
        {/if}
      </div>
    </nav>
  {/if}

  <p class="sr-only" aria-live="polite">Slide {index + 1} of {count}</p>

  {#if overview}
    <Overview
      {deck}
      {index}
      onpick={(i) => {
        go(i)
        overview = false
      }}
      onclose={() => (overview = false)}
    />
  {/if}
</div>

<style lang="scss">
  .player {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: 100%;
    block-size: 100%;
    min-block-size: 0;
    /* Letterbox: a shade darker than the deck background so the slide edge reads. */
    background: color-mix(in oklch, var(--ss-bg) 82%, var(--ss-black));
    color: var(--ss-fg);
    overflow: hidden;
    &:focus {
      outline: none;
    }
  }
  .viewport {
    flex: 1;
    min-block-size: 0;
    padding: var(--ss-s-2);
  }
  .fs .viewport {
    padding: 0;
  }
  .slide {
    inline-size: 100%;
  }
  .empty {
    display: grid;
    place-items: center;
    block-size: 100%;
    margin: 0;
    color: var(--ss-fg-muted);
  }
  .progress {
    block-size: 3px;
    background: var(--ss-line);
    span {
      display: block;
      block-size: 100%;
      background: var(--ss-primary);
      transition: inline-size var(--ss-dur) var(--ss-ease);
    }
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--ss-s-2);
    padding: var(--ss-s-1) var(--ss-s-2);
    padding-block-end: max(var(--ss-s-1), env(safe-area-inset-bottom));
    background: var(--ss-bg);
    border-block-start: 1px solid var(--ss-line);
    min-block-size: 40px;
  }
  .nav,
  .end {
    display: flex;
    align-items: center;
    gap: var(--ss-s-1);
    flex: none;
  }
  .start {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    align-items: center;
    gap: var(--ss-s-2);
  }
  .counter {
    min-inline-size: 5ch;
    text-align: center;
    font-family: var(--ss-font-mono);
    font-size: var(--ss-size-sm);
    font-variant-numeric: tabular-nums;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .progress span {
      transition: none;
    }
  }
</style>
