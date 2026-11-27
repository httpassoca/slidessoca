<!--
  CONTRACT (owned by SL-0004): the editor opens this to publish / republish / unpublish a deck.
  Props are fixed; the implementation is a stub until SL-0004 lands.
-->
<script lang="ts">
  import { Modal } from 'dssoca'
  import type { Deck } from '$lib/deck/types'

  interface Props {
    open: boolean
    deck: Deck
    /** Called with the deck after its `share` changed (published, republished, unpublished). */
    onchange: (deck: Deck) => void
  }

  let { open = $bindable(), deck, onchange: _onchange }: Props = $props()
</script>

<Modal bind:open title="Share">
  <p>Sharing for “{deck.title}” is coming soon.</p>
</Modal>
