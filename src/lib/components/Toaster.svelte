<script>
  import { fly, fade } from "svelte/transition";
  import { toasts } from "../feedback.js";

  const COLORS = {
    success: "bg-emerald-500",
    error: "bg-rose-500",
    info: "bg-gray-900 dark:bg-gray-700",
  };
</script>

<div
  class="fixed inset-x-0 z-[400] flex flex-col items-center gap-2 px-4 pointer-events-none"
  style="top: max(1rem, env(safe-area-inset-top));"
  role="status"
  aria-live="polite"
>
  {#each $toasts as t (t.id)}
    <div
      class="max-w-md px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm text-white text-center whitespace-pre-line {COLORS[t.type]}"
      in:fly={{ y: -20, duration: 250 }}
      out:fade={{ duration: 150 }}
    >
      {t.message}
    </div>
  {/each}
</div>
