<!--
  Public viewer of a shared deck. Server-rendered (link previews, first paint without JS), then
  hydrated into the player: keys, swipe, tap thirds, fullscreen, overview, #n deep links, and a
  "read mode" that lists every slide. "Make a copy" imports the deck into this browser.
-->
<script lang="ts">
  import { goto, replaceState } from '$app/navigation'
  import { page } from '$app/state'
  import { Button, Icon, Menu, toast, type MenuItem } from 'dssoca'
  import DeckPlayer from '$lib/components/player/DeckPlayer.svelte'
  import SlideView from '$lib/components/SlideView.svelte'
  import { icon } from '$lib/components/player/icons'
  import { putDeck } from '$lib/client/db'
  import { downloadDeck } from '$lib/client/downloads'
  import { copyDeck } from '$lib/deck/factory'
  import { deckDescription } from '$lib/deck/meta'
  import { hashFor } from '$lib/deck/nav'
  import { validateDeck } from '$lib/deck/validate'
  import { themeAttributes, themeEntry } from '$lib/themes'

  let { data } = $props()
  const deck = $derived(data.deck)

  let index = $state(0)
  let reading = $state(false)
  let copying = $state(false)

  const until = $derived(
    new Intl.DateTimeFormat('en', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(data.expiresAt)),
  )
  const description = $derived(deckDescription(deck))

  async function makeCopy() {
    copying = true
    try {
      const copy = copyDeck(validateDeck($state.snapshot(deck)))
      await putDeck(copy)
      toast.success('Copied into this browser, edits stay here until you publish')
      await goto(`/edit/${copy.id}`)
    } catch {
      toast.error('Could not copy this deck into this browser')
    } finally {
      copying = false
    }
  }

  // Shared decks carry no speaker notes, so the HTML download never has a notes panel here.
  const downloadItems: MenuItem[] = [
    { id: 'html', label: 'HTML', onSelect: () => downloadDeck(deck, 'html') },
    { id: 'jpg', label: 'JPGs (.zip)', onSelect: () => downloadDeck(deck, 'jpg') },
    { id: 'pdf', label: 'PDF', onSelect: () => downloadDeck(deck, 'pdf') },
  ]

  function readFrom(i: number) {
    index = i
    // The player reads #n when it mounts again.
    replaceState(hashFor(i), {})
    reading = false
  }
</script>

<svelte:head>
  <title>{deck.title} · slidessoca</title>
  <meta name="description" content={description} />
  <meta name="theme-color" content={themeEntry(deck.theme).bg} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="slidessoca" />
  <meta property="og:title" content={deck.title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={page.url.origin + page.url.pathname} />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content={deck.title} />
  <meta name="twitter:description" content={description} />
  <meta name="robots" content="noindex" />
</svelte:head>

{#snippet copyButton(small: boolean)}
  <Button size="sm" variant={small ? 'ghost' : 'secondary'} loading={copying} onclick={makeCopy}>
    {#snippet leading()}<Icon name={icon('copy')} />{/snippet}
    <span class:wide={small}>Make a copy</span>
  </Button>
{/snippet}

<div class="page" {...themeAttributes(deck.theme)}>
  {#if reading}
    <main class="read">
      <header class="read-head">
        <div>
          <h1>{deck.title}</h1>
          <p class="hint">
            {deck.slides.length} slides · shared link available until {until}
          </p>
        </div>
        <div class="read-actions">
          {@render copyButton(false)}
          <Button size="sm" variant="primary" onclick={() => (reading = false)}>
            {#snippet leading()}<Icon name="film" />{/snippet}
            Slideshow
          </Button>
        </div>
      </header>
      <ol class="list">
        {#each deck.slides as s, i (s.id)}
          <li>
            <SlideView slide={s} theme={deck.theme} label="Slide {i + 1} of {deck.slides.length}" />
            <div class="caption">
              <span class="n">{i + 1} / {deck.slides.length}</span>
              <Button size="sm" variant="ghost" onclick={() => readFrom(i)}>
                Present from here
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
          <span class="title" title={deck.title}>{deck.title}</span>
          <span class="until">until {until}</span>
        {/snippet}
        {#snippet end()}
          <Button size="sm" variant="ghost" onclick={() => (reading = true)}>
            {#snippet leading()}<Icon name={icon('rows')} />{/snippet}
            <span class="wide">Read</span>
          </Button>
          {@render copyButton(true)}
          <Menu items={downloadItems} label="Download" align="end" side="top" size="sm">
            <Icon name={icon('download')} title="Download" />
          </Menu>
        {/snippet}
      </DeckPlayer>
    </main>
  {/if}
</div>

<style lang="scss">
  /* Full-viewport pages: no UA body margin around the player. */
  :global(body) {
    margin: 0;
  }
  .page {
    background: var(--ss-bg);
    color: var(--ss-fg);
    min-block-size: 100dvh;
  }
  .view {
    block-size: 100dvh;
  }
  .title {
    overflow: hidden;
    font-size: var(--ss-size-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
    min-inline-size: 0;
  }
  .until {
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
      margin: 0;
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
    .until,
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
