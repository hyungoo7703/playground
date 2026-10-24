<script context="module">
  // Shared across instances: nested modals lock scroll once and only the
  // topmost one reacts to Escape
  let depth = 0;
</script>

<script>
  import { onMount, createEventDispatcher } from "svelte";
  import { fade, fly } from "svelte/transition";

  export let label;
  export let z = "z-[60]";
  let className = "max-w-sm p-6 space-y-4";
  export { className as class };

  const dispatch = createEventDispatcher();
  let panel;
  let myDepth;

  onMount(() => {
    const prevFocus = document.activeElement;
    myDepth = ++depth;
    if (depth === 1) document.body.style.overflow = "hidden";
    panel.focus({ preventScroll: true });

    return () => {
      depth--;
      if (depth === 0) document.body.style.overflow = "";
      prevFocus?.focus?.({ preventScroll: true });
    };
  });

  function onKeydown(e) {
    if (e.key === "Escape" && myDepth === depth) dispatch("close");
  }
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="fixed inset-0 {z} flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
  on:click|self={() => dispatch("close")}
  transition:fade|global={{ duration: 150 }}
>
  <div
    bind:this={panel}
    role="dialog"
    aria-modal="true"
    aria-label={label}
    tabindex="-1"
    class="w-full max-h-[88dvh] overflow-y-auto overscroll-contain bg-white dark:bg-gray-800 rounded-3xl shadow-2xl relative outline-none {className}"
    transition:fly|global={{ y: 40, duration: 200 }}
  >
    <slot />
  </div>
</div>
