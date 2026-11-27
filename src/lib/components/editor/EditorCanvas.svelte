<!--
  The editing canvas: the current slide drawn by SlideView, with a hit layer per element
  (select / drag / 8 resize handles / double-tap to edit text) layered through SlideView's
  `overlay` snippet and the inline Markdown editor through its `override` snippet.
  Pointer deltas are converted to canvas units by the rendered scale; all geometry maths lives in
  `$lib/deck/edit` (pure, tested).
-->
<script lang="ts">
  import { tick } from 'svelte'
  import SlideView from '$lib/components/SlideView.svelte'
  import {
    HANDLES,
    moveBox,
    resizeBox,
    snapMove,
    snapResize,
    snapTargets,
    type Box,
    type Guides,
    type Handle,
  } from '$lib/deck/edit'
  import {
    CANVAS_H,
    CANVAS_W,
    TEXT_SIZE_PX,
    type Slide,
    type SlideElement,
    type TextElement,
  } from '$lib/deck/types'
  import type { ThemeId } from '$lib/themes'

  interface Props {
    slide: Slide
    theme: ThemeId
    label: string
    selectedId: string | null
    editingId: string | null
    onselect: (id: string | null) => void
    /** Live geometry change during a drag; `gesture` groups one drag into one undo step. */
    onbox: (id: string, box: Box, gesture: string) => void
    ongestureend: () => void
    onedit: (id: string | null) => void
    ontext: (id: string, text: string) => void
    onkey: (e: KeyboardEvent) => void
    onfiles: (files: File[]) => void
  }

  let {
    slide,
    theme,
    label,
    selectedId,
    editingId,
    onselect,
    onbox,
    ongestureend,
    onedit,
    ontext,
    onkey,
    onfiles,
  }: Props = $props()

  let wrap = $state<HTMLDivElement>()
  const sel = $derived(selectedId ? slide.elements.find((e) => e.id === selectedId) : undefined)
  let guides = $state<Guides>({ v: [], h: [] })
  let dropping = $state(false)
  let dragging = $state(false)
  let draft = $state('')

  interface Drag {
    id: string
    pointer: number
    handle: Handle | null
    start: Box
    sx: number
    sy: number
    scale: number
    moved: boolean
    gesture: string
  }
  let drag: Drag | null = null
  let gestureN = 0
  let lastTap = { id: '', t: 0 }

  const kindLabel = (e: SlideElement) =>
    e.kind === 'text'
      ? `${e.role === 'free' ? 'Text' : e.role} box: ${e.text.slice(0, 40) || 'empty'}`
      : e.kind === 'image'
        ? `Image${e.alt ? `: ${e.alt}` : ''}`
        : `${e.shape} shape`

  function begin(ev: PointerEvent, e: SlideElement, handle: Handle | null) {
    if (ev.button !== 0 || editingId === e.id) return
    ev.stopPropagation()
    onselect(e.id)
    wrap
      ?.querySelector<HTMLElement>(`.hit[data-id="${CSS.escape(e.id)}"]`)
      ?.focus({ preventScroll: true })
    const scale = (wrap?.getBoundingClientRect().width ?? CANVAS_W) / CANVAS_W
    drag = {
      id: e.id,
      pointer: ev.pointerId,
      handle,
      start: { x: e.x, y: e.y, w: e.w, h: e.h },
      sx: ev.clientX,
      sy: ev.clientY,
      scale,
      moved: false,
      gesture: `drag-${++gestureN}`,
    }
    ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
  }

  function move(ev: PointerEvent) {
    if (!drag || ev.pointerId !== drag.pointer) return
    const dx = (ev.clientX - drag.sx) / drag.scale
    const dy = (ev.clientY - drag.sy) / drag.scale
    if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) < 4) return
    drag.moved = true
    dragging = true
    const targets = snapTargets(slide, drag.id)
    const snap = !ev.altKey
    let res: { box: Box; guides: Guides }
    if (drag.handle) {
      const raw = resizeBox(drag.start, drag.handle, dx, dy, ev.shiftKey)
      res =
        snap && !ev.shiftKey ? snapResize(raw, drag.handle, targets) : { box: raw, guides: none }
    } else {
      const raw = moveBox(drag.start, dx, dy)
      res = snap ? snapMove(raw, targets) : { box: raw, guides: none }
    }
    guides = res.guides
    onbox(drag.id, res.box, drag.gesture)
  }

  const none: Guides = { v: [], h: [] }

  function end(ev: PointerEvent, e: SlideElement) {
    if (!drag || ev.pointerId !== drag.pointer) return
    const wasMove = drag.moved
    drag = null
    dragging = false
    guides = none
    if (wasMove) {
      ongestureend()
      return
    }
    // A tap: two taps on the same text element → edit (works for mouse and touch).
    const now = ev.timeStamp
    if (e.kind === 'text' && lastTap.id === e.id && now - lastTap.t < 400) {
      startEdit(e)
      lastTap = { id: '', t: 0 }
    } else lastTap = { id: e.id, t: now }
  }

  function cancel() {
    if (drag?.moved) ongestureend()
    drag = null
    dragging = false
    guides = none
  }

  function startEdit(e: TextElement) {
    draft = e.text
    onedit(e.id)
  }

  function hitKey(ev: KeyboardEvent, e: SlideElement) {
    if (ev.key === 'Enter' && e.kind === 'text' && editingId !== e.id) {
      ev.preventDefault()
      startEdit(e)
      return
    }
    onkey(ev)
  }

  function editorKey(ev: KeyboardEvent) {
    ev.stopPropagation()
    if (ev.key === 'Escape' || (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey))) {
      ev.preventDefault()
      finishEdit()
    }
  }

  async function finishEdit() {
    const id = editingId
    onedit(null)
    await tick()
    if (id) wrap?.querySelector<HTMLElement>(`.hit[data-id="${CSS.escape(id)}"]`)?.focus()
  }

  function autofocus(node: HTMLTextAreaElement) {
    node.focus()
    node.setSelectionRange(node.value.length, node.value.length)
  }

  function onDrop(ev: DragEvent) {
    ev.preventDefault()
    dropping = false
    const files = [...(ev.dataTransfer?.files ?? [])]
    if (files.length) onfiles(files)
  }

  const pct = (v: number, of: number) => `${(v / of) * 100}%`
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="canvas"
  class:dropping
  class:dragging
  bind:this={wrap}
  onpointerdown={(ev) => {
    if (
      ev.target === ev.currentTarget ||
      !(ev.target as HTMLElement).closest('.hit, .editor, .handle')
    )
      onselect(null)
  }}
  ondragover={(ev) => {
    if (ev.dataTransfer?.types.includes('Files')) {
      ev.preventDefault()
      dropping = true
    }
  }}
  ondragleave={() => (dropping = false)}
  ondrop={onDrop}
>
  <SlideView {slide} {theme} {label} {overlay} override={inline} overrideId={editingId} />
  <div class="guides" aria-hidden="true">
    {#each guides.v as x (x)}<span class="gv" style="inset-inline-start:{pct(x, CANVAS_W)}"
      ></span>{/each}
    {#each guides.h as y (y)}<span class="gh" style="inset-block-start:{pct(y, CANVAS_H)}"
      ></span>{/each}
  </div>
  {#if sel && editingId !== sel.id}
    {@const e = sel}
    <div
      class="selection"
      class:line={e.kind === 'shape' && e.shape === 'line'}
      style="left:{pct(e.x, CANVAS_W)};top:{pct(e.y, CANVAS_H)};width:{pct(
        e.w,
        CANVAS_W,
      )};height:{pct(e.h, CANVAS_H)}"
      aria-hidden="true"
    >
      {#each HANDLES as h (h)}
        <span
          class="handle h-{h}"
          onpointerdown={(ev) => begin(ev, e, h)}
          onpointermove={move}
          onpointerup={(ev) => end(ev, e)}
          onpointercancel={cancel}
        ></span>
      {/each}
    </div>
  {/if}
  {#if dropping}<div class="drop" aria-hidden="true">Drop image to insert</div>{/if}
</div>

{#snippet overlay(e: SlideElement)}
  {#if editingId !== e.id}
    <div
      class="hit"
      class:selected={selectedId === e.id}
      class:line={e.kind === 'shape' && e.shape === 'line'}
      data-id={e.id}
      role="button"
      tabindex="0"
      aria-label={kindLabel(e)}
      aria-pressed={selectedId === e.id}
      onpointerdown={(ev) => begin(ev, e, null)}
      onpointermove={move}
      onpointerup={(ev) => end(ev, e)}
      onpointercancel={cancel}
      onfocus={() => selectedId !== e.id && onselect(e.id)}
      onkeydown={(ev) => hitKey(ev, e)}
    ></div>
  {/if}
{/snippet}

{#snippet inline(e: SlideElement)}
  {#if e.kind === 'text'}
    <textarea
      class="editor"
      aria-label="Edit {e.role === 'free' ? 'text' : e.role} (Markdown). Escape to finish."
      style="--px:{(TEXT_SIZE_PX[e.size] / CANVAS_W) *
        100}cqw;text-align:{e.align};font-family:var(--ss-font-{e.font});{e.bold
        ? 'font-weight:700;'
        : ''}{e.italic ? 'font-style:italic;' : ''}"
      bind:value={draft}
      oninput={() => ontext(e.id, draft)}
      onkeydown={editorKey}
      onblur={() => editingId === e.id && onedit(null)}
      use:autofocus></textarea>
  {/if}
{/snippet}

<style lang="scss">
  .canvas {
    position: relative;
    inline-size: 100%;
    outline: 1px solid var(--ss-line);
    user-select: none;
    -webkit-user-select: none;
    &.dropping {
      outline: 2px dashed var(--ss-primary);
    }
    &.dragging {
      cursor: grabbing;
    }
  }
  .hit {
    position: absolute;
    inset: 0;
    cursor: move;
    outline-offset: 0;
    &:hover {
      outline: 1px dashed var(--ss-line-strong);
      outline-offset: -1px;
    }
    &:focus-visible {
      outline: 2px solid var(--ss-focus, var(--ss-primary));
    }
    &.selected {
      outline: none;
      // Only the selected element captures touch drags; elsewhere the page can still scroll.
      touch-action: none;
    }
    &.line {
      // Lines are thin: give them a usable hit area.
      inset: -8px 0;
    }
  }
  // Selection frame + handles live outside the slide so they are not clipped at canvas edges.
  .selection {
    position: absolute;
    pointer-events: none;
    outline: 2px solid var(--ss-primary);
    &.line {
      outline-offset: 6px;
    }
  }
  .handle {
    pointer-events: auto;
    position: absolute;
    z-index: 1;
    inline-size: 24px;
    block-size: 24px;
    margin: -12px;
    touch-action: none;
    &::after {
      content: '';
      position: absolute;
      inset: 7px;
      background: var(--ss-bg);
      border: 2px solid var(--ss-primary);
    }
  }
  .h-nw {
    inset-block-start: 0;
    inset-inline-start: 0;
    cursor: nwse-resize;
  }
  .h-n {
    inset-block-start: 0;
    inset-inline-start: 50%;
    cursor: ns-resize;
  }
  .h-ne {
    inset-block-start: 0;
    inset-inline-start: 100%;
    cursor: nesw-resize;
  }
  .h-e {
    inset-block-start: 50%;
    inset-inline-start: 100%;
    cursor: ew-resize;
  }
  .h-se {
    inset-block-start: 100%;
    inset-inline-start: 100%;
    cursor: nwse-resize;
  }
  .h-s {
    inset-block-start: 100%;
    inset-inline-start: 50%;
    cursor: ns-resize;
  }
  .h-sw {
    inset-block-start: 100%;
    inset-inline-start: 0;
    cursor: nesw-resize;
  }
  .h-w {
    inset-block-start: 50%;
    inset-inline-start: 0;
    cursor: ew-resize;
  }
  .editor {
    box-sizing: border-box;
    display: block;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    padding: 0;
    resize: none;
    border: 0;
    outline: 2px solid var(--ss-primary);
    background: color-mix(in oklch, var(--ss-bg) 88%, transparent);
    color: var(--ss-fg);
    font-size: var(--px);
    line-height: 1.25;
    user-select: text;
    -webkit-user-select: text;
  }
  .guides {
    position: absolute;
    inset: 0;
    pointer-events: none;
    span {
      position: absolute;
      background: var(--ss-magenta, var(--ss-primary));
    }
    .gv {
      inset-block: 0;
      inline-size: 1px;
    }
    .gh {
      inset-inline: 0;
      block-size: 1px;
    }
  }
  .drop {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    background: color-mix(in oklch, var(--ss-bg) 70%, transparent);
    color: var(--ss-fg);
    font-family: var(--ss-font-display);
  }
</style>
