<script lang="ts">
  import { goto } from '$app/navigation'
  import { Button, EmptyState, Modal, toast } from 'dssoca'
  import { onMount } from 'svelte'
  import SlideView from '$lib/components/SlideView.svelte'
  import { deleteDeck, getDeck, listDecks, putDeck, type DeckSummary } from '$lib/client/db'
  import { exportJson, exportMarkdown } from '$lib/client/export'
  import { makeDeck, newId } from '$lib/deck/factory'

  let decks = $state<DeckSummary[] | null>(null)
  let confirmDelete = $state<DeckSummary | null>(null)

  const refresh = async () => (decks = await listDecks())
  onMount(refresh)

  async function blank() {
    const d = await putDeck(makeDeck())
    goto(`/edit/${d.id}`)
  }

  async function withDeck(
    id: string,
    fn: (d: NonNullable<Awaited<ReturnType<typeof getDeck>>>) => Promise<unknown>,
  ) {
    const d = await getDeck(id)
    if (!d) return toast.error('That deck is gone')
    try {
      await fn(d)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const duplicate = (id: string) =>
    withDeck(id, async (d) => {
      const now = new Date().toISOString()
      const { share: _share, ...rest } = d
      await putDeck({
        ...rest,
        id: newId(),
        title: `${d.title} (copy)`,
        createdAt: now,
        updatedAt: now,
      })
      await refresh()
      toast.success('Deck duplicated')
    })

  async function remove() {
    if (!confirmDelete) return
    await deleteDeck(confirmDelete.id)
    confirmDelete = null
    await refresh()
  }
</script>

<svelte:head><title>slidessoca</title></svelte:head>

<main class="home">
  <header class="head">
    <h1>slidessoca</h1>
    <div class="actions">
      <Button variant="primary" onclick={() => goto('/new')}>Quick create</Button>
      <Button onclick={() => goto('/new?tab=markdown')}>Import Markdown</Button>
      <Button onclick={blank}>Blank deck</Button>
    </div>
  </header>

  {#if decks && decks.length === 0}
    <EmptyState title="No decks yet" message="Create one from text, Markdown or a blank canvas." />
  {:else if decks}
    <ul class="grid">
      {#each decks as d (d.id)}
        <li class="card">
          <a href="/edit/{d.id}" class="open hs-no-underline">
            {#if d.firstSlide}<SlideView slide={d.firstSlide} theme={d.theme} thumbnail />{/if}
            <span class="title">{d.title}</span>
            <span class="meta">{d.slides} slides{d.shared ? ' · shared' : ''}</span>
          </a>
          <div class="deck-actions">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Download {d.title} as Markdown"
              onclick={() => withDeck(d.id, exportMarkdown)}
            >
              .md
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Download {d.title} as JSON"
              onclick={() => withDeck(d.id, exportJson)}
            >
              .json
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Duplicate {d.title}"
              onclick={() => duplicate(d.id)}
            >
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Delete {d.title}"
              onclick={() => (confirmDelete = d)}
            >
              Delete
            </Button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<Modal
  open={!!confirmDelete}
  title="Delete deck?"
  danger
  size="sm"
  onclose={() => (confirmDelete = null)}
>
  <p>
    “{confirmDelete?.title}” will be removed from this browser.{confirmDelete?.shared
      ? ' Its share link keeps working until it expires.'
      : ''}
  </p>
  {#snippet footer()}
    <Button onclick={() => (confirmDelete = null)}>Cancel</Button>
    <Button variant="danger" onclick={remove}>Delete</Button>
  {/snippet}
</Modal>

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
    flex-wrap: wrap;
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
    border: 1px solid var(--ss-line);
    &:hover,
    &:focus-within {
      border-color: var(--ss-primary);
    }
  }
  .open {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-2);
    color: inherit;
    text-decoration: none;
    padding: var(--ss-s-2);
  }
  .title {
    font-weight: 700;
  }
  .meta {
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
  }
  .deck-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ss-s-1);
    padding: 0 var(--ss-s-1) var(--ss-s-1);
    margin-block-start: auto;
  }
</style>
