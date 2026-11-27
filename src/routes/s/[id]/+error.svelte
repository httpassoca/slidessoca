<!-- Missing, expired or unpublished share link (and any other viewer error). -->
<script lang="ts">
  import { page } from '$app/state'
  import { EmptyState, Link } from 'dssoca'

  const missing = $derived(page.status === 404)
</script>

<svelte:head>
  <title>{missing ? 'Deck not available' : 'Something went wrong'} · slidessoca</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="gone">
  {#if missing}
    <EmptyState
      title="This deck is not available"
      message="Shared links stay online for 30 days after their last publish. This one has expired, was unpublished by its owner, or the address is mistyped. Ask the person who sent it to publish it again."
    />
  {:else}
    <EmptyState
      title="Something went wrong"
      message={page.error?.message ?? 'The deck could not be loaded. Try again in a moment.'}
    />
  {/if}
  <div class="actions">
    <Link variant="button" href="/">Make your own deck</Link>
  </div>
</main>

<style lang="scss">
  /* Full-viewport pages: no UA body margin around the player. */
  :global(body) {
    margin: 0;
  }
  .gone {
    display: grid;
    place-content: center;
    gap: var(--ss-s-4);
    min-block-size: 100dvh;
    padding: var(--ss-s-4);
    max-inline-size: 560px;
    margin-inline: auto;
    text-align: center;
  }
  .actions {
    display: flex;
    justify-content: center;
  }
</style>
