<script>
  import Modal from "./Modal.svelte";
  import { confirmState } from "../feedback.js";

  function close(result) {
    $confirmState?.resolve(result);
    confirmState.set(null);
  }
</script>

{#if $confirmState}
  <Modal
    label="확인"
    z="z-[300]"
    class="max-w-xs p-6 space-y-5"
    on:close={() => close(false)}
  >
    <p
      class="text-sm font-bold text-gray-800 dark:text-gray-100 whitespace-pre-line leading-relaxed"
    >
      {$confirmState.message}
    </p>
    <div class="flex gap-2">
      <button
        type="button"
        on:click={() => close(false)}
        class="flex-1 py-3 font-bold text-sm text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-2xl active:scale-95 transition-all"
      >
        취소
      </button>
      <button
        type="button"
        on:click={() => close(true)}
        class="flex-1 py-3 font-black text-sm text-white rounded-2xl shadow-md active:scale-95 transition-all {$confirmState.danger
          ? 'bg-rose-500'
          : 'bg-indigo-600'}"
      >
        {$confirmState.confirmText}
      </button>
    </div>
  </Modal>
{/if}
