<script lang="ts">
  import { goto } from '$app/navigation'
  import { Button, FileDrop, toast } from 'dssoca'
  import SlideGrid from '$lib/components/SlideGrid.svelte'
  import { putDeck } from '$lib/client/db'
  import { importDeckJson } from '$lib/deck/bundle'
  import { decksFromBackup } from '$lib/deck/backup'
  import { pad } from '$lib/deck/count'
  import { unzip } from '$lib/deck/zip'
  import type { Deck } from '$lib/deck/types'
  import { themeEntry } from '$lib/themes'

  let picked = $state<File[]>([])
  let deck = $state<Deck | null>(null)
  /** A "Back up all decks" zip: every deck in it (SL-0010). */
  let backup = $state<{ decks: Deck[]; skipped: string[] } | null>(null)
  let error = $state('')
  let saving = $state(false)

  async function onfiles(files: File[]) {
    const f = files[0]
    if (!f) return
    error = ''
    deck = null
    backup = null
    if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
      try {
        backup = decksFromBackup(await unzip(new Uint8Array(await f.arrayBuffer())))
      } catch (e) {
        error = `Not a slidessoca backup: ${(e as Error).message}`
      }
      return
    }
    try {
      deck = importDeckJson(await f.text())
    } catch (e) {
      error =
        e instanceof SyntaxError
          ? 'This is not a JSON file'
          : `Not a slidessoca deck: ${(e as Error).message}`
    }
  }

  async function restore() {
    if (!backup) return
    saving = true
    try {
      for (const d of backup.decks) await putDeck(d)
      const n = backup.decks.length
      toast.success(n === 1 ? 'Imported 1 deck' : `Imported ${n} decks`)
      goto('/')
    } catch (e) {
      toast.error(`Could not save the decks: ${(e as Error).message}`)
      saving = false
    }
  }

  async function create() {
    if (!deck) return
    saving = true
    try {
      await putDeck(deck)
      goto(`/edit/${deck.id}`)
    } catch (e) {
      toast.error(`Could not save the deck: ${(e as Error).message}`)
      saving = false
    }
  }
</script>

<div class="wrap">
  <FileDrop
    label="Deck file (.slidessoca.json) or backup (.zip)"
    accept=".json,.zip,application/json,application/zip"
    bind:files={picked}
    {error}
    hint="A deck downloaded with “Download .json”, or the .zip from “Back up all decks” on the home page. Each one becomes a new deck in this browser."
    onfiles={(files, det) => {
      if (det.reason === 'select' || det.reason === 'drop') onfiles(files)
      if (det.reason === 'clear' || det.reason === 'remove') {
        deck = null
        backup = null
        error = ''
      }
    }}
  />

  {#if backup}
    <div class="head">
      <h2>
        {backup.decks.length === 1 ? '1 deck' : `${backup.decks.length} decks`} in this backup
      </h2>
      {#if backup.skipped.length}
        <span class="meta">Skipped {backup.skipped.join(', ')}</span>
      {/if}
    </div>
    <ul class="list">
      {#each backup.decks as d (d.id)}
        <li>
          <span class="title">{d.title}</span>
          <span class="meta">
            <span class="mono">{pad(d.slides.length, d.slides.length)}</span>
            {d.slides.length === 1 ? 'slide' : 'slides'} · {themeEntry(d.theme).label}
          </span>
        </li>
      {/each}
    </ul>
    <div class="create">
      <Button variant="primary" fullWidth loading={saving} onclick={restore}>
        {backup.decks.length === 1 ? 'Import 1 deck' : `Import ${backup.decks.length} decks`}
      </Button>
    </div>
  {:else if deck}
    <div class="head">
      <h2>{deck.title}</h2>
      <span class="meta">{deck.slides.length} slides · {themeEntry(deck.theme).label}</span>
    </div>
    <SlideGrid slides={deck.slides} theme={deck.theme} />
    <div class="create">
      <Button variant="primary" fullWidth loading={saving} onclick={create}>Import deck</Button>
    </div>
  {/if}
</div>

<style lang="scss">
  .wrap {
    display: grid;
    gap: var(--ss-s-4);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--ss-s-3);
    h2 {
      margin: 0;
      font-family: var(--ss-font-display);
      font-size: var(--ss-size-h3);
    }
  }
  .meta {
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
  }
  .list {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
    max-inline-size: 640px;
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--ss-s-1) var(--ss-s-4);
      padding-block: var(--ss-s-2);
      border-block-end: 1px solid var(--ss-line);
    }
  }
  .title {
    font-weight: 500;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .mono {
    font-family: var(--ss-font-mono);
    font-variant-numeric: tabular-nums;
  }
  .create {
    position: sticky;
    inset-block-end: 0;
    padding-block: var(--ss-s-2);
    background: var(--ss-bg);
    max-inline-size: 480px;
  }
</style>
