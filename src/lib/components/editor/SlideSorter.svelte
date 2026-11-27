<!--
  Slide sorter: a vertical column on desktop, a horizontal strip on phones. Roving focus
  (arrows / Home / End), Alt+Arrow reorders, Delete removes, Ctrl/Cmd+D duplicates. Mouse/pen
  can drag a thumbnail to reorder; touch uses the Move earlier / later buttons.
-->
<script lang="ts">
  import { pad } from '$lib/deck/count'
  import { tick } from 'svelte'
  import { Button, Icon, Menu, type MenuItem } from 'dssoca'
  import SlideView from '$lib/components/SlideView.svelte'
  import { LAYOUTS, type LayoutName, type Slide } from '$lib/deck/types'
  import type { ThemeId } from '$lib/themes'
  import { glyph } from './icons'
  import { LAYOUT_LABEL } from './labels'

  interface Props {
    slides: Slide[]
    theme: ThemeId
    current: number
    onselect: (i: number) => void
    onadd: (layout: LayoutName) => void
    onduplicate: (i: number) => void
    ondelete: (i: number) => void
    onmove: (from: number, to: number) => void
  }

  let { slides, theme, current, onselect, onadd, onduplicate, ondelete, onmove }: Props = $props()

  let list = $state<HTMLOListElement>()
  /** Index a dragged slide would land on (null = not dragging). */
  let dropAt = $state<number | null>(null)
  let dragFrom = $state<number | null>(null)
  let justDragged = false
  let drag: { i: number; pointer: number; sx: number; sy: number; active: boolean } | null = null

  const addItems: MenuItem[] = LAYOUTS.map((l) => ({
    id: l,
    label: LAYOUT_LABEL[l],
    onSelect: () => onadd(l),
  }))

  async function focusItem(i: number) {
    await tick()
    list?.querySelectorAll<HTMLElement>('.thumb')[i]?.focus()
  }

  function key(ev: KeyboardEvent, i: number) {
    const prev = ev.key === 'ArrowUp' || ev.key === 'ArrowLeft'
    const next = ev.key === 'ArrowDown' || ev.key === 'ArrowRight'
    if ((prev || next) && ev.altKey) {
      ev.preventDefault()
      const to = i + (prev ? -1 : 1)
      if (to < 0 || to >= slides.length) return
      onmove(i, to)
      focusItem(to)
    } else if (prev || next || ev.key === 'Home' || ev.key === 'End') {
      ev.preventDefault()
      const to =
        ev.key === 'Home'
          ? 0
          : ev.key === 'End'
            ? slides.length - 1
            : Math.min(slides.length - 1, Math.max(0, i + (prev ? -1 : 1)))
      onselect(to)
      focusItem(to)
    } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      ev.preventDefault()
      if (slides.length > 1) {
        ondelete(i)
        focusItem(Math.min(i, slides.length - 2))
      }
    } else if (ev.key.toLowerCase() === 'd' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault()
      onduplicate(i)
      focusItem(i + 1)
    }
  }

  function down(ev: PointerEvent, i: number) {
    if (ev.pointerType === 'touch' || ev.button !== 0) return
    drag = { i, pointer: ev.pointerId, sx: ev.clientX, sy: ev.clientY, active: false }
  }

  function targetIndex(ev: PointerEvent): number {
    const items = [...(list?.querySelectorAll<HTMLElement>('li.item') ?? [])]
    const horizontal = list ? getComputedStyle(list).flexDirection === 'row' : false
    for (let k = 0; k < items.length; k++) {
      const r = items[k].getBoundingClientRect()
      const mid = horizontal ? r.left + r.width / 2 : r.top + r.height / 2
      if ((horizontal ? ev.clientX : ev.clientY) < mid) return k
    }
    return items.length
  }

  function moveP(ev: PointerEvent) {
    if (!drag || ev.pointerId !== drag.pointer) return
    if (!drag.active) {
      if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) < 6) return
      drag.active = true
      dragFrom = drag.i
      ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
    }
    dropAt = targetIndex(ev)
  }

  function up(ev: PointerEvent) {
    if (!drag || ev.pointerId !== drag.pointer) return
    const d = drag
    drag = null
    if (d.active && dropAt !== null) {
      // dropAt is a gap index (0..n); convert to the final position after removal.
      const to = dropAt > d.i ? dropAt - 1 : dropAt
      if (to !== d.i) onmove(d.i, to)
      justDragged = true
      setTimeout(() => (justDragged = false))
    }
    dropAt = null
    dragFrom = null
  }
</script>

<nav class="sorter" aria-label="Slides">
  <ol bind:this={list} role="listbox" aria-label="Slides">
    {#each slides as s, i (s.id)}
      <li
        class="item"
        class:drop-before={dropAt === i &&
          dragFrom !== null &&
          dragFrom !== i &&
          dragFrom !== i - 1}
        class:drop-after={dropAt === slides.length &&
          i === slides.length - 1 &&
          dragFrom !== null &&
          dragFrom !== i}
        class:lifted={dragFrom === i}
      >
        <div
          class="thumb"
          class:current={i === current}
          role="option"
          aria-selected={i === current}
          aria-label="Slide {i + 1} of {slides.length}"
          tabindex={i === current ? 0 : -1}
          onclick={() => !justDragged && onselect(i)}
          onkeydown={(ev) => key(ev, i)}
          onpointerdown={(ev) => down(ev, i)}
          onpointermove={moveP}
          onpointerup={up}
          onpointercancel={() => {
            drag = null
            dropAt = null
            dragFrom = null
          }}
        >
          <span class="n" aria-hidden="true">{pad(i + 1, slides.length)}</span>
          <div class="pic"><SlideView slide={s} {theme} thumbnail /></div>
        </div>
      </li>
    {/each}
  </ol>
  <div class="actions">
    <Menu items={addItems} label="Add slide with layout" size="sm" side="bottom">
      <Icon name={glyph('plus')} size="sm" /> Add slide
    </Menu>
    <div class="row" role="group" aria-label="Current slide">
      <Button
        size="sm"
        variant="ghost"
        iconOnly
        label="Duplicate slide"
        title="Duplicate slide (Ctrl+D)"
        onclick={() => onduplicate(current)}
      >
        <Icon name={glyph('copy')} size="sm" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        iconOnly
        label="Move slide earlier"
        title="Move earlier (Alt+↑)"
        disabled={current === 0}
        onclick={() => onmove(current, current - 1)}
      >
        <Icon name="chevron" rotate={180} size="sm" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        iconOnly
        label="Move slide later"
        title="Move later (Alt+↓)"
        disabled={current === slides.length - 1}
        onclick={() => onmove(current, current + 1)}
      >
        <Icon name="chevron" size="sm" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        iconOnly
        label="Delete slide"
        title="Delete slide"
        disabled={slides.length <= 1}
        onclick={() => ondelete(current)}
      >
        <Icon name={glyph('trash')} size="sm" />
      </Button>
    </div>
  </div>
</nav>

<style lang="scss">
  .sorter {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--ss-s-2);
    min-block-size: 0;
  }
  ol {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-2);
    margin: 0;
    padding: var(--ss-s-1);
    list-style: none;
    overflow: auto;
  }
  .item {
    position: relative;
    &.lifted {
      opacity: 0.5;
    }
    &.drop-before::before,
    &.drop-after::after {
      content: '';
      position: absolute;
      inset-inline: 0;
      block-size: 3px;
      background: var(--ss-primary);
    }
    &.drop-before::before {
      inset-block-start: calc(-1 * var(--ss-s-1) - 2px);
    }
    &.drop-after::after {
      inset-block-end: calc(-1 * var(--ss-s-1) - 2px);
    }
  }
  .thumb {
    display: grid;
    grid-template-columns: 1.5em 1fr;
    gap: var(--ss-s-1);
    align-items: start;
    padding: var(--ss-s-1);
    border: 1px solid transparent;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    &:hover {
      border-color: var(--ss-line);
    }
    &.current {
      border-color: var(--ss-primary);
      background: var(--ss-primary-soft);
    }
    &:focus-visible {
      outline: 2px solid var(--ss-primary);
      outline-offset: 1px;
    }
  }
  .n {
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-xs);
    font-family: var(--ss-font-mono);
    text-align: end;
  }
  .pic {
    pointer-events: none;
    outline: 1px solid var(--ss-line);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ss-s-1);
    padding-inline: var(--ss-s-1);
  }
  .row {
    display: flex;
    gap: var(--ss-s-1);
  }

  @media (max-width: 760px) {
    ol {
      flex-direction: row;
      flex: 1;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .item {
      flex: 0 0 120px;
      &.drop-before::before,
      &.drop-after::after {
        inset-block: 0;
        inline-size: 3px;
        block-size: auto;
      }
      &.drop-before::before {
        inset-inline-start: calc(-1 * var(--ss-s-1) - 2px);
      }
      &.drop-after::after {
        inset-inline: auto calc(-1 * var(--ss-s-1) - 2px);
      }
    }
    .thumb {
      grid-template-columns: 1fr;
      .n {
        display: none;
      }
    }
  }
</style>
