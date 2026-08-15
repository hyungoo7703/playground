<script>
  import { fade } from "svelte/transition";

  let amount = "";
  let calculated = 0;
  let copied = false;

  $: calculated = Math.floor((parseFloat(amount) || 0) * 0.15);

  function formatNumber(num) {
    return (num || 0).toLocaleString();
  }

  function addAmount(val) {
    const current = parseFloat(amount) || 0;
    amount = String(current + val);
  }

  function resetAmount() {
    amount = "";
  }

  async function copyToClipboard() {
    if (!calculated) return;
    try {
      await navigator.clipboard.writeText(calculated.toString());
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (err) {
      alert("복사 실패: " + err);
    }
  }
</script>

<div class="max-w-md mx-auto space-y-6">
  <!-- Header -->
  <div class="text-left space-y-1">
    <h2 class="text-2xl font-black text-gray-900 dark:text-white">15% 계산기 🧮</h2>
    <p class="text-xs font-bold text-gray-400 dark:text-gray-500">
      입력한 금액의 15%를 즉시 계산합니다.
    </p>
  </div>

  <!-- Input Section -->
  <div class="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
    <label for="calc-amount" class="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
      계산할 금액
    </label>
    <div class="relative">
      <input
        id="calc-amount"
        type="number"
        bind:value={amount}
        placeholder="0"
        class="w-full p-4 pr-12 bg-gray-50 dark:bg-gray-900 rounded-2xl text-2xl font-black text-right outline-none ring-2 ring-transparent focus:ring-indigo-500 text-gray-900 dark:text-white transition-all"
      />
      <span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">원</span>
    </div>

    <!-- Quick Add Buttons -->
    <div class="flex flex-wrap gap-1.5 pt-1">
      <button
        type="button"
        on:click={() => addAmount(10000)}
        class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95 transition-all"
      >
        +1만
      </button>
      <button
        type="button"
        on:click={() => addAmount(50000)}
        class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95 transition-all"
      >
        +5만
      </button>
      <button
        type="button"
        on:click={() => addAmount(100000)}
        class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95 transition-all"
      >
        +10만
      </button>
      <button
        type="button"
        on:click={() => addAmount(1000000)}
        class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95 transition-all"
      >
        +100만
      </button>
      <button
        type="button"
        on:click={resetAmount}
        class="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 font-bold rounded-xl text-xs active:scale-95 transition-all ml-auto"
      >
        초기화
      </button>
    </div>
  </div>

  <!-- Result Display Card -->
  <div class="w-full bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl p-8 text-center text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
    <!-- Background Decor -->
    <div class="absolute -right-8 -top-8 w-28 h-28 bg-white/10 rounded-full blur-xl"></div>
    <div class="absolute -left-8 -bottom-8 w-28 h-28 bg-purple-500/20 rounded-full blur-xl"></div>

    <p class="text-indigo-200 font-bold mb-1 text-xs uppercase tracking-widest">Calculated 15%</p>
    <div class="flex items-baseline justify-center gap-1.5">
      <h1 class="text-4xl font-black tracking-tight">{formatNumber(calculated)}</h1>
      <span class="text-lg font-bold text-indigo-200">원</span>
    </div>
  </div>

  <!-- Copy Button -->
  <button
    on:click={copyToClipboard}
    disabled={!calculated}
    class="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-40 disabled:active:scale-100 text-sm"
  >
    {#if copied}
      <span in:fade class="flex items-center gap-2 text-emerald-400 dark:text-emerald-600">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
        </svg>
        복사되었습니다!
      </span>
    {:else}
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
      </svg>
      <span>결과 복사하기</span>
    {/if}
  </button>
</div>
