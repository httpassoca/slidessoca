<!--
  A ready-made example deck (SL-0012), read-only: slideshow or read mode, "Make a copy" (a new
  local deck the user can edit) and "Present" (the presenter view, notes included).
-->
<script lang="ts">
  import { goto, replaceState } from '$app/navigation'
  import { page } from '$app/state'
  import { Button, EmptyState, Icon, Link, toast } from 'dssoca'
  import DeckPlayer from '$lib/components/player/DeckPlayer.svelte'
  import SlideView from '$lib/components/SlideView.svelte'
  import { icon } from '$lib/components/player/icons'
  import { putDeck } from '$lib/client/db'
  import { counter } from '$lib/deck/count'
  import { copyDeck } from '$lib/deck/factory'
  import { hashFor } from '$lib/deck/nav'
  import { exampleBySlug, exampleDeck } from '$lib/examples'
  import { themeAttributes, themeEntry } from '$lib/themes'

  const example = $derived(exampleBySlug(page.params.slug ?? ''))
  const deck = $derived(example ? exampleDeck(example) : null)

  let index = $state(0)
  let reading = $state(false)
  let copying = $state(false)

  async function makeCopy() {
    if (!deck) return
    copying = true
    try {
      const copy = await putDeck(copyDeck(deck))
      toast.success('Copied into your decks')
      await goto(`/edit/${copy.id}`)
    } catch (e) {
      toast.error(`Could not copy the example: ${(e as Error).message}`)
    } finally {
      copying = false
    }
  }

  function present() {
    if (deck) goto(`/present/${encodeURIComponent(deck.id)}?start=${index}`)
  }

  function readFrom(i: number) {
    index = i
    replaceState(hashFor(i), {})
    reading = false
  }
</script>

<svelte:head>
  <title>{deck ? `${deck.title} · example` : 'Example not found'} · slidessoca</title>
  {#if deck}<meta name="theme-color" content={themeEntry(deck.theme).bg} />{/if}
</svelte:head>

{#snippet copyButton(small: boolean)}
  <Button
    size="sm"
    variant={small ? 'ghost' : 'secondary'}
    loading={copying}
    aria-label="Make a copy"
    onclick={makeCopy}
  >
    {#snippet leading()}<Icon name={icon('copy')} />{/snippet}
    <span class:wide={small}>Make a copy</span>
  </Button>
{/snippet}

{#if !deck}
  <main class="center">
    <EmptyState title="Example not found" message="There is no example deck with that name." />
    <Link variant="button" href="/">Your decks</Link>
  </main>
{:else}
  <div class="page" {...themeAttributes(deck.theme)}>
    {#if reading}
      <main class="read">
        <header class="read-head">
          <div>
            <a href="/" class="back hs-no-underline">← Decks</a>
            <h1>{deck.title}</h1>
            <p class="hint">Example deck · {deck.slides.length} slides with speaker notes</p>
          </div>
          <div class="read-actions">
            {@render copyButton(false)}
            <Button size="sm" variant="secondary" onclick={present}>
              {#snippet leading()}<Icon name={icon('screen')} />{/snippet}
              Present
            </Button>
            <Button size="sm" variant="primary" onclick={() => (reading = false)}>
              {#snippet leading()}<Icon name="film" />{/snippet}
              Slideshow
            </Button>
          </div>
        </header>
        <ol class="list">
          {#each deck.slides as s, i (s.id)}
            <li>
              <SlideView
                slide={s}
                theme={deck.theme}
                label="Slide {i + 1} of {deck.slides.length}"
              />
              <div class="caption">
                <span class="n">{counter(i, deck.slides.length)}</span>
                <Button size="sm" variant="ghost" onclick={() => readFrom(i)}>
                  Play from here
                </Button>
              </div>
            </li>
          {/each}
        </ol>
      </main>
    {:else}
      <main class="view">
        <h1 class="sr-only">{deck.title}</h1>
        <DeckPlayer {deck} bind:index hash>
          {#snippet start()}
            <a href="/" class="back hs-no-underline" aria-label="Back to your decks">←</a>
            <span class="title" title={deck.title}>{deck.title}</span>
            <span class="tag">Example</span>
          {/snippet}
          {#snippet end()}
            <Button size="sm" variant="ghost" aria-label="Read" onclick={() => (reading = true)}>
              {#snippet leading()}<Icon name={icon('rows')} />{/snippet}
              <span class="wide">Read</span>
            </Button>
            <Button size="sm" variant="ghost" aria-label="Present" onclick={present}>
              {#snippet leading()}<Icon name={icon('screen')} />{/snippet}
              <span class="wide">Present</span>
            </Button>
            {@render copyButton(true)}
          {/snippet}
        </DeckPlayer>
      </main>
    {/if}
  </div>
{/if}

<style lang="scss">
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
  .page {
    background: var(--ss-bg);
    color: var(--ss-fg);
    min-block-size: 100dvh;
  }
  .view {
    block-size: 100dvh;
  }
  .back {
    display: inline-flex;
    align-items: center;
    min-block-size: 24px;
    min-inline-size: 24px;
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
    &:hover {
      color: var(--ss-fg);
    }
  }
  .title {
    overflow: hidden;
    font-size: var(--ss-size-sm);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-inline-size: 0;
  }
  .tag {
    flex: none;
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-xs);
  }
  .read {
    max-inline-size: 1100px;
    margin-inline: auto;
    padding: var(--ss-s-4);
  }
  .read-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--ss-s-3);
    margin-block-end: var(--ss-s-4);
    h1 {
      margin: var(--ss-s-2) 0 0;
      font-family: var(--ss-font-display);
      font-size: var(--ss-size-h2);
    }
  }
  .hint {
    margin: var(--ss-s-1) 0 0;
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
  }
  .read-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ss-s-2);
  }
  .list {
    display: grid;
    gap: var(--ss-s-6);
    margin: 0;
    padding: 0;
    list-style: none;
    li {
      border: 1px solid var(--ss-line);
    }
  }
  .caption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--ss-s-1) var(--ss-s-2);
    border-block-start: 1px solid var(--ss-line);
    background: var(--ss-bg-elev);
  }
  .n {
    font-family: var(--ss-font-mono);
    font-size: var(--ss-size-sm);
    font-variant-numeric: tabular-nums;
    color: var(--ss-fg-muted);
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (max-width: 640px) {
    .tag,
    .wide {
      display: none;
    }
  }
  @media (max-width: 420px) {
    .title {
      display: none;
    }
  }
</style>
