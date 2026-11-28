<script lang="ts">
  import { goto } from '$app/navigation'
  import { Button, Icon, Menu, Modal, toast, type MenuItem } from 'dssoca'
  import { onMount } from 'svelte'
  import ExampleList from '$lib/components/ExampleList.svelte'
  import SlideView from '$lib/components/SlideView.svelte'
  import { glyph } from '$lib/components/editor/icons'
  import {
    allDecks,
    deleteDeck,
    getDeck,
    listDecks,
    putDeck,
    type DeckSummary,
  } from '$lib/client/db'
  import { exportBackup, exportJson, exportMarkdown } from '$lib/client/export'
  import { PREFS, readPref, writePref } from '$lib/client/prefs'
  import { backupStatus, needsBackup } from '$lib/deck/backup'
  import { downloadDeck } from '$lib/client/downloads'
  import { makeDeck, newId } from '$lib/deck/factory'
  import { counter, pad } from '$lib/deck/count'
  import { parseMarkdown, parsedToDeck } from '$lib/deck/markdown'
  import { EXAMPLE_MD } from '$lib/format-doc'

  // The empty state shows real slides: the Markdown example, laid out by the same engine.
  const sample = parsedToDeck(parseMarkdown(EXAMPLE_MD))
  // Back to front: the title slide sits on top. Slides that need uploaded images are skipped.
  const fan = sample.slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.layout.startsWith('image') && s.layout !== 'gallery')
    .slice(0, 3)
    .reverse()

  let decks = $state<DeckSummary[] | null>(null)
  let confirmDelete = $state<DeckSummary | null>(null)

  const refresh = async () => (decks = await listDecks())
  onMount(refresh)

  // Backup reminder (SL-0010): decks live only in this browser's IndexedDB.
  let lastBackup = $state<string | null>(readPref(PREFS.lastBackup))
  let backingUp = $state(false)
  let now = $state(Date.now())
  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 60_000)
    return () => clearInterval(t)
  })
  const stale = $derived(needsBackup(decks ?? [], lastBackup))
  const status = $derived(backupStatus(lastBackup, now))

  async function backUp() {
    backingUp = true
    try {
      const all = await allDecks()
      const when = new Date()
      await exportBackup(all, when)
      lastBackup = when.toISOString()
      now = when.getTime()
      writePref(PREFS.lastBackup, lastBackup)
      toast.success(all.length === 1 ? 'Backed up 1 deck' : `Backed up ${all.length} decks`)
    } catch (e) {
      toast.error(`Could not back up: ${(e as Error).message}`)
    } finally {
      backingUp = false
    }
  }

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

  const actionsFor = (d: DeckSummary): MenuItem[] => [
    { id: 'md', label: 'Download .md', onSelect: () => withDeck(d.id, exportMarkdown) },
    { id: 'json', label: 'Download .json', onSelect: () => withDeck(d.id, exportJson) },
    {
      id: 'html',
      label: 'Download HTML',
      onSelect: () => withDeck(d.id, (deck) => downloadDeck(deck, 'html-notes')),
    },
    {
      id: 'jpg',
      label: 'Download JPGs (.zip)',
      onSelect: () => withDeck(d.id, (deck) => downloadDeck(deck, 'jpg')),
    },
    {
      id: 'pdf',
      label: 'Download PDF',
      onSelect: () => withDeck(d.id, (deck) => downloadDeck(deck, 'pdf')),
    },
    { id: 'dup', label: 'Duplicate', onSelect: () => duplicate(d.id) },
    { id: 'del', label: 'Delete…', onSelect: () => (confirmDelete = d) },
  ]

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
    <div class="brand">
      <h1>slidessoca</h1>
      <p class="tag">Slide decks from text, Markdown or a blank canvas</p>
    </div>
    <div class="actions">
      <Button variant="primary" onclick={() => goto('/new')}>Quick create</Button>
      <Button onclick={() => goto('/new?tab=markdown')}>Import Markdown</Button>
      <button type="button" class="quiet" onclick={blank}>Blank deck</button>
    </div>
  </header>

  {#if decks && decks.length === 0}
    <section class="empty" aria-labelledby="empty-title">
      <ol class="sample" aria-hidden="true">
        {#each fan as { s, i }, k (s.id)}
          <li style="--i:{k}">
            <SlideView slide={s} theme={sample.theme} thumbnail />
            <span class="num">{counter(i, sample.slides.length)}</span>
          </li>
        {/each}
      </ol>
      <div class="empty-copy">
        <h2 id="empty-title">No decks in this browser yet</h2>
        <p>
          Write a title and a few lines per slide and the layout follows. These three come from the
          Markdown example
        </p>
        <Button onclick={() => goto('/new?tab=markdown&example')}>Open the example</Button>
      </div>
    </section>
  {:else if decks}
    <section class="backup" class:stale aria-label="Backup">
      <p>
        {#if stale}<span class="dot" aria-hidden="true"></span>{/if}
        <span>Decks live only in this browser. Download a backup to keep them</span>
        <span class="when">
          {status}{#if stale && lastBackup}, changed since{/if}
        </span>
      </p>
      <div class="backup-actions">
        <Button
          size="sm"
          variant={stale ? 'secondary' : 'ghost'}
          loading={backingUp}
          onclick={backUp}
        >
          Back up all decks
        </Button>
        <a href="/new?tab=json" class="restore hs-no-underline">Restore</a>
      </div>
    </section>
    <ul class="grid">
      {#each decks as d (d.id)}
        <li class="card">
          <a href="/edit/{d.id}" class="open hs-no-underline">
            {#if d.firstSlide}<SlideView slide={d.firstSlide} theme={d.theme} thumbnail />{/if}
            <span class="title">{d.title}</span>
          </a>
          <div class="foot">
            <span class="meta">
              <span class="mono">{pad(d.slides, d.slides)}</span>
              {d.slides === 1 ? 'slide' : 'slides'}{#if d.shared}<span
                  class="dot"
                  aria-hidden="true"
                ></span><span>Shared</span>{/if}
            </span>
            <Menu items={actionsFor(d)} label="Actions for {d.title}" align="end" size="sm">
              <Icon name={glyph('more')} size="sm" title="Actions for {d.title}" />
            </Menu>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if decks}
    <section class="examples" aria-labelledby="examples-title">
      <h2 id="examples-title">Examples</h2>
      <p>Ready-made decks to read, present or copy and make your own</p>
      <ExampleList />
    </section>
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
    max-inline-size: 1280px;
    margin-inline: auto;
    padding: var(--ss-s-8) var(--ss-s-6);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ss-s-4);
    align-items: flex-end;
    justify-content: space-between;
    margin-block-end: var(--ss-s-8);
  }
  .brand h1 {
    margin: 0;
    font-family: var(--ss-font-display);
    font-weight: 400;
  }
  .tag {
    margin: var(--ss-s-1) 0 0;
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ss-s-2);
  }
  .quiet {
    min-block-size: var(--ss-s-8);
    padding-inline: var(--ss-s-2);
    border: 0;
    background: none;
    color: var(--ss-fg-muted);
    font: inherit;
    font-size: var(--ss-size-sm);
    cursor: pointer;
    transition: color var(--ss-dur-fast) var(--ss-ease);
    &:hover {
      color: var(--ss-fg);
    }
  }

  .empty {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: var(--ss-s-10);
    align-items: center;
    padding-block: var(--ss-s-8);
  }
  .sample {
    position: relative;
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
    li {
      grid-area: 1 / 1;
      align-self: start;
      inline-size: 78%;
      margin-inline-start: calc(var(--i) * 11%);
      margin-block-start: calc(var(--i) * 9%);
      border: 1px solid var(--ss-line);
      background: var(--ss-bg);
    }
    .num {
      position: absolute;
      inset-block-end: var(--ss-s-2);
      inset-inline-end: var(--ss-s-3);
      color: var(--ss-fg-muted);
      font-family: var(--ss-font-mono);
      font-size: var(--ss-size-xs);
      font-variant-numeric: tabular-nums;
    }
    li {
      position: relative;
    }
  }
  .empty-copy {
    h2 {
      margin: 0 0 var(--ss-s-3);
      font-family: var(--ss-font-display);
      font-weight: 400;
    }
    p {
      margin: 0 0 var(--ss-s-6);
      color: var(--ss-fg-muted);
      max-inline-size: 40ch;
    }
  }

  .examples {
    margin-block-start: var(--ss-s-10);
    padding-block-start: var(--ss-s-6);
    border-block-start: 1px solid var(--ss-line);
    h2 {
      margin: 0;
      font-family: var(--ss-font-display);
      font-size: var(--ss-size-h3);
      font-weight: 400;
    }
    p {
      margin: var(--ss-s-1) 0 var(--ss-s-4);
      color: var(--ss-fg-muted);
      font-size: var(--ss-size-sm);
    }
  }

  .backup {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--ss-s-2) var(--ss-s-4);
    margin-block-end: var(--ss-s-6);
    padding-block: var(--ss-s-2);
    border-block: 1px solid var(--ss-line);
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
    p {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--ss-s-1) var(--ss-s-3);
      margin: 0;
      min-inline-size: 0;
      color: var(--ss-fg-muted);
      font-size: var(--ss-size-sm);
    }
    &.stale p > span:not(.when) {
      color: var(--ss-fg);
    }
  }
  .when {
    font-family: var(--ss-font-mono);
    font-size: var(--ss-size-xs);
    font-variant-numeric: tabular-nums;
  }
  .backup-actions {
    display: flex;
    align-items: center;
    gap: var(--ss-s-2);
  }
  .restore {
    display: inline-flex;
    align-items: center;
    min-block-size: var(--ss-s-8);
    padding-inline: var(--ss-s-2);
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
    &:hover {
      color: var(--ss-fg);
    }
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--ss-s-6);
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ss-line);
    transition: border-color var(--ss-dur-fast) var(--ss-ease);
    &:hover,
    &:focus-within {
      border-color: var(--ss-line-strong);
    }
  }
  .open {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-3);
    padding: var(--ss-s-2) var(--ss-s-2) 0;
    color: inherit;
    text-decoration: none;
  }
  .title {
    padding-inline: var(--ss-s-1);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ss-s-2);
    padding: var(--ss-s-1) var(--ss-s-1) var(--ss-s-1) var(--ss-s-3);
  }
  .meta {
    display: inline-flex;
    align-items: center;
    gap: var(--ss-s-2);
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-xs);
  }
  .mono {
    font-family: var(--ss-font-mono);
    font-variant-numeric: tabular-nums;
  }
  .dot {
    inline-size: 6px;
    block-size: 6px;
    background: var(--ss-primary);
  }

  @media (max-width: 720px) {
    .home {
      padding: var(--ss-s-6) var(--ss-s-4);
    }
    .empty {
      grid-template-columns: 1fr;
      gap: var(--ss-s-6);
    }
  }
</style>
