<!-- A row of colour-token swatches, painted in the deck's theme so they match the slide. -->
<script lang="ts">
  import { COLOR_VAR } from '$lib/deck/render'
  import type { ColorToken } from '$lib/deck/types'
  import { themeAttributes, type ThemeId } from '$lib/themes'

  type V = ColorToken | 'none'
  interface Props {
    label: string
    value: V
    options: readonly V[]
    theme: ThemeId
    onpick: (v: V) => void
  }
  let { label, value, options, theme, onpick }: Props = $props()
  const uid = $props.id()

  const NAMES: Record<V, string> = {
    fg: 'Text',
    muted: 'Muted',
    accent: 'Accent',
    bg: 'Background',
    surface: 'Surface',
    success: 'Green',
    warning: 'Yellow',
    danger: 'Red',
    info: 'Blue',
    none: 'None',
  }
</script>

<div class="field">
  <span class="label" id="{uid}-l">{label}</span>
  <div class="row" role="group" aria-labelledby="{uid}-l" {...themeAttributes(theme)}>
    {#each options as o (o)}
      <button
        type="button"
        aria-pressed={value === o}
        aria-label={NAMES[o]}
        title={NAMES[o]}
        class:none={o === 'none'}
        style={o === 'none' ? '' : `--c:${COLOR_VAR[o]}`}
        onclick={() => onpick(o)}
      ></button>
    {/each}
  </div>
</div>

<style lang="scss">
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--ss-s-1);
  }
  .label {
    font-size: var(--ss-size-sm);
    color: var(--ss-fg-muted);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ss-s-1);
    padding: var(--ss-s-1);
    background: var(--ss-bg);
    border: 1px solid var(--ss-line);
  }
  button {
    inline-size: 28px;
    block-size: 28px;
    padding: 0;
    border: 1px solid var(--ss-line-strong);
    border-radius: 0;
    background: var(--c);
    cursor: pointer;
    &.none {
      background: linear-gradient(
        to top right,
        transparent calc(50% - 1px),
        var(--ss-danger) 50%,
        transparent calc(50% + 1px)
      );
    }
    &[aria-pressed='true'] {
      outline: 2px solid var(--ss-primary);
      outline-offset: 2px;
    }
    &:focus-visible {
      outline: 2px solid var(--ss-fg);
      outline-offset: 2px;
    }
  }
</style>
