<script lang="ts">
  import 'dssoca/theme.css'
  import { Toaster } from 'dssoca'
  import { deckTokenCss, presetCss } from '$lib/themes'

  let { children } = $props()
</script>

<svelte:head>
  {@html `<style>${presetCss}\n${deckTokenCss}</style>`}
</svelte:head>

{@render children()}
<Toaster />

<style>
  :global(body) {
    margin: 0;
  }
</style>
