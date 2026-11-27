<script lang="ts">
  import { page } from '$app/state'
  import { onMount } from 'svelte'
  import SlideView from '$lib/components/SlideView.svelte'
  import { getDeck } from '$lib/client/db'
  import type { Deck } from '$lib/deck/types'

  let deck = $state<Deck | null>(null)
  onMount(async () => {
    deck = (await getDeck(page.params.id!)) ?? null
  })
</script>

<!-- Placeholder: the editor story (SL-0002) replaces this. -->
{#if deck}
  <main style="max-inline-size: 1100px; margin: auto; padding: 16px; display: grid; gap: 16px">
    <h1>{deck.title}</h1>
    {#each deck.slides as s (s.id)}<SlideView slide={s} theme={deck.theme} />{/each}
  </main>
{/if}
