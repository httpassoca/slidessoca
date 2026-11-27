<script lang="ts">
  import { goto } from '$app/navigation'
  import { Button, EmptyState } from 'dssoca'
  import { onMount } from 'svelte'
  import SlideView from '$lib/components/SlideView.svelte'
  import { listDecks, putDeck, type DeckSummary } from '$lib/client/db'
  import { makeDeck } from '$lib/deck/factory'

  let decks = $state<DeckSummary[] | null>(null)

  onMount(async () => {
    decks = await listDecks()
  })

  async function blank() {
    const d = await putDeck(makeDeck())
    goto(`/edit/${d.id}`)
  }
</script>

<svelte:head><title>slidessoca</title></svelte:head>

<main class="home">
  <header class="head">
    <h1>slidessoca</h1>
    <div class="actions">
      <Button variant="primary" onclick={() => goto('/new')}>Quick create</Button>
      <Button onclick={blank}>Blank deck</Button>
    </div>
  </header>

  {#if decks && decks.length === 0}
    <EmptyState title="No decks yet" message="Create one from text, Markdown or a blank canvas." />
  {:else if decks}
    <ul class="grid">
      {#each decks as d (d.id)}
        <li>
          <a href="/edit/{d.id}" class="card">
            {#if d.firstSlide}<SlideView slide={d.firstSlide} theme={d.theme} thumbnail />{/if}
            <span class="title">{d.title}</span>
            <span class="meta">{d.slides} slides{d.shared ? ' · shared' : ''}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style lang="scss">
  .home {
    max-inline-size: 1200px;
    margin-inline: auto;
    padding: var(--ss-s-6) var(--ss-s-4);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ss-s-4);
    align-items: center;
    justify-content: space-between;
    margin-block-end: var(--ss-s-6);
    h1 {
      margin: 0;
      font-family: var(--ss-font-display);
    }
  }
  .actions {
    display: flex;
    gap: var(--ss-s-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--ss-s-4);
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-2);
    color: inherit;
    text-decoration: none;
    border: 1px solid var(--ss-line);
    padding: var(--ss-s-2);
    &:hover {
      border-color: var(--ss-primary);
    }
  }
  .title {
    font-weight: 700;
  }
  .meta {
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
  }
</style>
