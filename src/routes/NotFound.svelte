<script>
  import { navigate } from "svelte-routing";
  import { base } from "../lib/store.js";
</script>

<div class="flex flex-col items-center justify-center py-24 text-center space-y-4">
  <span class="text-5xl">🧭</span>
  <h2 class="text-xl font-black text-gray-800 dark:text-gray-200">
    페이지를 찾을 수 없어요
  </h2>
  <p class="text-sm text-gray-400 dark:text-gray-500">
    주소가 잘못되었거나 없어진 페이지예요.
  </p>
  <button
    on:click={() => navigate(base || "/", { replace: true })}
    class="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg"
  >
    🏠 홈으로 가기
  </button>
</div>
