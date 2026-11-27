<!-- In-app copy of docs/markdown-format.md (rendered from the same file, so they never drift). -->
<script lang="ts">
  import { Button, Link } from 'dssoca'
  import DOMPurify from 'dompurify'
  import { Marked } from 'marked'
  import { goto } from '$app/navigation'
  import { download } from '$lib/client/export'
  import { EXAMPLE_MD, FORMAT_DOC } from '$lib/format-doc'

  // Developer-authored, but sanitised anyway (invariant 4 applies to every {@html}).
  const html = DOMPurify.sanitize(
    new Marked({ gfm: true, async: false }).parse(FORMAT_DOC) as string,
    { ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i },
  )
</script>

<svelte:head><title>Markdown format · slidessoca</title></svelte:head>

<main class="format">
  <nav class="top">
    <Link href="/new?tab=markdown">← Markdown import</Link>
  </nav>
  <div class="actions">
    <Button variant="primary" onclick={() => goto('/new?tab=markdown&example')}>
      Open this example
    </Button>
    <Button
      onclick={() =>
        download('slidessoca-example.md', new Blob([EXAMPLE_MD], { type: 'text/markdown' }))}
    >
      Download example .md
    </Button>
  </div>
  <article class="doc">{@html html}</article>
</main>

<style lang="scss">
  .format {
    max-inline-size: 880px;
    margin-inline: auto;
    padding: var(--ss-s-4);
    @media (min-width: 720px) {
      padding: var(--ss-s-6);
    }
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ss-s-2);
    margin-block: var(--ss-s-4);
  }
  .doc {
    line-height: 1.55;
    :global(h1),
    :global(h2) {
      font-family: var(--ss-font-display);
      margin-block: var(--ss-s-6) var(--ss-s-3);
    }
    :global(h1) {
      margin-block-start: 0;
    }
    :global(code) {
      font-family: var(--ss-font-mono);
      font-variant-ligatures: none;
      background: var(--ss-code-bg);
      padding-inline: 0.2em;
    }
    :global(pre) {
      background: var(--ss-code-bg);
      color: var(--ss-code-fg);
      padding: var(--ss-s-3);
      overflow-x: auto;
      font-size: var(--ss-size-sm);
      border-inline-start: 3px solid var(--ss-primary);
    }
    :global(pre code) {
      padding: 0;
      background: none;
    }
    :global(a) {
      color: var(--ss-primary);
    }
    :global(table) {
      display: block;
      overflow-x: auto;
      border-collapse: collapse;
      font-size: var(--ss-size-sm);
    }
    :global(:is(th, td)) {
      border: 1px solid var(--ss-line);
      padding: var(--ss-s-1) var(--ss-s-2);
      text-align: start;
      vertical-align: top;
    }
    :global(th) {
      background: var(--ss-bg-elev);
    }
  }
</style>
