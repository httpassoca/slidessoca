<!--
  "Image URL" field (ADR 0002: images are links). Paste or drop a link, see a preview, set the
  alt text, then Add (or Enter). Files dropped or pasted here get a "links only" toast.
  `onadd({ src, alt })` receives a checked http(s) link; the field clears itself afterwards
  unless `keep` is set (the Inspector's "Replace" keeps showing the current link).
-->
<script lang="ts">
  import { Button, Input } from 'dssoca'
  import { altFromUrl, checkImageUrl } from '$lib/deck/images'
  import { imageFromTransfer } from '$lib/client/images'

  interface Props {
    onadd: (img: { src: string; alt: string }) => void
    /** Starting link (Replace). */
    value?: string
    alt?: string
    label?: string
    submitLabel?: string
    size?: 'sm' | 'md'
    /** Show the alt text input (off where alt text is edited elsewhere). */
    withAlt?: boolean
    keep?: boolean
  }

  let {
    onadd,
    value = '',
    alt: altStart = '',
    label = 'Image URL',
    submitLabel = 'Add image',
    size = 'sm',
    withAlt = true,
    keep = false,
  }: Props = $props()

  // svelte-ignore state_referenced_locally
  let url = $state(value)
  // svelte-ignore state_referenced_locally
  let alt = $state(altStart)
  let altTouched = $state(false)
  let showError = $state(false)
  let preview = $state<'loading' | 'ok' | 'failed'>('loading')

  const check = $derived(checkImageUrl(url))
  const src = $derived(check.ok ? check.src : '')
  const error = $derived(showError && url.trim() && !check.ok ? check.error : undefined)

  $effect(() => {
    void src
    preview = 'loading'
  })

  function setUrl(v: string) {
    url = v
    showError = false
    if (!altTouched && withAlt) {
      const c = checkImageUrl(v)
      alt = c.ok ? altFromUrl(c.src) : ''
    }
  }

  function submit() {
    if (!check.ok) {
      showError = true
      return
    }
    onadd({ src: check.src, alt: alt.trim() })
    if (!keep) {
      url = ''
      alt = ''
      altTouched = false
    }
    showError = false
  }

  function onpaste(e: ClipboardEvent) {
    const link = imageFromTransfer(e.clipboardData)
    if (link === null && e.clipboardData?.files.length) e.preventDefault()
  }

  function ondrop(e: DragEvent) {
    e.preventDefault()
    const link = imageFromTransfer(e.dataTransfer)
    if (link) setUrl(link)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="url-field" ondragover={(e) => e.preventDefault()} {ondrop}>
  <div class="inputs">
    <Input
      {label}
      {size}
      type="url"
      inputmode="url"
      autocomplete="off"
      placeholder="https://…/photo.jpg"
      value={url}
      {error}
      hint={error ? undefined : 'A link to a picture on the web (images are not uploaded)'}
      oninput={(e) => setUrl(e.currentTarget.value)}
      onblur={() => (showError = true)}
      onkeydown={(e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          submit()
        }
      }}
      {onpaste}
    />
    {#if withAlt}
      <Input
        label="Alt text"
        {size}
        value={alt}
        placeholder="What the image shows"
        oninput={(e) => {
          alt = e.currentTarget.value
          altTouched = true
        }}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
      />
    {/if}
  </div>
  {#if src}
    <div class="preview" data-state={preview}>
      {#if preview !== 'failed'}
        <img
          {src}
          alt=""
          referrerpolicy="no-referrer"
          decoding="async"
          onload={() => (preview = 'ok')}
          onerror={() => (preview = 'failed')}
        />
      {/if}
      <p class="note" role="status">
        {#if preview === 'loading'}
          Loading preview…
        {:else if preview === 'failed'}
          This link does not show an image here. Check it, or the site may block showing it
          elsewhere.
        {/if}
      </p>
    </div>
  {/if}
  <div class="actions">
    <Button {size} onclick={submit} disabled={!url.trim()}>{submitLabel}</Button>
  </div>
</div>

<style lang="scss">
  .url-field {
    display: grid;
    gap: var(--ss-s-2);
    min-inline-size: 0;
  }
  .inputs {
    display: grid;
    gap: var(--ss-s-2);
  }
  .preview {
    display: grid;
    gap: var(--ss-s-1);
    img {
      inline-size: 100%;
      max-inline-size: 240px;
      aspect-ratio: 16 / 9;
      object-fit: contain;
      background: var(--ss-bg-inset);
      border: 1px solid var(--ss-line);
    }
    &[data-state='ok'] .note {
      display: none;
    }
  }
  .note {
    margin: 0;
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-sm);
  }
  .preview[data-state='failed'] .note {
    color: var(--ss-danger);
  }
</style>
