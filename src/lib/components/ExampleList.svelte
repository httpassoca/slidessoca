<!-- The example decks (SL-0012) as cards: real first slide, title, one line, slide count. -->
<script lang="ts">
  import SlideView from './SlideView.svelte'
  import { pad } from '$lib/deck/count'
  import { EXAMPLES, exampleDeck } from '$lib/examples'
  import type { Deck } from '$lib/deck/types'

  interface Props {
    /** Accessible name of the list. */
    label?: string
  }
  let { label = 'Example decks' }: Props = $props()

  // The card shows the deck's most pictorial slide: a full-bleed image, else a gallery, else the
  // first slide with a picture, else the first slide.
  const cover = (d: Deck) =>
    d.slides.find((s) => s.layout === 'image-full') ??
    d.slides.find((s) => s.layout === 'gallery') ??
    d.slides.find((s) => s.content.images.length > 0) ??
    d.slides[0]
  const cards = EXAMPLES.map((e) => {
    const deck = exampleDeck(e)
    return { e, deck, slide: cover(deck) }
  })
</script>

<ul class="examples" aria-label={label}>
  {#each cards as { e, deck, slide } (e.slug)}
    <li>
      <a href="/examples/{e.slug}" class="hs-no-underline">
        <SlideView {slide} theme={deck.theme} thumbnail />
        <span class="title">{e.title}</span>
        <span class="blurb">{e.blurb}</span>
        <span class="count">{pad(deck.slides.length, deck.slides.length)} slides</span>
      </a>
    </li>
  {/each}
</ul>

<style lang="scss">
  .examples {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
    gap: var(--ss-s-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  a {
    display: grid;
    gap: var(--ss-s-1);
    min-inline-size: 0;
    color: inherit;
    text-decoration: none;
    :global(.slide) {
      margin-block-end: var(--ss-s-1);
      outline: 1px solid var(--ss-line);
      transition: outline-color var(--ss-dur-fast) var(--ss-ease);
    }
    &:hover :global(.slide),
    &:focus-visible :global(.slide) {
      outline-color: var(--ss-line-strong);
    }
  }
  .title {
    font-weight: 500;
  }
  .blurb {
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
  }
  .count {
    color: var(--ss-fg-muted);
    font-family: var(--ss-font-mono);
    font-size: var(--ss-size-xs);
    font-variant-numeric: tabular-nums;
  }
</style>
