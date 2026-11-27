<!--
  Present a LOCAL deck (IndexedDB). URL: /present/<deckId>?start=<0-based slide index>.

  Presenter view: current slide, next slide, speaker notes, elapsed timer, counter, overview.
  "Audience window" opens /present/<id>?audience=1 — a clean full-window player kept in sync
  over a BroadcastChannel (either window can drive). On narrow screens the notes collapse under
  the slide. Keys: ←/→ Space PageUp/Down Home/End · F fullscreen · O/Esc overview · N notes.
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { Button, EmptyState, Icon, Link, Spinner } from 'dssoca'
  import SlideView from '$lib/components/SlideView.svelte'
  import DeckPlayer from '$lib/components/player/DeckPlayer.svelte'
  import Overview from '$lib/components/player/Overview.svelte'
  import Stage from '$lib/components/player/Stage.svelte'
  import { gestures } from '$lib/components/player/gestures'
  import { playerKey } from '$lib/components/player/keys'
  import { icon } from '$lib/components/player/icons'
  import { fullscreenState, toggleFullscreen } from '$lib/components/player/fullscreen.svelte'
  import { preloadSlides } from '$lib/components/player/preload'
  import { getDeck } from '$lib/client/db'
  import type { Deck } from '$lib/deck/types'
  import { renderMarkdown } from '$lib/deck/render'
  import { themeAttributes } from '$lib/themes'
  import {
    clampIndex,
    formatElapsed,
    indexFromStart,
    isSyncMessage,
    neighbours,
    step,
    syncChannelName,
    type NavAction,
    type SyncMessage,
  } from '$lib/deck/nav'

  const id = $derived(page.params.id ?? '')
  const audience = $derived(page.url.searchParams.get('audience') === '1')

  let deck = $state<Deck | null>(null)
  let missing = $state(false)
  let index = $state(0)
  let overview = $state(false)
  let showNotes = $state(true)
  let root = $state<HTMLElement>()
  const fs = fullscreenState()

  // Timer: elapsed = accumulated + (running ? now - since : 0).
  let since = $state(Date.now())
  let accumulated = $state(0)
  let running = $state(true)
  let now = $state(Date.now())
  const elapsed = $derived(accumulated + (running ? now - since : 0))

  const count = $derived(deck?.slides.length ?? 0)
  const current = $derived(deck?.slides[clampIndex(index, count)])
  const next = $derived(deck && index + 1 < count ? deck.slides[index + 1] : null)

  let channel: BroadcastChannel | null = null
  let lastSynced = -1

  onMount(() => {
    let alive = true
    getDeck(id)
      .then((d) => {
        if (!alive) return
        if (!d) missing = true
        else {
          deck = d
          index = indexFromStart(page.url.searchParams.get('start'), d.slides.length)
        }
      })
      .catch(() => (missing = true))

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(syncChannelName(id))
      channel.onmessage = (e: MessageEvent) => {
        const m = e.data as unknown
        if (!isSyncMessage(m)) return
        if (m.type === 'hello') post({ type: 'index', index })
        else {
          lastSynced = m.index
          index = clampIndex(m.index, count || m.index + 1)
        }
      }
      if (audience) post({ type: 'hello' })
    }
    const tick = setInterval(() => (now = Date.now()), 500)
    return () => {
      alive = false
      clearInterval(tick)
      channel?.close()
      channel = null
    }
  })

  function post(m: SyncMessage) {
    channel?.postMessage(m)
  }

  // Tell the other window whenever this one moved.
  $effect(() => {
    if (!deck) return
    if (index !== lastSynced) {
      lastSynced = index
      post({ type: 'index', index })
    }
  })

  $effect(() => {
    if (deck) preloadSlides(neighbours(index, count).map((i) => deck!.slides[i]))
  })

  function go(i: number) {
    index = clampIndex(i, count)
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
    if (a === 'fullscreen' && root && fs.supported) toggleFullscreen(root)
    else if (a === 'overview') overview = true
    else if (a === 'notes') showNotes = !showNotes
    else return false
    return true
  }

  function onkey(e: KeyboardEvent) {
    if (audience || !deck) return
    const a = playerKey(e)
    if (a && act(a)) e.preventDefault()
  }

  const stageGestures = gestures((r) => {
    if (r !== 'middle') act(r)
  })

  function toggleTimer() {
    const t = Date.now()
    if (running) accumulated += t - since
    else since = t
    running = !running
    now = t
  }

  function resetTimer() {
    accumulated = 0
    since = Date.now()
    now = since
  }

  function openAudience() {
    window.open(
      `/present/${encodeURIComponent(id)}?audience=1&start=${index}`,
      `slidessoca-audience-${id}`,
      'popup,width=1280,height=720',
    )
  }
</script>

<svelte:window onkeydown={onkey} />

<svelte:head>
  <title>{deck ? `${deck.title} · presenting` : 'Presenting'} · slidessoca</title>
</svelte:head>

{#if missing}
  <main class="center">
    <EmptyState
      title="Deck not found"
      message="This deck is not in this browser. Decks are stored locally — open it from the browser where you made it."
    />
    <Link variant="button" href="/">Your decks</Link>
  </main>
{:else if !deck}
  <main class="center"><Spinner label="Loading deck" /></main>
{:else if audience}
  <main class="audience">
    <DeckPlayer {deck} bind:index bind:overview chrome={false} />
  </main>
{:else}
  <main
    class="presenter"
    bind:this={root}
    class:no-notes={!showNotes}
    {...themeAttributes(deck.theme)}
  >
    <header class="bar">
      <h1 class="title" title={deck.title}>{deck.title}</h1>
      <div class="timer" role="timer" aria-label="Elapsed time">
        <span class="clock">{formatElapsed(elapsed)}</span>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          label={running ? 'Pause timer' : 'Resume timer'}
          onclick={toggleTimer}
        >
          <Icon name={icon(running ? 'pause' : 'play')} />
        </Button>
        <Button size="sm" variant="ghost" iconOnly label="Reset timer" onclick={resetTimer}>
          <Icon name={icon('reset')} />
        </Button>
      </div>
      <div class="tools">
        <Button size="sm" variant="secondary" onclick={openAudience}>
          {#snippet leading()}<Icon name={icon('screen')} />{/snippet}
          <span class="wide">Audience window</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          label="Speaker notes (N)"
          aria-pressed={showNotes}
          onclick={() => (showNotes = !showNotes)}
        >
          <Icon name="note" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          label="All slides (O)"
          aria-pressed={overview}
          onclick={() => (overview = !overview)}
        >
          <Icon name="grid" />
        </Button>
        {#if fs.supported}
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            label={fs.on ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            onclick={() => root && toggleFullscreen(root)}
          >
            <Icon name={icon(fs.on ? 'shrink' : 'expand')} />
          </Button>
        {/if}
        <Button size="sm" variant="ghost" onclick={() => goto(`/edit/${id}`)}>Exit</Button>
      </div>
    </header>

    <section class="current" aria-label="Current slide">
      {#if current}
        <Stage attach={stageGestures}>
          <SlideView slide={current} theme={deck.theme} label="Slide {index + 1} of {count}" />
        </Stage>
      {/if}
    </section>

    <nav class="controls" aria-label="Slide controls">
      <Button variant="secondary" disabled={index <= 0} onclick={() => go(index - 1)}>
        {#snippet leading()}<Icon name="chevron" rotate={90} />{/snippet}
        Prev
      </Button>
      <span class="counter" aria-live="polite">
        <span class="sr-only">Slide</span>
        {index + 1} / {count}
      </span>
      <Button variant="primary" disabled={index >= count - 1} onclick={() => go(index + 1)}>
        Next
        {#snippet trailing()}<Icon name="chevron" rotate={270} />{/snippet}
      </Button>
    </nav>

    <aside class="side">
      <section class="next" aria-label="Next slide">
        <h2>Next</h2>
        {#if next}
          <button type="button" class="next-thumb" onclick={() => go(index + 1)}>
            <SlideView slide={next} theme={deck.theme} thumbnail />
          </button>
        {:else}
          <p class="end">End of deck</p>
        {/if}
      </section>
      {#if showNotes}
        <details class="notes" open>
          <summary>Notes</summary>
          {#if current?.notes.trim()}
            <div class="notes-text">{@html renderMarkdown(current.notes)}</div>
          {:else}
            <p class="muted">No notes for this slide.</p>
          {/if}
        </details>
      {/if}
    </aside>

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
  </main>
{/if}

<style lang="scss">
  /* Full-viewport pages: no UA body margin around the player. */
  :global(body) {
    margin: 0;
  }
  .center {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--ss-s-4);
    min-block-size: 100dvh;
    padding: var(--ss-s-4);
    text-align: center;
  }
  .audience {
    block-size: 100dvh;
  }
  .presenter {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'bar bar'
      'current side'
      'controls side';
    block-size: 100dvh;
    /* Letterbox: a shade darker than the deck background so the slide edge reads. */
    background: color-mix(in oklch, var(--ss-bg) 82%, var(--ss-black));
    color: var(--ss-fg);
    overflow: hidden;
  }
  .bar {
    grid-area: bar;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ss-s-3);
    padding: var(--ss-s-1) var(--ss-s-3);
    background: var(--ss-bg);
    border-block-end: 1px solid var(--ss-line);
  }
  .title {
    flex: 1 1 12rem;
    min-inline-size: 0;
    margin: 0;
    font-size: var(--ss-size-body);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .timer,
  .tools {
    display: flex;
    align-items: center;
    gap: var(--ss-s-1);
  }
  .clock {
    font-family: var(--ss-font-mono);
    font-size: var(--ss-size-h3);
    font-variant-numeric: tabular-nums;
    min-inline-size: 5ch;
    text-align: end;
  }
  .current {
    grid-area: current;
    min-block-size: 0;
    padding: var(--ss-s-3);
  }
  .controls {
    grid-area: controls;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--ss-s-4);
    padding: var(--ss-s-2) var(--ss-s-3) max(var(--ss-s-2), env(safe-area-inset-bottom));
  }
  .counter {
    font-family: var(--ss-font-mono);
    font-variant-numeric: tabular-nums;
    min-inline-size: 7ch;
    text-align: center;
  }
  .side {
    grid-area: side;
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-3);
    min-block-size: 0;
    padding: var(--ss-s-3);
    background: var(--ss-bg);
    border-inline-start: 1px solid var(--ss-line);
    overflow-y: auto;
    h2 {
      margin: 0 0 var(--ss-s-1);
      font-size: var(--ss-size-sm);
      color: var(--ss-fg-muted);
      font-weight: 400;
    }
  }
  .next-thumb {
    display: block;
    inline-size: 100%;
    padding: 0;
    border: 1px solid var(--ss-line);
    background: none;
    cursor: pointer;
    &:hover {
      border-color: var(--ss-primary);
    }
  }
  .end,
  .muted {
    margin: 0;
    color: var(--ss-fg-muted);
  }
  .notes {
    flex: 1;
    summary {
      min-block-size: 24px;
      color: var(--ss-fg-muted);
      font-size: var(--ss-size-sm);
      cursor: pointer;
    }
  }
  .notes-text {
    margin-block-start: var(--ss-s-2);
    font-size: var(--ss-size-h3);
    line-height: 1.45;
    :global(p) {
      margin: 0 0 0.6em;
    }
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Phones / narrow windows: one column, notes collapse under the slide. */
  @media (max-width: 800px) and (min-height: 501px) {
    .presenter {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto auto 1fr;
      grid-template-areas: 'bar' 'current' 'controls' 'side';
      block-size: auto;
      min-block-size: 100dvh;
      overflow: visible;
    }
    .current {
      padding: var(--ss-s-2);
    }
    .current :global(.stage) {
      block-size: auto;
      container-type: inline-size;
    }
    .current :global(.frame) {
      inline-size: 100%;
    }
    .side {
      border-inline-start: none;
      border-block-start: 1px solid var(--ss-line);
    }
    .next {
      max-inline-size: 50%;
    }
    .notes-text {
      font-size: var(--ss-size-body);
    }
    .wide {
      display: none;
    }
  }
  /* Landscape phones: slide + controls on the left, next + notes on the right. */
  @media (max-height: 500px) {
    .presenter {
      grid-template-columns: minmax(0, 3fr) minmax(200px, 2fr);
    }
    .clock {
      font-size: var(--ss-size-body);
    }
    .wide {
      display: none;
    }
  }
</style>
