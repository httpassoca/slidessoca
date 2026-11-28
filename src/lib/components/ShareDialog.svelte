<!--
  Publish / republish / unpublish a deck (opened by the editor). Props are a fixed contract:
  `{ open: $bindable boolean, deck: Deck, onchange: (deck) => void }` — `onchange` receives the
  deck with its new `share` (or none) after every successful change, and with its new
  `publishNotes` when the "Include speaker notes" box is toggled; the caller saves it.

  Speaker notes stay out of the shared copy unless that box is ticked (remembered per deck).
  Images are links (ADR 0002): a legacy deck that still embeds uploaded images cannot be
  published; the dialog lists those slides and asks for links instead.

  The shared copy is a snapshot: later edits stay in this browser until "Republish", which
  keeps the same link and restarts the 30 days.
-->
<script lang="ts">
  import { untrack } from 'svelte'
  import { Badge, Button, Checkbox, Icon, Input, Modal, toast } from 'dssoca'
  import type { Deck } from '$lib/deck/types'
  import { slidesWithUploadedImages } from '$lib/deck/images'
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
  /** The checkbox; starts from the deck's remembered choice each time the dialog opens. */
  let includeNotes = $state(false)
  /** The deck as it would be published with the current checkbox. */
  const outgoing = $derived({ ...deck, publishNotes: includeNotes })
  const hasNotes = $derived(deck.slides.some((s) => s.notes.trim() !== ''))
  /** Slides (1-based) that still embed uploaded images: those block publishing. */
  const uploaded = $derived(slidesWithUploadedImages(deck))
  const blocked = $derived(uploaded.length > 0)
  const slideList = (ns: number[]) =>
    ns.length === 1
      ? `slide ${ns[0]}`
      : `slides ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`

  function setIncludeNotes(v: boolean) {
    includeNotes = v
    // Remember the choice right away, so a later Republish uses it too.
    onchange({ ...deck, publishNotes: v })
  }

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
      includeNotes = untrack(() => deck.publishNotes === true)
    }
  })

  async function doPublish() {
    busy = 'publish'
    error = ''
    const again = live
    try {
      const updated = await publish($state.snapshot(outgoing) as Deck)
      onchange(updated)
      toast.success(again ? 'Republished: same link, 30 more days' : 'Published')
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
      toast.success('Unpublished, the link no longer works')
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
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy, select the link and copy it yourself')
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
    {/if}

    <div class="options">
      <Checkbox
        label="Include speaker notes"
        bind:checked={() => includeNotes, setIncludeNotes}
        disabled={busy !== null}
        describedby="share-notes-hint"
      />
      <p id="share-notes-hint" class="muted">
        {#if includeNotes}
          Anyone with the link can read your speaker notes.
        {:else if hasNotes}
          Your notes stay in this browser; the shared copy has none.
        {:else}
          This deck has no speaker notes.
        {/if}
      </p>
    </div>

    {#if blocked}
      <div class="legacy" role="alert">
        <p>
          <strong>Uploaded images can't be published.</strong> Images are links now: on
          {slideList(uploaded)}, replace each uploaded image with an https:// image link (in
          <strong>Properties</strong>).
        </p>
      </div>
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
          disabled={busy === 'unpublish' || blocked}
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
          disabled={blocked}
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
  .options {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-1);
  }
  .legacy {
    padding: var(--ss-s-3);
    border: 1px solid var(--ss-badge-caution-fg);
    font-size: var(--ss-size-sm);
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
