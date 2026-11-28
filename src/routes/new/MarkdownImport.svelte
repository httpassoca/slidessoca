<script lang="ts">
  import { goto } from '$app/navigation'
  import { Badge, Button, FileDrop, Input, Link, Textarea, toast } from 'dssoca'
  import SlideGrid from '$lib/components/SlideGrid.svelte'
  import ThemePicker from '$lib/components/ThemePicker.svelte'
  import { putDeck } from '$lib/client/db'
  import { download } from '$lib/client/export'
  import { readImportFiles } from '$lib/client/import'
  import { LINKS_ONLY_MESSAGE } from '$lib/deck/images'
  import { parseMarkdown, parsedToDeck } from '$lib/deck/markdown'
  import { makeSlide } from '$lib/deck/factory'
  import { EXAMPLE_MD } from '$lib/format-doc'
  import { markdown as d } from './draft.svelte'

  const PLACEHOLDER = '# My talk\nA subtitle\n\n---\n\n## Agenda\n- First point\n- Second point'
  const parsed = $derived(parseMarkdown(d.source))
  const slides = $derived(
    parsed.slides.map((s) => makeSlide(s.content, s.notes, s.layout ?? undefined)),
  )
  const missing = $derived(parsed.missing)
  const title = $derived(d.title ?? parsed.title)
  const theme = $derived(d.theme ?? parsed.theme)

  let picked = $state<File[]>([])
  let reading = $state(false)
  let error = $state('')
  let saving = $state(false)

  async function onfiles(files: File[]) {
    if (!files.length) return
    reading = true
    error = ''
    try {
      const res = await readImportFiles(files)
      if (res.markdown) {
        d.source = res.markdown.text
        d.fileName = res.markdown.name
        d.title = null
        d.theme = null
      }
      if (res.images.length) toast.info(LINKS_ONLY_MESSAGE)
      const unused = [...res.images, ...res.skipped]
      if (unused.length) error = `Not used: ${unused.join(', ')}`
    } catch (e) {
      error = `Could not read the files: ${(e as Error).message}`
    } finally {
      reading = false
      picked = []
    }
  }

  async function create() {
    saving = true
    try {
      const deck = await putDeck(parsedToDeck({ ...parsed, title, theme }))
      d.reset()
      goto(`/edit/${deck.id}`)
    } catch (e) {
      toast.error(`Could not save the deck: ${(e as Error).message}`)
      saving = false
    }
  }
</script>

<div class="cols">
  <section class="form" aria-label="Markdown source">
    <FileDrop
      label="Markdown file"
      accept=".md,.markdown,.txt,.zip"
      multiple
      bind:files={picked}
      hint={reading
        ? 'Reading…'
        : 'A .md file (or a .zip with one). Images are full https links inside the Markdown.'}
      {error}
      onfiles={(files, det) => {
        if (det.reason === 'select' || det.reason === 'drop') onfiles(files)
      }}
    />

    <Textarea
      label={d.fileName ? `Markdown — ${d.fileName}` : 'Or paste Markdown'}
      bind:value={d.source}
      rows={10}
      autosize
      maxRows={24}
      placeholder={PLACEHOLDER}
    />
    <div class="row">
      <Button size="sm" onclick={() => ((d.source = EXAMPLE_MD), (d.fileName = 'example.md'))}>
        Use the example
      </Button>
      <Button
        size="sm"
        onclick={() =>
          download('slidessoca-example.md', new Blob([EXAMPLE_MD], { type: 'text/markdown' }))}
      >
        Download example .md
      </Button>
      <Button size="sm" variant="ghost" onclick={() => goto('/format')}>Format help</Button>
    </div>

    {#if missing.length}
      <div class="missing" role="status">
        <h3><Badge tone="caution">{missing.length} missing</Badge> images are not links</h3>
        <p>
          Images are not uploaded: replace each one with a full https link, like
          <code>![alt](https://…/photo.jpg)</code>. The preview updates by itself.
        </p>
        <ul>
          {#each parsed.warnings as w, i (i)}<li>{w}</li>{/each}
        </ul>
      </div>
    {/if}
  </section>

  <section class="preview" aria-label="Preview">
    {#if d.source.trim()}
      <Input
        label="Deck title"
        bind:value={() => title, (v) => (d.title = v)}
        hint={d.title === null ? 'From the file' : undefined}
      />
      <ThemePicker bind:value={() => theme, (v) => (d.theme = v)} />
      <div class="preview-head">
        <h2>Preview</h2>
        <span class="count">{slides.length} {slides.length === 1 ? 'slide' : 'slides'}</span>
      </div>
      <SlideGrid {slides} {theme} />
      <div class="create">
        <Button
          variant="primary"
          fullWidth
          loading={saving}
          disabled={!slides.length}
          onclick={create}
        >
          Create deck · {slides.length} slides{missing.length ? ` (${missing.length} missing)` : ''}
        </Button>
      </div>
    {:else}
      <div class="intro">
        <h2>Write slides in Markdown</h2>
        <p>
          One file is one deck. Separate slides with a line containing only <code>---</code>; the
          first heading is the slide title; images are <code>![alt](https://…/photo.jpg)</code> lines.
        </p>
        <p>
          The <Link href="/format">format help</Link> has every rule and an example you can open here.
        </p>
      </div>
    {/if}
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
  .form,
  .preview {
    display: grid;
    /* minmax(0, …): a textarea sized to its content (a long image link) must not widen the page. */
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ss-s-4);
    min-inline-size: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ss-s-2);
  }
  h2,
  h3 {
    display: flex;
    align-items: center;
    gap: var(--ss-s-2);
    margin: 0;
    font-family: var(--ss-font-display);
  }
  h2 {
    font-size: var(--ss-size-h3);
  }
  h3 {
    font-size: var(--ss-size-body);
  }
  .missing {
    display: grid;
    gap: var(--ss-s-2);
    padding: var(--ss-s-3);
    border: 1px solid var(--ss-line);
    ul {
      display: grid;
      gap: var(--ss-s-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }
  }
  .missing {
    border-color: var(--ss-yellow);
    p {
      margin: 0;
      color: var(--ss-fg-muted);
      font-size: var(--ss-size-sm);
    }
    li {
      overflow-wrap: anywhere;
    }
  }
  .preview-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .count {
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
  }
  .intro p {
    color: var(--ss-fg-muted);
  }
  code {
    font-family: var(--ss-font-mono);
    background: var(--ss-code-bg);
    padding-inline: 0.2em;
  }
  .create {
    position: sticky;
    inset-block-end: 0;
    padding-block: var(--ss-s-2);
    background: var(--ss-bg);
  }
</style>
