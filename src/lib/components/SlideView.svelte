<!--
  Renders one slide. The ONE renderer used by the editor canvas, thumbnails, the viewer and the
  presenter, so what you edit is exactly what people see.

  Scaling is pure CSS: the root is a size container, positions are % of the 1600×900 canvas and
  font sizes are `cqw`, so it renders correctly on the server and at any width with no JS.
  Text boxes auto-fit: if a box overflows, `fit` shrinks its font until it fits (min 50%).
-->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { CANVAS_H, CANVAS_W, TEXT_SIZE_PX, type Slide, type SlideElement } from '$lib/deck/types'
  import { COLOR_VAR, renderMarkdown } from '$lib/deck/render'
  import { themeAttributes, type ThemeId } from '$lib/themes'

  interface Props {
    slide: Slide
    theme: ThemeId
    /** Accessible name for the slide region (e.g. "Slide 3 of 10"). */
    label?: string
    /** Decorative thumbnails hide their content from assistive tech. */
    thumbnail?: boolean
    /** Editor hook: extra markup layered on each element (selection handles…). */
    overlay?: Snippet<[SlideElement]>
    /** Editor hook: replaces an element's content (e.g. inline text editing). */
    override?: Snippet<[SlideElement]> | null
    overrideId?: string | null
    class?: string
  }

  let {
    slide,
    theme,
    label,
    thumbnail = false,
    overlay,
    override = null,
    overrideId = null,
    class: cls = '',
  }: Props = $props()

  // Image sources that failed to load (dead URL, missing upload): drawn as a quiet frame instead
  // of the browser's broken-image glyph.
  let failed = $state<Record<string, true>>({})

  const pct = (v: number, of: number) => `${(v / of) * 100}%`
  const cq = (px: number) => `${(px / CANVAS_W) * 100}cqw`

  function boxStyle(e: SlideElement) {
    return `left:${pct(e.x, CANVAS_W)};top:${pct(e.y, CANVAS_H)};width:${pct(e.w, CANVAS_W)};height:${pct(e.h, CANVAS_H)};`
  }

  /** Shrink-to-fit: lowers --fit until the content stops overflowing its box. */
  function fit(node: HTMLElement, _deps: unknown) {
    let raf = 0
    const run = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        let k = 1
        node.style.setProperty('--fit', '1')
        for (let i = 0; i < 12 && k > 0.5; i++) {
          if (
            node.scrollHeight <= node.clientHeight + 1 &&
            node.scrollWidth <= node.clientWidth + 1
          )
            break
          k -= 0.05
          node.style.setProperty('--fit', String(k))
        }
      })
    }
    const ro = new ResizeObserver(run)
    ro.observe(node)
    run()
    return {
      update: run,
      destroy() {
        ro.disconnect()
        cancelAnimationFrame(raf)
      },
    }
  }
</script>

<div
  class="slide bg-{slide.background} {cls}"
  {...themeAttributes(theme)}
  role={thumbnail ? undefined : 'group'}
  aria-roledescription={thumbnail ? undefined : 'slide'}
  aria-label={thumbnail ? undefined : label}
  aria-hidden={thumbnail ? 'true' : undefined}
>
  {#each slide.elements as e (e.id)}
    <div class="el {e.kind}" style={boxStyle(e)} data-el={e.id}>
      {#if override && overrideId === e.id}
        {@render override(e)}
      {:else if e.kind === 'text'}
        <div
          class="text role-{e.role} v-{e.valign}"
          style="--px:{cq(TEXT_SIZE_PX[e.size])};color:{COLOR_VAR[
            e.color
          ]};text-align:{e.align};font-family:var(--ss-font-{e.font});{e.bold
            ? 'font-weight:700;'
            : ''}{e.italic ? 'font-style:italic;' : ''}"
          use:fit={[e.text, e.size, e.w, e.h, e.font]}
        >
          <div class="inner">{@html renderMarkdown(e.text)}</div>
        </div>
      {:else if e.kind === 'image' && failed[e.src]}
        <div
          class="missing"
          role={thumbnail ? undefined : 'img'}
          aria-label={thumbnail ? undefined : e.alt}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" /><path d="M3 16l5-5 4 4 3-3 6 6" />
          </svg>
          {#if e.alt}<span>{e.alt}</span>{/if}
        </div>
      {:else if e.kind === 'image'}
        <img
          onerror={() => (failed[e.src] = true)}
          src={e.src}
          alt={thumbnail ? '' : e.alt}
          style="object-fit:{e.fit}"
          draggable="false"
          referrerpolicy="no-referrer"
          decoding="async"
          loading="lazy"
        />
      {:else if e.kind === 'shape'}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {#if e.shape === 'rect'}
            <rect
              x="0"
              y="0"
              width="100"
              height="100"
              fill={e.fill === 'none' ? 'none' : COLOR_VAR[e.fill]}
              stroke={e.stroke === 'none' ? 'none' : COLOR_VAR[e.stroke]}
              stroke-width="2"
              vector-effect="non-scaling-stroke"
            />
          {:else if e.shape === 'ellipse'}
            <ellipse
              cx="50"
              cy="50"
              rx="50"
              ry="50"
              fill={e.fill === 'none' ? 'none' : COLOR_VAR[e.fill]}
              stroke={e.stroke === 'none' ? 'none' : COLOR_VAR[e.stroke]}
              stroke-width="2"
              vector-effect="non-scaling-stroke"
            />
          {:else}
            <line
              x1="0"
              y1="50"
              x2="100"
              y2="50"
              stroke={e.stroke === 'none' ? COLOR_VAR.fg : COLOR_VAR[e.stroke]}
              stroke-width="3"
              vector-effect="non-scaling-stroke"
            />
          {/if}
        </svg>
      {/if}
      {#if overlay}{@render overlay(e)}{/if}
    </div>
  {/each}
</div>

<style lang="scss">
  .slide {
    container-type: inline-size;
    position: relative;
    inline-size: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--ss-bg);
    color: var(--ss-fg);
    font-family: var(--ss-font-body);
    &.bg-surface {
      background: var(--ss-bg-elev);
    }
    &.bg-accent {
      background: var(--ss-primary);
      color: var(--ss-fg-on-primary);
    }
  }
  .el {
    position: absolute;
  }
  // The text box inside an element (not the `.el.text` wrapper, which must not clip editor handles).
  .el > .text {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    inline-size: 100%;
    overflow: hidden;
    font-size: calc(var(--px) * var(--fit, 1));
    line-height: 1.25;
    overflow-wrap: anywhere;
    &.v-middle {
      justify-content: center;
    }
    &.v-bottom {
      justify-content: flex-end;
    }
    &.role-title,
    &.role-quote {
      line-height: 1.08;
      letter-spacing: -0.01em;
    }
    /* dssoca's global type styles (p, h1…, code, pre) use fixed px sizes and colours; inside a
       slide everything scales with the box (--px · cqw) and takes the element's colour/font.
       :where() keeps this at zero specificity so the rules below still apply. */
    .inner :global(:where(p, h1, h2, h3, h4, ul, ol, li, blockquote, a, code, pre)) {
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      color: inherit;
      letter-spacing: inherit;
      text-shadow: none;
    }
    .inner :global(p) {
      margin: 0 0 0.45em;
    }
    .inner :global(p:last-child) {
      margin-block-end: 0;
    }
    .inner :global(:is(ul, ol)) {
      margin: 0;
      padding-inline-start: 1.2em;
    }
    .inner :global(ol) {
      padding-inline-start: 1.8em;
    }
    .inner :global(li) {
      margin-block-end: 0.35em;
    }
    .inner :global(li::marker) {
      color: var(--ss-primary);
    }
    .inner :global(:is(h1, h2, h3, h4)) {
      margin: 0 0 0.3em;
      font-family: var(--ss-font-display);
      font-size: 1.2em;
    }
    .inner :global(code) {
      font-family: var(--ss-font-mono);
      background: var(--ss-code-bg);
      padding: 0 0.2em;
    }
    .inner :global(pre) {
      background: var(--ss-code-bg);
      padding: 0.5em 0.7em;
      font-size: 0.8em;
      overflow: hidden;
    }
    .inner :global(a) {
      color: var(--ss-primary);
      text-decoration: underline;
    }
    .inner :global(strong) {
      color: var(--ss-primary);
    }
    .inner :global(blockquote) {
      margin: 0;
      padding-inline-start: 0.6em;
      border-inline-start: 0.12em solid var(--ss-primary);
    }
  }
  .role-title :global(strong),
  .role-caption :global(strong) {
    color: inherit;
  }
  .role-caption {
    padding: 0.4em 0.6em;
    background: color-mix(in oklch, var(--ss-bg) 78%, transparent);
  }
  .missing {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6em;
    block-size: 100%;
    border: 1px dashed var(--ss-line-strong);
    color: var(--ss-fg-muted);
    font-size: 1.6cqw;
    text-align: center;
    svg {
      inline-size: 3cqw;
      block-size: 3cqw;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
    }
  }
  img,
  .el > svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
</style>
