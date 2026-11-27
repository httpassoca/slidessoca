<script lang="ts">
  import { goto } from '$app/navigation'
  import { Button, FileDrop, toast } from 'dssoca'
  import SlideGrid from '$lib/components/SlideGrid.svelte'
  import { putDeck } from '$lib/client/db'
  import { importDeckJson } from '$lib/deck/bundle'
  import type { Deck } from '$lib/deck/types'
  import { themeEntry } from '$lib/themes'

  let picked = $state<File[]>([])
  let deck = $state<Deck | null>(null)
  let error = $state('')
  let saving = $state(false)

  async function onfiles(files: File[]) {
    const f = files[0]
    if (!f) return
    error = ''
    deck = null
    try {
      deck = importDeckJson(await f.text())
    } catch (e) {
      error =
        e instanceof SyntaxError
          ? 'This is not a JSON file.'
          : `Not a slidessoca deck: ${(e as Error).message}`
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
    label="Deck file (.slidessoca.json)"
    accept=".json,application/json"
    bind:files={picked}
    {error}
    hint="A deck downloaded with “Download .json”. It becomes a new deck in this browser."
    onfiles={(files, det) => {
      if (det.reason === 'select' || det.reason === 'drop') onfiles(files)
      if (det.reason === 'clear' || det.reason === 'remove') {
        deck = null
        error = ''
      }
    }}
  />

  {#if deck}
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
  .create {
    position: sticky;
    inset-block-end: 0;
    padding-block: var(--ss-s-2);
    background: var(--ss-bg);
    max-inline-size: 480px;
  }
</style>
