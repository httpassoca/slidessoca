<!--
  Inspector: properties of the selected element, then of the slide (layout, background, a
  content form for auto slides, speaker notes). Every change goes through `onslide`, which takes a
  pure slide → slide function and an optional undo group (typing coalesces into one step).
-->
<script lang="ts">
  import { Button, Input, NumberField, SegmentedControl, Select, Switch, Textarea } from 'dssoca'
  import {
    deleteElement,
    reorderElement,
    setBox,
    setContent,
    setLayout,
    updateElement,
    type ZMove,
  } from '$lib/deck/edit'
  import {
    COLOR_TOKENS,
    LAYOUTS,
    TEXT_SIZES,
    type ImageElement,
    type ShapeElement,
    type Slide,
    type SlideBackground,
    type SlideContent,
    type SlideElement,
    type TextElement,
  } from '$lib/deck/types'
  import type { ThemeId } from '$lib/themes'
  import { LAYOUT_LABEL } from './labels'
  import Swatches from './Swatches.svelte'

  interface Props {
    slide: Slide
    element: SlideElement | undefined
    theme: ThemeId
    onslide: (fn: (s: Slide) => Slide, group?: string) => void
    onreplaceimage: (id: string, file: File) => void
    onaddimages: (files: File[]) => void
  }

  let { slide, element, theme, onslide, onreplaceimage, onaddimages }: Props = $props()

  const patch = (p: Partial<SlideElement>, group?: string) => {
    const id = element?.id
    if (id) onslide((s) => updateElement(s, id, p), group)
  }
  const content = (p: Partial<SlideContent>, group?: string) =>
    onslide((s) => setContent(s, p), group)

  const SIZE_LABEL: Record<string, string> = {
    xs: 'XS',
    sm: 'Small',
    md: 'Medium',
    lg: 'Large',
    xl: 'XL',
    xxl: 'Huge',
  }

  let replaceInput = $state<HTMLInputElement>()
  let addInput = $state<HTMLInputElement>()

  const z = (m: ZMove) => {
    const id = element?.id
    if (id) onslide((s) => reorderElement(s, id, m))
  }

  function geom(k: 'x' | 'y' | 'w' | 'h', v: number | null) {
    const e = element
    if (!e || v === null || !Number.isFinite(v)) return
    onslide((s) => setBox(s, e.id, { x: e.x, y: e.y, w: e.w, h: e.h, [k]: Math.round(v) }))
  }

  const t = $derived(element?.kind === 'text' ? (element as TextElement) : null)
  const img = $derived(element?.kind === 'image' ? (element as ImageElement) : null)
  const shp = $derived(element?.kind === 'shape' ? (element as ShapeElement) : null)
  const g = (k: string) => `${k}-${slide.id}`
</script>

<div class="inspector">
  {#if element}
    <section aria-labelledby="insp-el">
      <h2 id="insp-el">
        {t ? (t.role === 'free' ? 'Text box' : `Text · ${t.role}`) : img ? 'Image' : 'Shape'}
      </h2>

      {#if t}
        <Select
          label="Size"
          size="sm"
          value={t.size}
          options={TEXT_SIZES.map((v) => ({ value: v, label: SIZE_LABEL[v] }))}
          onchange={(e) => patch({ size: e.currentTarget.value as TextElement['size'] })}
        />
        <Swatches
          label="Colour"
          value={t.color}
          options={COLOR_TOKENS}
          {theme}
          onpick={(v) => v !== 'none' && patch({ color: v })}
        />
        <div class="seg">
          <span class="label">Align</span>
          <SegmentedControl
            label="Horizontal align"
            size="sm"
            fullWidth
            value={t.align}
            options={[
              { value: 'start', label: 'Left' },
              { value: 'center', label: 'Centre' },
              { value: 'end', label: 'Right' },
            ]}
            onChange={(v) => patch({ align: v as TextElement['align'] })}
          />
          <SegmentedControl
            label="Vertical align"
            size="sm"
            fullWidth
            value={t.valign}
            options={[
              { value: 'top', label: 'Top' },
              { value: 'middle', label: 'Middle' },
              { value: 'bottom', label: 'Bottom' },
            ]}
            onChange={(v) => patch({ valign: v as TextElement['valign'] })}
          />
        </div>
        <div class="seg">
          <span class="label">Font</span>
          <SegmentedControl
            label="Font"
            size="sm"
            fullWidth
            value={t.font}
            options={[
              { value: 'display', label: 'Display' },
              { value: 'body', label: 'Body' },
              { value: 'mono', label: 'Mono' },
            ]}
            onChange={(v) => patch({ font: v as TextElement['font'] })}
          />
        </div>
        <div class="row">
          <Switch
            label="Bold"
            size="sm"
            checked={!!t.bold}
            onchange={(v) => patch({ bold: v || undefined })}
          />
          <Switch
            label="Italic"
            size="sm"
            checked={!!t.italic}
            onchange={(v) => patch({ italic: v || undefined })}
          />
        </div>
        <p class="hint">Double-click the box (double-tap on touch) to edit its Markdown.</p>
      {:else if img}
        <div class="seg">
          <span class="label">Fit</span>
          <SegmentedControl
            label="Image fit"
            size="sm"
            fullWidth
            value={img.fit}
            options={[
              { value: 'contain', label: 'Contain' },
              { value: 'cover', label: 'Cover' },
            ]}
            onChange={(v) => patch({ fit: v as ImageElement['fit'] })}
          />
        </div>
        <Input
          label="Alt text"
          size="sm"
          value={img.alt}
          oninput={(e) => patch({ alt: e.currentTarget.value }, g(`alt-${img.id}`))}
        />
        <Button size="sm" onclick={() => replaceInput?.click()}>Replace image…</Button>
        <input
          bind:this={replaceInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          hidden
          onchange={(e) => {
            const f = e.currentTarget.files?.[0]
            if (f) onreplaceimage(img.id, f)
            e.currentTarget.value = ''
          }}
        />
      {:else if shp}
        <Swatches
          label="Fill"
          value={shp.fill}
          options={['none', ...COLOR_TOKENS]}
          {theme}
          onpick={(v) => patch({ fill: v })}
        />
        <Swatches
          label="Stroke"
          value={shp.stroke}
          options={['none', ...COLOR_TOKENS]}
          {theme}
          onpick={(v) => patch({ stroke: v })}
        />
      {/if}

      <div class="geom">
        <NumberField
          label="X"
          size="sm"
          value={element.x}
          onchange={(e) => geom('x', +e.currentTarget.value)}
        />
        <NumberField
          label="Y"
          size="sm"
          value={element.y}
          onchange={(e) => geom('y', +e.currentTarget.value)}
        />
        <NumberField
          label="W"
          size="sm"
          min={16}
          value={element.w}
          onchange={(e) => geom('w', +e.currentTarget.value)}
        />
        <NumberField
          label="H"
          size="sm"
          min={16}
          value={element.h}
          onchange={(e) => geom('h', +e.currentTarget.value)}
        />
      </div>
      <div class="row wrap">
        <Button size="sm" variant="ghost" onclick={() => z('front')}>To front</Button>
        <Button size="sm" variant="ghost" onclick={() => z('forward')}>Forward</Button>
        <Button size="sm" variant="ghost" onclick={() => z('backward')}>Backward</Button>
        <Button size="sm" variant="ghost" onclick={() => z('back')}>To back</Button>
      </div>
      <Button
        size="sm"
        variant="danger"
        onclick={() => {
          const id = element?.id
          if (id) onslide((s) => deleteElement(s, id))
        }}
      >
        Delete element
      </Button>
    </section>
  {/if}

  <section aria-labelledby="insp-slide">
    <h2 id="insp-slide">Slide</h2>
    <Select
      label="Layout"
      size="sm"
      value={slide.layout}
      options={LAYOUTS.map((l) => ({ value: l, label: LAYOUT_LABEL[l] }))}
      onchange={(e) => {
        const l = e.currentTarget.value as Slide['layout']
        onslide((s) => setLayout(s, l))
      }}
    />
    {#if slide.manual}
      <p class="hint">Arranged by hand. Re-applying the layout rebuilds it from the content.</p>
      <Button size="sm" onclick={() => onslide((s) => setLayout(s, s.layout))}>
        Re-apply layout
      </Button>
    {/if}
    <div class="seg">
      <span class="label">Background</span>
      <SegmentedControl
        label="Background"
        size="sm"
        fullWidth
        value={slide.background}
        options={[
          { value: 'bg', label: 'Plain' },
          { value: 'surface', label: 'Surface' },
          { value: 'accent', label: 'Accent' },
        ]}
        onChange={(v) => onslide((s) => ({ ...s, background: v as SlideBackground }))}
      />
    </div>
  </section>

  {#if !slide.manual}
    <section aria-labelledby="insp-content">
      <h2 id="insp-content">Content</h2>
      {#if slide.layout === 'quote'}
        <Textarea
          label="Quote"
          size="sm"
          rows={3}
          autosize
          value={slide.content.quote?.text ?? (slide.content.body || slide.content.title)}
          oninput={(e) =>
            content(
              { quote: { text: e.currentTarget.value, cite: slide.content.quote?.cite ?? '' } },
              g('quote'),
            )}
        />
        <Input
          label="Cite"
          size="sm"
          value={slide.content.quote?.cite ?? ''}
          oninput={(e) =>
            content(
              {
                quote: {
                  text: slide.content.quote?.text ?? (slide.content.body || slide.content.title),
                  cite: e.currentTarget.value,
                },
              },
              g('cite'),
            )}
        />
      {:else}
        <Input
          label="Title"
          size="sm"
          value={slide.content.title}
          oninput={(e) => content({ title: e.currentTarget.value }, g('title'))}
        />
        <Input
          label="Subtitle"
          size="sm"
          value={slide.content.subtitle}
          oninput={(e) => content({ subtitle: e.currentTarget.value }, g('subtitle'))}
        />
        <Textarea
          label="Body (Markdown)"
          size="sm"
          rows={4}
          autosize
          maxRows={12}
          value={slide.content.body}
          oninput={(e) => content({ body: e.currentTarget.value }, g('body'))}
        />
        <div class="images">
          <span class="label">Images</span>
          {#each slide.content.images as im, i (i)}
            <div class="img-row">
              <img src={im.src} alt="" />
              <Input
                label="Alt text for image {i + 1}"
                size="sm"
                value={im.alt}
                oninput={(e) =>
                  content(
                    {
                      images: slide.content.images.map((x, k) =>
                        k === i ? { ...x, alt: e.currentTarget.value } : x,
                      ),
                    },
                    g(`img-alt-${i}`),
                  )}
              />
              <Button
                size="sm"
                variant="ghost"
                label="Remove image {i + 1}"
                onclick={() => content({ images: slide.content.images.filter((_, k) => k !== i) })}
              >
                Remove
              </Button>
            </div>
          {/each}
          <Button size="sm" onclick={() => addInput?.click()}>Add images…</Button>
          <input
            bind:this={addInput}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            hidden
            onchange={(e) => {
              const files = [...(e.currentTarget.files ?? [])]
              if (files.length) onaddimages(files)
              e.currentTarget.value = ''
            }}
          />
        </div>
      {/if}
    </section>
  {/if}

  <section aria-labelledby="insp-notes">
    <h2 id="insp-notes">Speaker notes</h2>
    <Textarea
      label="Notes"
      size="sm"
      rows={4}
      autosize
      maxRows={14}
      value={slide.notes}
      placeholder="Only you see these while presenting."
      oninput={(e) => {
        const notes = e.currentTarget.value
        onslide((s) => ({ ...s, notes }), g('notes'))
      }}
    />
  </section>
</div>

<style lang="scss">
  .inspector {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-4);
  }
  section {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-3);
    padding-block-end: var(--ss-s-4);
    border-block-end: 1px solid var(--ss-line);
    &:last-child {
      border-block-end: 0;
    }
  }
  h2 {
    margin: 0;
    font-family: var(--ss-font-display);
    font-size: var(--ss-size-body);
    text-transform: capitalize;
  }
  .label {
    font-size: var(--ss-size-sm);
    color: var(--ss-fg-muted);
  }
  .seg {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-1);
  }
  .row {
    display: flex;
    gap: var(--ss-s-4);
    align-items: center;
    &.wrap {
      flex-wrap: wrap;
      gap: var(--ss-s-1);
    }
  }
  .geom {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--ss-s-2);
  }
  .hint {
    margin: 0;
    font-size: var(--ss-size-xs);
    color: var(--ss-fg-muted);
  }
  .images {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-2);
  }
  .img-row {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    gap: var(--ss-s-2);
    align-items: end;
    img {
      inline-size: 48px;
      block-size: 36px;
      object-fit: cover;
      outline: 1px solid var(--ss-line);
    }
  }
</style>
