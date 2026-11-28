<!--
  /edit/[id] — the PowerPoint-style editor. Holds the deck in an undo history (snapshots of
  immutable decks), autosaves to IndexedDB, and wires the sorter / canvas / inspector together.
  All editing maths is in `$lib/deck/edit` (pure, unit-tested).
-->
<script lang="ts">
  import { counter } from '$lib/deck/count'
  import { beforeNavigate } from '$app/navigation'
  import { page } from '$app/state'
  import { Button, EmptyState, Icon, Menu, Modal, Spinner, toast } from 'dssoca'
  import { onDestroy, onMount } from 'svelte'
  import ImageUrlField from '$lib/components/ImageUrlField.svelte'
  import ShareDialog from '$lib/components/ShareDialog.svelte'
  import EditorCanvas from '$lib/components/editor/EditorCanvas.svelte'
  import EditorTopBar from '$lib/components/editor/EditorTopBar.svelte'
  import Inspector from '$lib/components/editor/Inspector.svelte'
  import SlideSorter from '$lib/components/editor/SlideSorter.svelte'
  import { glyph } from '$lib/components/editor/icons'
  import { getDeck, putDeck } from '$lib/client/db'
  import { exportJson, exportMarkdown } from '$lib/client/export'
  import { downloadDeck } from '$lib/client/downloads'
  import { hasFiles, imageFromTransfer, naturalSize } from '$lib/client/images'
  import { altFromUrl, LINKS_ONLY_MESSAGE } from '$lib/deck/images'
  import {
    blankSlide,
    commit,
    deleteElement,
    deleteSlide,
    duplicateSlide,
    getElement,
    history,
    insertElement,
    insertSlide,
    moveSlide,
    newImage,
    newShape,
    newTextBox,
    nudge,
    redo,
    seal,
    setBox,
    undo,
    updateSlide,
    updateText,
    type Box,
    type History,
  } from '$lib/deck/edit'
  import type { Deck, LayoutName, ShareInfo, Slide } from '$lib/deck/types'
  import type { ThemeId } from '$lib/themes'

  let h = $state.raw<History<Deck> | null>(null)
  let share = $state.raw<ShareInfo | undefined>(undefined)
  /** Share dialog's "Include speaker notes", kept beside `share` (not part of undo history). */
  let publishNotes = $state(false)
  let missing = $state(false)
  let current = $state(0)
  let selectedId = $state<string | null>(null)
  let editingId = $state<string | null>(null)
  let shareOpen = $state(false)
  let sheetOpen = $state(false)
  let saved = $state(true)
  let imageOpen = $state(false)

  const deck = $derived(h?.present)
  const idx = $derived(deck ? Math.min(current, deck.slides.length - 1) : 0)
  const slide = $derived(deck?.slides[idx])
  const selected = $derived(slide ? getElement(slide, selectedId) : undefined)
  const fullDeck = $derived(deck ? { ...deck, share, publishNotes } : undefined)

  onMount(async () => {
    const d = await getDeck(page.params.id!)
    if (!d) {
      missing = true
      return
    }
    const { share: s, publishNotes: n, ...rest } = d
    share = s
    publishNotes = n === true
    h = history(rest as Deck)
    lastSaved = { deck: h.present, share, publishNotes }
    const start = Number(page.url.searchParams.get('slide'))
    if (Number.isInteger(start) && start > 0) current = Math.min(start, d.slides.length - 1)
  })

  // ---------------------------------------------------------------- autosave
  let lastSaved: { deck: Deck; share: ShareInfo | undefined; publishNotes: boolean } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  function flush() {
    clearTimeout(timer)
    timer = undefined
    if (!h || !lastSaved) return
    if (
      lastSaved.deck === h.present &&
      lastSaved.share === share &&
      lastSaved.publishNotes === publishNotes
    )
      return
    const snapshot = { deck: h.present, share, publishNotes }
    lastSaved = snapshot
    const d: Deck = {
      ...snapshot.deck,
      share: snapshot.share,
      publishNotes: snapshot.publishNotes,
      updatedAt: new Date().toISOString(),
    }
    putDeck(d).then(
      () => {
        if (lastSaved === snapshot) saved = true
      },
      (e) => toast.error(`Could not save: ${e?.message ?? e}`),
    )
  }

  $effect(() => {
    const d = h?.present
    const s = share
    const n = publishNotes
    if (
      !d ||
      !lastSaved ||
      (lastSaved.deck === d && lastSaved.share === s && lastSaved.publishNotes === n)
    )
      return
    saved = false
    clearTimeout(timer)
    timer = setTimeout(flush, 400)
  })

  beforeNavigate(flush)
  onDestroy(flush)

  // ---------------------------------------------------------------- state changes
  function apply(next: Deck, group: string | null = null) {
    if (h) h = commit(h, next, group)
  }
  function onslide(fn: (s: Slide) => Slide, group?: string) {
    if (deck) apply(updateSlide(deck, idx, fn), group ?? null)
  }
  function sealGroup() {
    if (h) h = seal(h)
  }
  function doUndo() {
    if (h) h = undo(h)
    editingId = null
  }
  function doRedo() {
    if (h) h = redo(h)
    editingId = null
  }

  // The inline editor's element vanished (undo, relayout removed it): stop editing.
  $effect(() => {
    if (editingId && slide && !getElement(slide, editingId)) editingId = null
  })

  function goto(i: number) {
    if (i !== idx) {
      selectedId = null
      editingId = null
    }
    current = i
  }

  // ---------------------------------------------------------------- slides
  function addSlide(layout: LayoutName) {
    if (!deck) return
    apply(insertSlide(deck, idx + 1, blankSlide(layout)))
    goto(idx + 1)
  }
  function dupSlide(i: number) {
    if (!deck) return
    apply(duplicateSlide(deck, i))
    goto(i + 1)
  }
  function delSlide(i: number) {
    if (!deck || deck.slides.length <= 1) return
    apply(deleteSlide(deck, i))
    goto(Math.max(0, i <= idx ? idx - 1 : idx))
  }
  function mvSlide(from: number, to: number) {
    if (!deck) return
    const id = deck.slides[idx]?.id
    apply(moveSlide(deck, from, to))
    const n = h!.present.slides.findIndex((s) => s.id === id)
    current = n < 0 ? 0 : n
  }

  // ---------------------------------------------------------------- elements
  function insert(make: (s: Slide) => Slide['elements'][number]) {
    if (!slide) return
    const el = make(slide)
    onslide((s) => insertElement(s, el))
    selectedId = el.id
  }

  /** Images are links (ADR 0002): insert one by URL, sized from the picture when it loads. */
  async function insertImage(src: string, alt: string) {
    const size = await naturalSize(src)
    insert((s) => newImage(s, src, alt, size))
  }

  function ondropdata(data: DataTransfer) {
    const src = imageFromTransfer(data)
    if (src) insertImage(src, altFromUrl(src))
  }

  /** Pasting an image file outside a text field: say that images are links. */
  function onpaste(e: ClipboardEvent) {
    const t = e.target as HTMLElement | null
    if (t?.closest('input, textarea, [contenteditable]')) return
    if (!hasFiles(e.clipboardData)) return
    e.preventDefault()
    toast.info(LINKS_ONLY_MESSAGE)
  }

  function onbox(id: string, box: Box, gesture: string) {
    onslide((s) => setBox(s, id, box), gesture)
  }

  function ontext(id: string, text: string) {
    onslide((s) => updateText(s, id, text), `text-${id}`)
  }

  function onedit(id: string | null) {
    editingId = id
    if (id) selectedId = id
    else sealGroup()
  }

  /** Keys while an element on the canvas has focus. */
  function canvasKey(e: KeyboardEvent) {
    if (!selectedId) return
    const id = selectedId
    const step = e.shiftKey ? 10 : 1
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    if (arrows[e.key]) {
      e.preventDefault()
      const [dx, dy] = arrows[e.key]
      onslide((s) => nudge(s, id, dx, dy))
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onslide((s) => deleteElement(s, id))
      selectedId = null
    } else if (e.key === 'Escape') {
      selectedId = null
      ;(e.currentTarget as HTMLElement | null)?.blur?.()
    }
  }

  function globalKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    if (t?.closest('input, textarea, select, [contenteditable], dialog, [role="menu"]')) return
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return
    const k = e.key.toLowerCase()
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault()
      doUndo()
    } else if ((k === 'z' && e.shiftKey) || k === 'y') {
      e.preventDefault()
      doRedo()
    }
  }

  function onShareChange(d: Deck) {
    share = d.share
    publishNotes = d.publishNotes === true
    if (deck && (d.title !== deck.title || d.theme !== deck.theme || d.slides !== deck.slides)) {
      const { share: _s, publishNotes: _n, ...rest } = d
      apply(rest as Deck)
    }
  }
</script>

<svelte:window onkeydown={globalKey} onpagehide={flush} {onpaste} />
<svelte:head><title>{deck ? `${deck.title} · slidessoca` : 'slidessoca'}</title></svelte:head>

{#if missing}
  <main class="missing">
    <EmptyState title="Deck not found" message="It isn't in this browser. Decks live locally." />
    <Button variant="primary" onclick={() => (location.href = '/')}>All decks</Button>
  </main>
{:else if !deck || !slide || !h || !fullDeck}
  <main class="missing"><Spinner /></main>
{:else}
  <div class="editor">
    <EditorTopBar
      title={deck.title}
      theme={deck.theme}
      canUndo={h.past.length > 0}
      canRedo={h.future.length > 0}
      presentHref="/present/{deck.id}?start={idx}"
      {saved}
      ontitle={(v) => apply({ ...deck, title: v }, 'deck-title')}
      ontitleblur={sealGroup}
      ontheme={(t: ThemeId) => apply({ ...deck, theme: t })}
      onundo={doUndo}
      onredo={doRedo}
      onshare={() => {
        flush()
        shareOpen = true
      }}
      onmarkdown={() => exportMarkdown(fullDeck)}
      onjson={() => exportJson(fullDeck)}
      ondownload={(kind) => downloadDeck(fullDeck, kind)}
    />

    <div class="body">
      <aside class="sorter-col">
        <SlideSorter
          slides={deck.slides}
          theme={deck.theme}
          current={idx}
          onselect={goto}
          onadd={addSlide}
          onduplicate={dupSlide}
          ondelete={delSlide}
          onmove={mvSlide}
        />
      </aside>

      <main class="stage">
        <div class="toolbar" role="toolbar" aria-label="Insert">
          <Button size="sm" onclick={() => insert((s) => newTextBox(s))}>Text</Button>
          <Button size="sm" onclick={() => (imageOpen = true)}>Image</Button>
          <Menu
            size="sm"
            label="Insert shape"
            items={[
              {
                id: 'rect',
                label: 'Rectangle',
                onSelect: () => insert((s) => newShape(s, 'rect')),
              },
              {
                id: 'ellipse',
                label: 'Ellipse',
                onSelect: () => insert((s) => newShape(s, 'ellipse')),
              },
              { id: 'line', label: 'Line', onSelect: () => insert((s) => newShape(s, 'line')) },
            ]}
          >
            Shape
          </Menu>
          <span class="spacer"></span>
          {#if selected}
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              label="Delete element"
              onclick={() => {
                const id = selected.id
                onslide((s) => deleteElement(s, id))
                selectedId = null
              }}
            >
              <Icon name={glyph('trash')} size="sm" />
            </Button>
          {/if}
          <span class="count">{counter(idx, deck.slides.length)}</span>
          <span class="sheet-toggle">
            <Button
              size="sm"
              variant={sheetOpen ? 'primary' : 'secondary'}
              aria-expanded={sheetOpen}
              aria-controls="inspector"
              onclick={() => (sheetOpen = !sheetOpen)}
            >
              {#snippet leading()}<Icon name={glyph('panel')} size="sm" />{/snippet}
              Properties
            </Button>
          </span>
        </div>
        <div class="fit">
          <div class="frame">
            <EditorCanvas
              {slide}
              theme={deck.theme}
              label="Slide {idx + 1} of {deck.slides.length}"
              {selectedId}
              {editingId}
              onselect={(id) => {
                selectedId = id
                if (editingId && editingId !== id) editingId = null
              }}
              {onbox}
              ongestureend={sealGroup}
              {onedit}
              {ontext}
              onkey={canvasKey}
              {ondropdata}
            />
          </div>
        </div>
      </main>

      <aside id="inspector" class="inspector-col" class:open={sheetOpen} aria-label="Properties">
        <div class="sheet-head">
          <strong>Properties</strong>
          <Button size="sm" variant="ghost" onclick={() => (sheetOpen = false)}>Close</Button>
        </div>
        <Inspector {slide} element={selected} theme={deck.theme} {onslide} />
      </aside>
    </div>
  </div>

  <Modal bind:open={imageOpen} title="Insert image">
    {#if imageOpen}
      <ImageUrlField
        size="md"
        submitLabel="Insert"
        onadd={({ src, alt }) => {
          imageOpen = false
          insertImage(src, alt)
        }}
      />
    {/if}
  </Modal>

  <ShareDialog bind:open={shareOpen} deck={fullDeck} onchange={onShareChange} />
{/if}

<style lang="scss">
  :global(body:has(.editor)) {
    margin: 0;
  }
  .missing {
    display: grid;
    place-items: center;
    gap: var(--ss-s-4);
    min-block-size: 60dvh;
    padding: var(--ss-s-6) var(--ss-s-4);
  }
  .editor {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    block-size: 100dvh;
    background: var(--ss-bg);
  }
  .body {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr) 300px;
    min-block-size: 0;
  }
  .sorter-col {
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    padding: var(--ss-s-2);
    border-inline-end: 1px solid var(--ss-line);
  }
  .stage {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-3);
    min-block-size: 0;
    padding: var(--ss-s-3) var(--ss-s-5);
    background: var(--ss-bg-inset, var(--ss-bg));
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ss-s-1);
  }
  .spacer {
    flex: 1;
  }
  .count {
    color: var(--ss-fg-muted);
    font-family: var(--ss-font-mono);
    font-size: var(--ss-size-xs);
    padding-inline: var(--ss-s-2);
  }
  .sheet-toggle,
  .sheet-head {
    display: none;
  }
  .fit {
    flex: 1;
    min-block-size: 0;
    container-type: size;
    display: grid;
    place-items: center;
  }
  .frame {
    // Largest 16:9 box that fits the stage — pure CSS, no JS scaling.
    inline-size: min(100cqw, 100cqh * 16 / 9);
  }
  .inspector-col {
    min-block-size: 0;
    overflow: auto;
    padding: var(--ss-s-3);
    border-inline-start: 1px solid var(--ss-line);
    background: var(--ss-bg-elev);
  }

  @media (max-width: 1000px) and (min-width: 761px) {
    .body {
      grid-template-columns: 150px minmax(0, 1fr) 260px;
    }
  }

  @media (max-width: 760px) {
    .editor {
      display: block;
      block-size: auto;
      min-block-size: 100dvh;
      padding-block-end: var(--ss-s-12);
    }
    .body {
      display: flex;
      flex-direction: column;
    }
    .sorter-col {
      padding: var(--ss-s-1) var(--ss-s-2);
      border-inline-end: 0;
      border-block-end: 1px solid var(--ss-line);
    }
    .stage {
      padding: var(--ss-s-2);
    }
    .fit {
      container-type: normal;
      display: block;
    }
    .frame {
      inline-size: 100%;
    }
    .sheet-toggle {
      display: inline-flex;
    }
    .inspector-col {
      position: fixed;
      inset-inline: 0;
      inset-block-end: 0;
      z-index: 20;
      max-block-size: 62dvh;
      border-inline-start: 0;
      border-block-start: 1px solid var(--ss-line-strong);
      box-shadow: var(--ss-shadow-pop);
      transform: translateY(100%);
      visibility: hidden;
      transition:
        transform var(--ss-dur) var(--ss-ease),
        visibility var(--ss-dur);
      &.open {
        transform: none;
        visibility: visible;
      }
    }
    .sheet-head {
      position: sticky;
      inset-block-start: calc(-1 * var(--ss-s-3));
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: calc(-1 * var(--ss-s-3)) calc(-1 * var(--ss-s-3)) var(--ss-s-3);
      padding: var(--ss-s-2) var(--ss-s-3);
      background: var(--ss-bg-elev);
      border-block-end: 1px solid var(--ss-line);
    }
  }
</style>
