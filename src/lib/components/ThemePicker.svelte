<!--
  Deck theme picker: one swatch per THEMES entry. Each swatch is painted by the theme itself
  (data-theme / data-palette on the chip, colours from --ss-* tokens), so it can never drift
  from what the slides look like.
-->
<script lang="ts">
  import { THEMES, themeAttributes, type ThemeId } from '$lib/themes'

  interface Props {
    value: ThemeId
    label?: string
    onchange?: (id: ThemeId) => void
  }
  let { value = $bindable(), label = 'Theme', onchange }: Props = $props()
  const uid = $props.id()

  function pick(id: ThemeId) {
    value = id
    onchange?.(id)
  }

  function onkeydown(e: KeyboardEvent) {
    const i = THEMES.findIndex((t) => t.id === value)
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = THEMES[(i + step + THEMES.length) % THEMES.length]
    pick(next.id)
    ;(e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus()
  }
</script>

<div class="picker">
  <span class="lbl" id="{uid}-lbl">{label}</span>
  <div class="opts" role="radiogroup" aria-labelledby="{uid}-lbl" tabindex="-1" {onkeydown}>
    {#each THEMES as t (t.id)}
      <button
        type="button"
        role="radio"
        class="opt"
        data-id={t.id}
        aria-checked={value === t.id}
        tabindex={value === t.id ? 0 : -1}
        onclick={() => pick(t.id)}
      >
        <span class="chip" {...themeAttributes(t.id)} aria-hidden="true">
          <span class="fg">Aa</span><span class="accent"></span>
        </span>
        <span class="name">{t.label}</span>
      </button>
    {/each}
  </div>
</div>

<style lang="scss">
  .picker {
    display: grid;
    gap: var(--ss-s-2);
  }
  .lbl {
    font-size: var(--ss-size-sm);
    color: var(--ss-fg-muted);
  }
  .opts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: var(--ss-s-2);
  }
  .opt {
    display: grid;
    gap: var(--ss-s-1);
    padding: var(--ss-s-1);
    border: 1px solid var(--ss-line);
    background: transparent;
    color: var(--ss-fg);
    font: inherit;
    font-size: var(--ss-size-sm);
    cursor: pointer;
    text-align: start;
    &:hover {
      border-color: var(--ss-line-strong);
    }
    &[aria-checked='true'] {
      border-color: var(--ss-primary);
      box-shadow: inset 0 0 0 1px var(--ss-primary);
    }
    &:focus-visible {
      outline: 2px solid var(--ss-primary);
      outline-offset: 2px;
    }
  }
  .chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    block-size: 36px;
    padding-inline: var(--ss-s-2);
    background: var(--ss-bg);
    border: 1px solid var(--ss-line);
  }
  .fg {
    color: var(--ss-fg);
    font-family: var(--ss-font-display);
  }
  .accent {
    inline-size: 14px;
    block-size: 14px;
    background: var(--ss-primary);
  }
  .name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
