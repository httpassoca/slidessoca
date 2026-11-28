<script lang="ts">
  import { goto } from '$app/navigation'
  import { tick } from 'svelte'
  import { Button, FileDrop, Input, SegmentedControl, Textarea, toast } from 'dssoca'
  import SlideGrid from '$lib/components/SlideGrid.svelte'
  import ThemePicker from '$lib/components/ThemePicker.svelte'
  import { putDeck } from '$lib/client/db'
  import { compressImage, isImageFile } from '$lib/client/images'
  import { blocksToSlides, quickDeck, splitQuickText } from '$lib/deck/quick'
  import { QUICK_EXAMPLE } from '$lib/format-doc'
  import { blankBlock, quick as d, type DraftBlock } from './draft.svelte'

  const blocks = $derived(d.mode === 'text' ? splitQuickText(d.text) : d.blocks)
  const slides = $derived(blocksToSlides(blocks))
  let busy = $state<Record<string, boolean>>({})
  /** Per-block FileDrop selection, cleared once the images are in the block. */
  let picked = $state<Record<string, File[]>>({})
  let saving = $state(false)

  async function add() {
    d.blocks.push(blankBlock())
    // Focus the new block's title once it renders.
    await tick()
    document.querySelector<HTMLInputElement>('.block:last-of-type input')?.focus()
  }

  function move(i: number, by: number) {
    const j = i + by
    if (j < 0 || j >= d.blocks.length) return
    const [b] = d.blocks.splice(i, 1)
    d.blocks.splice(j, 0, b)
  }

  function remove(i: number) {
    d.blocks.splice(i, 1)
    if (d.blocks.length === 0) d.blocks.push(blankBlock())
  }

  async function addImages(b: DraftBlock, files: File[]) {
    const imgs = files.filter(isImageFile)
    if (!imgs.length) return
    busy[b.key] = true
    try {
      for (const f of imgs) {
        const src = await compressImage(f)
        b.images.push({ src, alt: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') })
      }
    } catch {
      toast.error('Could not read one of the images')
    } finally {
      busy[b.key] = false
      picked[b.key] = []
    }
  }

  function toBlocks() {
    const parsed = splitQuickText(d.text)
    d.blocks = parsed.length ? parsed.map((b) => blankBlock(b.title, b.text)) : [blankBlock()]
    d.mode = 'blocks'
  }

  async function create() {
    saving = true
    try {
      const deck = await putDeck(quickDeck(d.title, d.theme, blocks))
      d.reset()
      goto(`/edit/${deck.id}`)
    } catch (e) {
      toast.error(`Could not save the deck: ${(e as Error).message}`)
      saving = false
    }
  }
</script>

<div class="cols">
  <section class="form" aria-label="Deck content">
    <Input
      label="Deck title"
      bind:value={d.title}
      placeholder="Defaults to the first slide title"
    />
    <ThemePicker bind:value={d.theme} />

    <div class="mode">
      <SegmentedControl
        label="How to write slides"
        bind:value={d.mode}
        options={[
          { value: 'blocks', label: 'Slide by slide' },
          { value: 'text', label: 'One text box' },
        ]}
      />
    </div>

    {#if d.mode === 'blocks'}
      <ol class="blocks">
        {#each d.blocks as b, i (b.key)}
          <li class="block">
            <div class="block-head">
              <span class="num">Slide {i + 1}</span>
              <div class="tools">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={i === 0}
                  aria-label="Move slide {i + 1} up"
                  onclick={() => move(i, -1)}
                >
                  Up
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={i === d.blocks.length - 1}
                  aria-label="Move slide {i + 1} down"
                  onclick={() => move(i, 1)}
                >
                  Down
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Remove slide {i + 1}"
                  onclick={() => remove(i)}
                >
                  Remove
                </Button>
              </div>
            </div>
            <Input
              label="Title"
              bind:value={b.title}
              placeholder={i === 0 ? 'Your big title' : 'Slide title'}
            />
            <Textarea
              label="Text"
              bind:value={b.text}
              rows={3}
              autosize
              maxRows={14}
              placeholder={i === 0
                ? 'One line here becomes the subtitle'
                : '- bullet points, **bold**, *italic*, > quotes…'}
            />
            {#if b.images.length}
              <ul class="imgs" aria-label="Images on slide {i + 1}">
                {#each b.images as im, j (j)}
                  <li>
                    <img src={im.src} alt={im.alt} />
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Remove image {j + 1}"
                      onclick={() => b.images.splice(j, 1)}
                    >
                      Remove
                    </Button>
                  </li>
                {/each}
              </ul>
            {/if}
            <FileDrop
              label="Images"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              multiple
              size="sm"
              hint={busy[b.key] ? 'Compressing…' : 'Drop or pick one or more images'}
              bind:files={() => picked[b.key] ?? [], (v) => (picked[b.key] = v)}
              onfiles={(files, det) => {
                if (det.reason === 'select' || det.reason === 'drop') addImages(b, files)
              }}
            />
          </li>
        {/each}
      </ol>
      <Button onclick={add} fullWidth>Add slide</Button>
    {:else}
      <Textarea
        label="Slides"
        bind:value={d.text}
        rows={12}
        autosize
        maxRows={30}
        placeholder={QUICK_EXAMPLE}
        hint="A line with only --- starts a new slide; the first line of each slide is its title (unless it starts with >, - or an image)"
      />
      <div class="row">
        {#if !d.text.trim()}
          <Button size="sm" onclick={() => (d.text = QUICK_EXAMPLE)}>Fill in an example</Button>
        {/if}
        <Button size="sm" onclick={toBlocks} disabled={!d.text.trim()}>
          Turn into slide blocks (to add images)
        </Button>
      </div>
    {/if}
  </section>

  <section class="preview" aria-label="Preview">
    <div class="preview-head">
      <h2>Preview</h2>
      <span class="count">{slides.length} {slides.length === 1 ? 'slide' : 'slides'}</span>
    </div>
    {#if slides.length}
      <SlideGrid {slides} theme={d.theme} />
    {:else}
      <p class="empty">Type a title or some text and the slides appear here.</p>
    {/if}
    <div class="create">
      <Button variant="primary" fullWidth loading={saving} onclick={create}>
        Create deck{slides.length ? ` · ${slides.length} slides` : ''}
      </Button>
    </div>
  </section>
</div>

<style lang="scss">
  .cols {
    display: grid;
    gap: var(--ss-s-6);
    @media (min-width: 960px) {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .form {
    display: grid;
    gap: var(--ss-s-4);
    min-inline-size: 0;
  }
  .mode {
    overflow-x: auto;
  }
  .blocks {
    display: grid;
    gap: var(--ss-s-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .block {
    display: grid;
    gap: var(--ss-s-3);
    padding: var(--ss-s-3);
    border: 1px solid var(--ss-line);
    border-inline-start: 3px solid var(--ss-primary);
    background: var(--ss-bg-elev);
  }
  .block-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--ss-s-2);
  }
  .num {
    font-family: var(--ss-font-display);
    color: var(--ss-primary);
  }
  .tools,
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ss-s-1);
  }
  .imgs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ss-s-2);
    margin: 0;
    padding: 0;
    list-style: none;
    li {
      display: grid;
      gap: var(--ss-s-1);
      inline-size: 112px;
    }
    img {
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border: 1px solid var(--ss-line);
    }
  }
  .preview {
    display: grid;
    gap: var(--ss-s-3);
    min-inline-size: 0;
    @media (min-width: 960px) {
      position: sticky;
      inset-block-start: var(--ss-s-4);
      max-block-size: calc(100dvh - 2 * var(--ss-s-4));
      overflow-y: auto;
      padding-inline-end: var(--ss-s-1);
    }
  }
  .preview-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    h2 {
      margin: 0;
      font-family: var(--ss-font-display);
      font-size: var(--ss-size-h3);
    }
  }
  .count,
  .empty {
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
  }
  .create {
    position: sticky;
    inset-block-end: 0;
    padding-block: var(--ss-s-2);
    background: var(--ss-bg);
  }
</style>
