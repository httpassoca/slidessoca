<!--
  Letterboxes its child (a 16:9 SlideView) into whatever box it is given — portrait phone,
  landscape phone, desktop, fullscreen. Pure CSS: the stage is a size container and the frame
  is min(container width, container height × 16/9) wide.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Attachment } from 'svelte/attachments'

  interface Props {
    children: Snippet
    /** Optional attachment (gestures) on the stage area. */
    attach?: Attachment<HTMLElement>
    class?: string
  }

  let { children, attach, class: cls = '' }: Props = $props()
  const noop: Attachment<HTMLElement> = () => {}
</script>

<div class="stage {cls}" {@attach attach ?? noop}>
  <div class="frame">{@render children()}</div>
</div>

<style lang="scss">
  .stage {
    container-type: size;
    display: grid;
    place-items: center;
    inline-size: 100%;
    block-size: 100%;
    min-block-size: 0;
    min-inline-size: 0;
    overflow: hidden;
    touch-action: pan-y pinch-zoom;
  }
  .frame {
    inline-size: min(100cqi, calc(100cqb * 16 / 9));
    box-shadow: var(--ss-shadow-1);
  }
</style>
