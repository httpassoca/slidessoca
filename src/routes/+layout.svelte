<script lang="ts">
  import 'dssoca/theme.css'
  import { Toaster } from 'dssoca'
  import { presetCss } from '$lib/themes'

  let { children } = $props()
</script>

<svelte:head>
  {@html `<style>${presetCss}</style>`}
</svelte:head>

{@render children()}
<Toaster />
