<!--
  Publish / republish / unpublish a deck (opened by the editor). Props are a fixed contract:
  `{ open: $bindable boolean, deck: Deck, onchange: (deck) => void }` — `onchange` receives the
  deck with its new `share` (or none) after every successful change; the caller saves it.

  The shared copy is a snapshot: later edits stay in this browser until "Republish", which
  keeps the same link and restarts the 30 days.
-->
<script lang="ts">
  import { Badge, Button, Icon, Input, Modal, toast } from 'dssoca'
  import type { Deck } from '$lib/deck/types'
  import { isLive, publish, shareErrorMessage, shareUrl, unpublish } from '$lib/client/share'
  import { icon } from '$lib/components/player/icons'

  interface Props {
    open: boolean
    deck: Deck
    /** Called with the deck after its `share` changed (published, republished, unpublished). */
    onchange: (deck: Deck) => void
  }

  let { open = $bindable(), deck, onchange }: Props = $props()

  let busy = $state<'publish' | 'unpublish' | null>(null)
  let confirming = $state(false)
  let error = $state('')

  const share = $derived(deck.share)
  const live = $derived(isLive(share))
  const url = $derived(share ? shareUrl(share) : '')
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const fmt = (iso: string, time = false) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: 'long',
      ...(time ? { timeStyle: 'short' } : {}),
    }).format(new Date(iso))

  // Fresh state every time the dialog opens.
  $effect(() => {
    if (open) {
      confirming = false
      error = ''
    }
  })

  async function doPublish() {
    busy = 'publish'
    error = ''
    const again = live
    try {
      const updated = await publish($state.snapshot(deck) as Deck)
      onchange(updated)
      toast.success(again ? 'Republished — same link, 30 more days.' : 'Published. Copy the link.')
    } catch (e) {
      error = shareErrorMessage(e)
      toast.error(error)
    } finally {
      busy = null
    }
  }

  async function doUnpublish() {
    busy = 'unpublish'
    error = ''
    try {
      const updated = await unpublish($state.snapshot(deck) as Deck)
      confirming = false
      onchange(updated)
      toast.success('Unpublished. The link no longer works.')
    } catch (e) {
      error = shareErrorMessage(e)
      toast.error(error)
    } finally {
      busy = null
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied.')
    } catch {
      toast.error('Could not copy. Select the link and copy it yourself.')
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: deck.title, url })
    } catch {
      /* dismissed */
    }
  }
</script>

<Modal bind:open title="Share">
  <div class="body">
    {#if share && live}
      <div class="status">
        <Badge tone="positive" dot>Published</Badge>
        <span class="muted">last published {fmt(share.publishedAt, true)}</span>
      </div>

      <Input
        label="Public link"
        value={url}
        readonly
        onfocus={(e: FocusEvent) => (e.currentTarget as HTMLInputElement).select()}
      />

      <div class="row">
        <Button variant="primary" size="sm" onclick={copy}>
          {#snippet leading()}<Icon name={icon('copy')} />{/snippet}
          Copy link
        </Button>
        {#if canNativeShare}
          <Button size="sm" onclick={nativeShare}>
            {#snippet leading()}<Icon name={icon('share')} />{/snippet}
            Share…
          </Button>
        {/if}
        <Button size="sm" variant="ghost" onclick={() => window.open(url, '_blank', 'noopener')}>
          {#snippet leading()}<Icon name="external" />{/snippet}
          Open
        </Button>
      </div>

      <p class="expiry">
        Available until <strong>{fmt(share.expiresAt)}</strong>, 30 days after the last publish.
      </p>
      <p class="muted">
        The link shows a snapshot. Edits you make now stay in this browser until you
        <strong>Republish</strong> — same link, and the 30 days start again.
      </p>
    {:else}
      {#if share && !live}
        <div class="status">
          <Badge tone="caution" dot>Link expired</Badge>
          <span class="muted">on {fmt(share.expiresAt)}</span>
        </div>
        <p>Publishing again creates a new link.</p>
      {/if}
      <p>
        Publishing uploads a copy of <strong>{deck.title}</strong> that anyone with the link can
        view — on a phone too — for <strong>30 days</strong>. Your editable deck stays in this
        browser.
      </p>
      <p class="muted">
        Speaker notes are included in the copy. Images count towards a 15 MB limit.
      </p>
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    {#if confirming}
      <div class="confirm" role="group" aria-label="Confirm unpublish">
        <p>Unpublish? The link stops working for everyone right away. Your deck stays here.</p>
        <div class="row">
          <Button size="sm" onclick={() => (confirming = false)} disabled={busy !== null}>
            Keep it
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={busy === 'unpublish'}
            loadingLabel="Unpublishing"
            onclick={doUnpublish}
          >
            Unpublish
          </Button>
        </div>
      </div>
    {/if}
  </div>

  {#snippet footer()}
    <div class="footer">
      {#if share && live}
        <Button
          variant="ghost"
          disabled={busy !== null || confirming}
          onclick={() => (confirming = true)}
        >
          Unpublish…
        </Button>
        <Button
          variant="primary"
          loading={busy === 'publish'}
          loadingLabel="Republishing"
          disabled={busy === 'unpublish'}
          onclick={doPublish}
        >
          Republish
        </Button>
      {:else}
        <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
        <Button
          variant="primary"
          loading={busy === 'publish'}
          loadingLabel="Publishing"
          onclick={doPublish}
        >
          Publish
        </Button>
      {/if}
    </div>
  {/snippet}
</Modal>

<style lang="scss">
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-3);
    p {
      margin: 0;
    }
  }
  .status,
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ss-s-2);
  }
  .muted {
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
  }
  .error {
    color: var(--ss-danger);
  }
  .confirm {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-2);
    padding: var(--ss-s-3);
    border: 1px solid var(--ss-danger);
    background: var(--ss-danger-soft);
  }
  .footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--ss-s-2);
    inline-size: 100%;
  }
</style>
