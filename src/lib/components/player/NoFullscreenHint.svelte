<!--
  One-time hint for browsers without element fullscreen (iPhone Safari and friends): same
  capability check that hides the fullscreen button, never a user-agent sniff (SL-0010).
  The polite live region is always in the DOM, so the text is announced when it appears after
  mount. Closing remembers the dismissal (localStorage, failures ignored) and hands focus to
  `returnFocus` when the close button had it.
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { Button, Icon } from 'dssoca'
  import { PREFS, readPref, writePref } from '$lib/client/prefs'
  import { fullscreenSupported } from './fullscreen.svelte'
  import { icon } from './icons'

  interface Props {
    /** The player has a control bar the middle tap can hide. */
    chrome?: boolean
    /** Where focus goes after closing with the keyboard. */
    returnFocus?: () => HTMLElement | null | undefined
    /** Visually tucked away (the bar is hidden) without dismissing. */
    hidden?: boolean
  }

  let { chrome = true, returnFocus, hidden = false }: Props = $props()

  let show = $state(false)
  let box = $state<HTMLElement>()

  onMount(() => {
    show = !fullscreenSupported() && !readPref(PREFS.noFullscreenHint)
  })

  function close() {
    const hadFocus = !!box && box.contains(document.activeElement)
    writePref(PREFS.noFullscreenHint, new Date().toISOString())
    show = false
    if (hadFocus) returnFocus?.()?.focus()
  }
</script>

<div class="live" role="status" aria-live="polite">
  {#if show}
    <div class="hint" class:tucked={hidden} class:last={!chrome} bind:this={box}>
      <p>
        {#if chrome}
          Tap the middle of the slide to hide the controls. Fullscreen isn't available on this
          browser
        {:else}
          Fullscreen isn't available on this browser. Turn the phone sideways for a bigger slide
        {/if}
      </p>
      <Button variant="ghost" size="sm" iconOnly label="Dismiss hint" onclick={close}>
        <Icon name={icon('close')} />
      </Button>
    </div>
  {/if}
</div>

<style lang="scss">
  .live:empty {
    display: none;
  }
  .hint {
    display: flex;
    align-items: center;
    gap: var(--ss-s-2);
    padding: var(--ss-s-1) var(--ss-s-1) var(--ss-s-1) var(--ss-s-3);
    background: var(--ss-bg);
    border-block-start: 1px solid var(--ss-line);
    color: var(--ss-fg-muted);
    font-size: var(--ss-size-xs);
  }
  /* No bar under it: keep clear of the home indicator. */
  .last {
    padding-block-end: max(var(--ss-s-1), env(safe-area-inset-bottom));
  }
  .tucked {
    display: none;
  }
  p {
    flex: 1;
    min-inline-size: 0;
    margin: 0;
  }
</style>
