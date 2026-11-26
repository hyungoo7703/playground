<script>
  import { navigate } from "svelte-routing";
  import { base } from "../store.js";

  let className = "bg-white/10 text-gray-300 hover:text-white border border-white/15";
  export { className as class };

  // Leaving is a step back, so that the back button does not lead into the game again.
  // A game opened by its address has nothing behind it: there the menu takes its place.
  function leave() {
    if (history.state?.key) history.back();
    else navigate(`${base}/menu`, { replace: true });
  }
</script>

<button
  type="button"
  on:click={leave}
  aria-label="게임 나가기"
  class="w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-base font-bold backdrop-blur-md active:scale-90 transition-all {className}"
>
  ✕
</button>
