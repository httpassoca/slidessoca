<script lang="ts">
  import SlideView from '$lib/components/SlideView.svelte'

  let { data } = $props()
  const deck = $derived(data.deck)
</script>

<svelte:head><title>{deck.title}</title></svelte:head>

<!-- Placeholder viewer: the presenter/viewer story (SL-0004) replaces this. -->
<main style="max-inline-size: 1100px; margin: auto; padding: 16px; display: grid; gap: 16px">
  <h1>{deck.title}</h1>
  {#each deck.slides as s, i (s.id)}
    <SlideView slide={s} theme={deck.theme} label="Slide {i + 1} of {deck.slides.length}" />
  {/each}
</main>
