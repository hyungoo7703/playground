<script>
  // Shown in place of a list that could not be loaded and has no saved copy to fall
  // back on, so a failed load is never mistaken for "there is nothing here".
  import { createEventDispatcher } from "svelte";

  export let message; // e.g. "장부를 불러오지 못했습니다."

  const dispatch = createEventDispatcher();
</script>

<div
  class="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center shadow-sm border border-rose-100 dark:border-rose-900/50"
>
  <span class="text-4xl block mb-2">📡</span>
  <p class="text-sm font-bold text-gray-700 dark:text-gray-200">{message}</p>
  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
    데이터가 지워진 것이 아니에요. 연결을 확인하고 다시 시도해주세요.
  </p>
  <button
    type="button"
    on:click={() => dispatch("retry")}
    class="mt-4 px-5 py-3 rounded-2xl text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all"
  >
    다시 시도
  </button>
</div>
