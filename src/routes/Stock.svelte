<script>
  import { onMount } from "svelte";
  import { fade, slide } from "svelte/transition";
  import { api } from "../lib/api.js";
  import { formatDate } from "../lib/utils.js";
  import { readCache, writeCache } from "../lib/cache.js";
  import Spinner from "../lib/components/Spinner.svelte";
  import { currentUser, isAdmin } from "../lib/store.js";

  let stocks = [];
  let isLoading = true;
  let showAddForm = false;
  let isSubmitting = false;

  // New Stock Form
  let newStock = {
    date: formatDate(new Date()),
    name: "삼성전자",
    price: "",
    currency: "KRW",
    quantity: "1",
  };

  const FAMILY_MEMBERS = ["아빠", "엄마", "현구", "범수"];
  let contributions = {
    아빠: 0,
    엄마: 0,
    현구: 0,
    범수: 0,
  };

  // Selected preset payer mode: 'mom' | 'bum' | 'half' | 'all' | 'custom'
  let payerMode = "half";

  // Round to whole KRW so fractional quantities can't leave an unmatchable
  // float remainder that locks the submit button
  $: calculatedTotal = Math.round(
    (parseInt(newStock.price) || 0) * (parseFloat(newStock.quantity) || 0),
  );

  $: totalContributed = Object.values(contributions).reduce(
    (a, b) => a + (parseInt(b) || 0),
    0,
  );
  $: remainToFill = calculatedTotal - totalContributed;

  // Automatically update contributions when payerMode or calculatedTotal changes
  function applyPayerMode(mode) {
    payerMode = mode;
    FAMILY_MEMBERS.forEach((m) => (contributions[m] = 0));

    if (calculatedTotal <= 0) return;

    if (mode === "mom") {
      contributions["엄마"] = calculatedTotal;
    } else if (mode === "bum") {
      contributions["범수"] = calculatedTotal;
    } else if (mode === "half") {
      const half = Math.floor(calculatedTotal / 2);
      contributions["엄마"] = half;
      contributions["범수"] = calculatedTotal - half;
    } else if (mode === "all") {
      const quarter = Math.floor(calculatedTotal / 4);
      const rem = calculatedTotal - quarter * 4;
      contributions["아빠"] = quarter;
      contributions["엄마"] = quarter + rem;
      contributions["현구"] = quarter;
      contributions["범수"] = quarter;
    }
  }

  // Reactive auto-sync when calculated total changes in non-custom mode
  $: if (payerMode !== "custom" && calculatedTotal > 0) {
    applyPayerMode(payerMode);
  }

  function addQuantity(q) {
    const current = parseFloat(newStock.quantity) || 0;
    newStock.quantity = String(current + q);
  }

  async function loadStocks() {
    const cached = readCache("stocks");
    if (cached) {
      stocks = cached;
      isLoading = false;
    } else {
      isLoading = true;
    }

    const res = await api.getStocks();
    if (res.success) {
      stocks = res.stocks;
      writeCache("stocks", stocks);
    } else if (!cached) {
      alert("데이터 불러오기 실패");
    }
    isLoading = false;
  }

  async function handleSubmit() {
    if (!newStock.name || !newStock.price || !newStock.quantity)
      return alert("종목명, 단가, 수량을 모두 입력해주세요.");

    if (totalContributed !== calculatedTotal)
      return alert(
        `총 매입액(${calculatedTotal.toLocaleString()}원)과 분배금액(${totalContributed.toLocaleString()}원)을 맞춰주세요.`,
      );

    isSubmitting = true;

    const items = [];
    const price = parseInt(newStock.price);

    for (const [owner, amount] of Object.entries(contributions)) {
      if (amount > 0) {
        const quantity = Number((amount / price).toFixed(6));
        items.push({
          date: newStock.date,
          stock_name: newStock.name,
          price: price,
          quantity: quantity,
          owner: owner,
          currency: newStock.currency,
          memo: `투자금: ${amount.toLocaleString()}원`,
        });
      }
    }

    const res = await api.batchAddStock(items);
    if (res.success) {
      alert("성공적으로 저장되었습니다! 📈");
      showAddForm = false;
      resetForm();
      loadStocks();
    } else {
      alert("저장 실패: " + res.message);
    }
    isSubmitting = false;
  }

  function resetForm() {
    newStock = {
      date: formatDate(new Date()),
      name: "삼성전자",
      price: "",
      currency: "KRW",
      quantity: "1",
    };
    payerMode = "half";
    contributions = { 아빠: 0, 엄마: 0, 현구: 0, 범수: 0 };
  }

  async function deleteStock(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await api.deleteStock(id);
    if (res.success) loadStocks();
  }

  onMount(loadStocks);

  $: summaryByStock = Object.values(
    stocks.reduce((acc, item) => {
      if (!acc[item.stock_name])
        acc[item.stock_name] = {
          name: item.stock_name,
          quantity: 0,
          total_price: 0,
          count: 0,
          owners: {},
        };
      acc[item.stock_name].quantity += Number(item.quantity);
      acc[item.stock_name].total_price +=
        Number(item.price) * Number(item.quantity);
      acc[item.stock_name].count++;

      if (!acc[item.stock_name].owners[item.owner])
        acc[item.stock_name].owners[item.owner] = 0;
      acc[item.stock_name].owners[item.owner] += Number(item.quantity);

      return acc;
    }, {}),
  );

  $: totalPortfolioValue = summaryByStock.reduce(
    (sum, item) => sum + (item.total_price || 0),
    0,
  );

  const MEMBER_COLORS = {
    아빠: "bg-blue-500",
    엄마: "bg-pink-500",
    현구: "bg-indigo-500",
    범수: "bg-amber-500",
  };

  const POPULAR_STOCKS = [
    { name: "삼성전자", emoji: "📱" },
    { name: "현대차", emoji: "🚗" },
    { name: "갤럭시아머니트리", emoji: "🌲" },
    { name: "슈프리마에이치큐", emoji: "🛡️" },
  ];

</script>

<div class="space-y-6 max-w-md mx-auto">
  <!-- Header Card -->
  <header
    class="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 to-teal-700 p-7 text-white shadow-xl"
  >
    <div class="relative z-10 space-y-2">
      <div class="flex justify-between items-center">
        <span class="text-emerald-200 font-bold text-xs tracking-widest uppercase">
          Family Portfolio
        </span>
        <span class="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
          총 {summaryByStock.length}개 종목
        </span>
      </div>
      <h1 class="text-3xl font-black tracking-tight leading-tight">
        우리 가족 주식 📈
      </h1>
      <div class="pt-2 border-t border-white/20 flex justify-between items-baseline">
        <span class="text-xs text-emerald-100 font-medium">총 매입 원금</span>
        <span class="text-2xl font-black text-amber-300">
          {totalPortfolioValue.toLocaleString()}<span class="text-sm text-white font-bold">원</span>
        </span>
      </div>
    </div>
    <!-- Decor -->
    <div class="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
    <div class="absolute -left-8 -bottom-8 w-32 h-32 bg-teal-400/20 rounded-full blur-2xl"></div>
  </header>

  <!-- Big Friendly Action Toggle Button -->
  <button
    on:click={() => (showAddForm = !showAddForm)}
    class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 font-black text-base"
  >
    <span>{showAddForm ? "📋 보유 주식 목록 보기" : "➕ 새 주식 샀어요! (간편 입력)"}</span>
  </button>

  {#if showAddForm}
    <!-- Parent-Friendly Ultra Simple Stock Form -->
    <div
      transition:slide
      class="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6"
    >
      <div class="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-700">
        <h2 class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
          <span>📝</span> 주식 매입 기록
        </h2>
        <span class="text-xs text-emerald-600 dark:text-emerald-400 font-bold">쉬운 3단계 입력</span>
      </div>

      <!-- STEP 1: 종목 선택 -->
      <div class="space-y-2">
        <div class="flex items-center gap-1.5">
          <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center">1</span>
          <span class="text-xs font-black text-gray-800 dark:text-gray-200">어떤 주식을 사셨나요?</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          {#each POPULAR_STOCKS as stock}
            <button
              type="button"
              on:click={() => (newStock.name = stock.name)}
              class="p-3 rounded-2xl flex items-center justify-center gap-2 transition-all border {newStock.name === stock.name
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500 font-black shadow-sm'
                : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold'}"
            >
              <span class="text-xl leading-none">{stock.emoji}</span>
              <span class="text-xs truncate">{stock.name}</span>
            </button>
          {/each}
        </div>


        <input
          type="text"
          bind:value={newStock.name}
          placeholder="목록에 없는 경우 직접 입력"
          class="w-full p-3 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 border border-gray-200 dark:border-gray-700"
        />
      </div>

      <!-- STEP 2: 단가 및 수량 입력 -->
      <div class="space-y-3">
        <div class="flex items-center gap-1.5">
          <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center">2</span>
          <span class="text-xs font-black text-gray-800 dark:text-gray-200">얼마에 몇 주 사셨나요?</span>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="p-stock-price" class="block text-[11px] font-bold text-gray-400 mb-1 ml-1">
              1주당 가격 (단가)
            </label>
            <div class="relative">
              <input
                id="p-stock-price"
                type="number"
                bind:value={newStock.price}
                placeholder="예: 70000"
                class="w-full p-3.5 pr-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl font-black text-base outline-none focus:ring-2 focus:ring-emerald-500 border border-gray-200 dark:border-gray-700"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">원</span>
            </div>
          </div>

          <div>
            <label for="p-stock-qty" class="block text-[11px] font-bold text-gray-400 mb-1 ml-1">
              매입 수량
            </label>
            <div class="relative">
              <input
                id="p-stock-qty"
                type="number"
                bind:value={newStock.quantity}
                placeholder="1"
                class="w-full p-3.5 pr-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl font-black text-base outline-none focus:ring-2 focus:ring-emerald-500 border border-gray-200 dark:border-gray-700 text-center"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">주</span>
            </div>
          </div>
        </div>

        <!-- Quick Quantity Buttons -->
        <div class="flex gap-1.5 justify-end">
          <button
            type="button"
            on:click={() => addQuantity(1)}
            class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95"
          >
            +1주
          </button>
          <button
            type="button"
            on:click={() => addQuantity(5)}
            class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95"
          >
            +5주
          </button>
          <button
            type="button"
            on:click={() => addQuantity(10)}
            class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95"
          >
            +10주
          </button>
          <button
            type="button"
            on:click={() => addQuantity(50)}
            class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95"
          >
            +50주
          </button>
        </div>

        <!-- Big Total Summary Box -->
        {#if calculatedTotal > 0}
          <div class="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex justify-between items-center">
            <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300">총 결제 금액</span>
            <span class="text-xl font-black text-emerald-700 dark:text-emerald-400">
              {calculatedTotal.toLocaleString()}원
            </span>
          </div>
        {/if}
      </div>

      <!-- STEP 3: 누구 돈으로 샀나요? (초간단 버튼) -->
      <div class="space-y-3">
        <div class="flex items-center gap-1.5">
          <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center">3</span>
          <span class="text-xs font-black text-gray-800 dark:text-gray-200">누구 돈으로 샀나요? (클릭 한 번으로 선택)</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            on:click={() => applyPayerMode("mom")}
            class="p-3.5 rounded-2xl text-left border transition-all {payerMode === 'mom'
              ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-500 text-pink-700 dark:text-pink-300 ring-2 ring-pink-500 font-black'
              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold'}"
          >
            <span class="text-base block mb-0.5">👩 엄마 100%</span>
            <span class="text-[10px] text-gray-400 font-normal">엄마 혼자 전액 부담</span>
          </button>

          <button
            type="button"
            on:click={() => applyPayerMode("bum")}
            class="p-3.5 rounded-2xl text-left border transition-all {payerMode === 'bum'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500 font-black'
              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold'}"
          >
            <span class="text-base block mb-0.5">👦 범수 100%</span>
            <span class="text-[10px] text-gray-400 font-normal">범수 혼자 전액 부담</span>
          </button>

          <button
            type="button"
            on:click={() => applyPayerMode("half")}
            class="p-3.5 rounded-2xl text-left border transition-all {payerMode === 'half'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500 font-black'
              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold'}"
          >
            <span class="text-base block mb-0.5">⚖️ 엄마 & 범수 반반</span>
            <span class="text-[10px] text-gray-400 font-normal">5:5 정확히 반반</span>
          </button>

          <button
            type="button"
            on:click={() => applyPayerMode("all")}
            class="p-3.5 rounded-2xl text-left border transition-all {payerMode === 'all'
              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500 font-black'
              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold'}"
          >
            <span class="text-base block mb-0.5">👨‍👩‍👧‍👦 4명 모두 똑같이</span>
            <span class="text-[10px] text-gray-400 font-normal">1/N 균등 분할</span>
          </button>
        </div>

        <!-- Custom Mode Toggle -->
        <button
          type="button"
          on:click={() => (payerMode = "custom")}
          class="w-full py-2 text-center text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          {payerMode === "custom" ? "▼ 직접 금액 입력 중" : "직접 금액을 따로 지정할래요"}
        </button>

        {#if payerMode === "custom"}
          <div transition:slide class="space-y-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
            {#each FAMILY_MEMBERS as mem}
              <div class="flex items-center gap-2">
                <span class="w-12 text-xs font-bold text-gray-700 dark:text-gray-300">{mem}</span>
                <div class="flex-1 relative">
                  <input
                    type="number"
                    bind:value={contributions[mem]}
                    placeholder="0"
                    class="w-full p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-xs font-bold text-right pr-8 outline-none border border-gray-200 dark:border-gray-700"
                  />
                  <span class="absolute right-2.5 top-2 text-[10px] text-gray-400">원</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Save Button -->
      <button
        type="button"
        on:click={handleSubmit}
        disabled={isSubmitting || calculatedTotal <= 0}
        class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base shadow-lg active:scale-95 transition-all disabled:opacity-40"
      >
        {isSubmitting ? "저장 중..." : "✨ 주식 매입 완료 저장하기"}
      </button>
    </div>
  {:else}
    <!-- Summary List Cards -->
    <div class="space-y-4">
      {#if isLoading}
        <div class="py-16 text-center">
          <Spinner label="주식 데이터를 불러오는 중..." />
        </div>
      {:else if stocks.length === 0}
        <div class="text-center py-16 bg-white dark:bg-gray-800 rounded-3xl p-6 text-gray-400 shadow-sm border border-gray-100 dark:border-gray-700">
          <span class="text-4xl block mb-2">📈</span>
          <p class="text-sm font-bold text-gray-600 dark:text-gray-300">아직 등록된 주식이 없습니다.</p>
          <p class="text-xs text-gray-400 mt-1">상단의 '+ 새 주식 샀어요!' 버튼을 눌러 첫 투자를 기록해보세요!</p>
        </div>
      {:else}
        {#each summaryByStock as item}
          <div class="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <!-- Title & Price -->
            <div class="flex justify-between items-start">
              <div>
                <h3 class="text-xl font-black text-gray-900 dark:text-white">
                  {item.name}
                </h3>
                <p class="text-xs font-bold text-gray-400 mt-0.5">
                  평단가 약 {Math.round(item.total_price / item.quantity).toLocaleString()}원
                </p>
              </div>
              <div class="text-right">
                <span class="block text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {item.quantity.toFixed(2)}주
                </span>
                <span class="text-xs font-bold text-gray-400">
                  총 {item.total_price.toLocaleString()}원
                </span>
              </div>
            </div>

            <!-- Ownership Progress Bar -->
            <div class="h-3 bg-gray-100 dark:bg-gray-700 rounded-full flex overflow-hidden">
              {#each Object.entries(item.owners) as [owner, qty]}
                {#if qty > 0}
                  <div
                    class={MEMBER_COLORS[owner] || "bg-gray-400"}
                    style="width: {(qty / item.quantity) * 100}%"
                    title="{owner}: {((qty / item.quantity) * 100).toFixed(1)}%"
                  ></div>
                {/if}
              {/each}
            </div>

            <!-- Ownership Badges -->
            <div class="flex flex-wrap gap-2">
              {#each Object.entries(item.owners) as [owner, qty]}
                {#if qty > 0}
                  {@const pct = ((qty / item.quantity) * 100).toFixed(0)}
                  <div class="flex items-center gap-1.5 text-xs font-bold bg-gray-50 dark:bg-gray-700/50 px-2.5 py-1 rounded-xl">
                    <span class="w-2 h-2 rounded-full {MEMBER_COLORS[owner] || 'bg-gray-400'}"></span>
                    <span class="text-gray-700 dark:text-gray-300">{owner}</span>
                    <span class="text-gray-400 font-normal">{qty.toFixed(2)}주 ({pct}%)</span>
                  </div>
                {/if}
              {/each}
            </div>

            <!-- Collapsible History -->
            <details class="group pt-2 border-t border-gray-100 dark:border-gray-700">
              <summary class="flex justify-between items-center text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer select-none py-1">
                <span>🕒 매입 상세 내역 ({item.count}건)</span>
                <span class="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div class="space-y-2 mt-3 pt-1">
                {#each stocks.filter((s) => s.stock_name === item.name) as stock}
                  <div class="flex justify-between items-center text-xs p-3 bg-gray-50 dark:bg-gray-700/40 rounded-2xl">
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full {MEMBER_COLORS[stock.owner] || 'bg-gray-400'}"></span>
                      <div>
                        <p class="font-bold text-gray-800 dark:text-gray-200">{stock.owner}</p>
                        <p class="text-[10px] text-gray-400">{stock.date}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-3">
                      <div class="text-right">
                        <p class="font-bold text-gray-900 dark:text-white">
                          {Number(stock.quantity).toFixed(2)}주
                        </p>
                        <p class="text-[10px] text-gray-400">
                          @{Number(stock.price).toLocaleString()}원
                        </p>
                      </div>
                      {#if $isAdmin}
                        <button
                          type="button"
                          on:click={() => deleteStock(stock.id)}
                          class="p-1.5 text-gray-400 hover:text-rose-500 transition-colors"
                          title="삭제하기"
                        >
                          🗑️
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </details>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
