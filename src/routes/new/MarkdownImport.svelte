<script lang="ts">
  import { goto } from '$app/navigation'
  import { Badge, Button, FileDrop, Input, Link, Textarea, toast } from 'dssoca'
  import SlideGrid from '$lib/components/SlideGrid.svelte'
  import ThemePicker from '$lib/components/ThemePicker.svelte'
  import { putDeck } from '$lib/client/db'
  import { download } from '$lib/client/export'
  import { readImportFiles } from '$lib/client/import'
  import { parseMarkdown, parsedToDeck } from '$lib/deck/markdown'
  import { makeSlide } from '$lib/deck/factory'
  import { EXAMPLE_MD } from '$lib/format-doc'
  import { markdown as d } from './draft.svelte'

  const PLACEHOLDER = '# My talk\nA subtitle\n\n---\n\n## Agenda\n- First point\n- Second point'
  const parsed = $derived(parseMarkdown(d.source, d.assets))
  const slides = $derived(
    parsed.slides.map((s) => makeSlide(s.content, s.notes, s.layout ?? undefined)),
  )
  const missing = $derived([...new Set(parsed.missing)])
  const imageNames = $derived(Object.keys(d.assets))
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
      d.assets = { ...d.assets, ...res.assets }
      for (const msg of res.tooLarge) toast.error(msg)
      if (res.skipped.length) error = `Skipped: ${res.skipped.join(', ')}`
      if (!res.markdown && !d.source && Object.keys(res.assets).length)
        toast.info('Images added, now add the .md file or paste the Markdown below')
    } catch (e) {
      error = `Could not read the files: ${(e as Error).message}`
    } finally {
      reading = false
      picked = []
    }
  }

  function removeImage(name: string) {
    const { [name]: _gone, ...rest } = d.assets
    d.assets = rest
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
      label="Markdown file and its images"
      accept=".md,.markdown,.txt,.zip,image/png,image/jpeg,image/webp,image/gif,image/avif"
      multiple
      bind:files={picked}
      hint={reading
        ? 'Reading and compressing…'
        : 'Select the .md together with every image it uses (or one .zip). You can add more images later.'}
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

    {#if imageNames.length}
      <div class="files">
        <h3>Images <Badge tone="neutral" count={imageNames.length} label="images" /></h3>
        <ul>
          {#each imageNames as name (name)}
            <li>
              <img src={d.assets[name]} alt="" />
              <span class="fname">{name}</span>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Remove {name}"
                onclick={() => removeImage(name)}
              >
                Remove
              </Button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if missing.length}
      <div class="missing" role="status">
        <h3><Badge tone="caution">{missing.length} missing</Badge> images not found</h3>
        <p>Add these files with the picker above — the preview updates by itself:</p>
        <ul>
          {#each missing as m (m)}<li><code>{m}</code></li>{/each}
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
          first heading is the slide title; images are <code>![alt](file.jpg)</code> lines.
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
  .files,
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
  .files li {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--ss-s-2);
    img {
      inline-size: 64px;
      aspect-ratio: 16 / 9;
      object-fit: cover;
    }
  }
  .fname {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--ss-size-sm);
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
