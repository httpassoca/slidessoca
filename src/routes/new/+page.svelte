<script lang="ts">
  import { page } from '$app/state'
  import { afterNavigate, replaceState } from '$app/navigation'
  import { Link, Tabs } from 'dssoca'
  import ExampleList from '$lib/components/ExampleList.svelte'
  import { EXAMPLE_MD } from '$lib/format-doc'
  import { markdown } from './draft.svelte'
  import JsonImport from './JsonImport.svelte'
  import MarkdownImport from './MarkdownImport.svelte'
  import QuickCreate from './QuickCreate.svelte'

  const TABS = [
    { id: 'quick', label: 'Quick create' },
    { id: 'markdown', label: 'Markdown' },
    { id: 'json', label: 'Import JSON' },
    { id: 'examples', label: 'Examples' },
  ]
  const initial = page.url.searchParams.get('tab')
  let tab = $state(TABS.some((t) => t.id === initial) ? initial! : 'quick')

  // /format → "Open this example" (or a direct link to /new?tab=markdown&example): prefill the
  // Markdown tab before the panels mount (not in onMount, after them), and drop `example` from
  // the URL only once the router is ready.
  const prefill = page.url.searchParams.has('example')
  if (prefill) {
    markdown.reset()
    markdown.source = EXAMPLE_MD
    markdown.fileName = 'example.md'
    tab = 'markdown'
  }
  afterNavigate(() => {
    if (prefill && page.url.searchParams.has('example')) replaceState('/new?tab=markdown', {})
  })

  function onChange(id: string) {
    replaceState(id === 'quick' ? '/new' : `/new?tab=${id}`, {})
  }
</script>

<svelte:head><title>New deck · slidessoca</title></svelte:head>

<main class="new">
  <header class="head">
    <Link href="/">← Decks</Link>
    <h1>New deck</h1>
  </header>
  <Tabs label="How to make the deck" tabs={TABS} bind:value={tab} {onChange}>
    {#snippet panel(t)}
      {#if t.id === 'quick'}<QuickCreate />
      {:else if t.id === 'markdown'}<MarkdownImport />
      {:else if t.id === 'json'}<JsonImport />
      {:else}
        <p class="examples-hint">
          Ready-made decks with speaker notes. Open one to read or present it, or make a copy to
          edit
        </p>
        <ExampleList />
      {/if}
    {/snippet}
  </Tabs>
</main>

<style lang="scss">
  .new {
    max-inline-size: 1280px;
    margin-inline: auto;
    padding: var(--ss-s-4);
    @media (min-width: 720px) {
      padding: var(--ss-s-6);
    }
  }
  .examples-hint {
    margin: 0 0 var(--ss-s-4);
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
  }
  .head {
    display: grid;
    gap: var(--ss-s-2);
    margin-block-end: var(--ss-s-4);
    h1 {
      margin: 0;
      font-family: var(--ss-font-display);
    }
  }
</style>
