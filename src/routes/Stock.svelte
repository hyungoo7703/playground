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
    name: "",
    price: "",
    currency: "KRW",
    quantity: "",
  };

  const FAMILY_MEMBERS = ["아빠", "엄마", "현구", "범수"];
  let contributions = {
    아빠: 0,
    엄마: 0,
    현구: 0,
    범수: 0,
  };

  $: totalContributed = Object.values(contributions).reduce(
    (a, b) => a + (parseInt(b) || 0),
    0,
  );
  $: calculatedTotal =
    (parseInt(newStock.price) || 0) * (parseFloat(newStock.quantity) || 0);
  $: remainToFill = calculatedTotal - totalContributed;

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

  function handleAutoFill(who) {
    if (remainToFill > 0) {
      contributions[who] = (parseInt(contributions[who]) || 0) + remainToFill;
    }
  }

  function handleEqualSplit(activeMembers = ["엄마", "범수"]) {
    if (calculatedTotal > 0 && activeMembers.length > 0) {
      const splitAmount = Math.floor(calculatedTotal / activeMembers.length);
      const remainder = calculatedTotal - splitAmount * activeMembers.length;
      FAMILY_MEMBERS.forEach((m) => (contributions[m] = 0));
      activeMembers.forEach((m, idx) => {
        contributions[m] = splitAmount + (idx === 0 ? remainder : 0);
      });
    }
  }

  function handleFullAmount(who) {
    if (calculatedTotal > 0) {
      FAMILY_MEMBERS.forEach((m) => (contributions[m] = 0));
      contributions[who] = calculatedTotal;
    }
  }

  async function handleSubmit() {
    if (!newStock.name || !newStock.price || !newStock.quantity)
      return alert("필수 정보를 모두 입력해주세요.");

    if (totalContributed !== calculatedTotal)
      return alert(
        `총 매입액(${calculatedTotal.toLocaleString()}원)과 분배금액 합계(${totalContributed.toLocaleString()}원)가 일치하지 않습니다.`,
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
      name: "",
      price: "",
      currency: "KRW",
      quantity: "",
    };
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
    "삼성전자",
    "현대차",
    "SK하이닉스",
    "NAVER",
    "카카오",
    "맥쿼리인프라",
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

  <!-- Action Toggle Button -->
  <button
    on:click={() => (showAddForm = !showAddForm)}
    class="w-full py-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-emerald-600 dark:text-emerald-400 font-black text-sm border border-gray-100 dark:border-gray-700 active:scale-95 transition-all flex items-center justify-center gap-2"
  >
    <span>{showAddForm ? "📋 보유 주식 목록 보기" : "➕ 새 주식 매입 기록하기"}</span>
  </button>

  {#if showAddForm}
    <!-- Input Form -->
    <div
      transition:slide
      class="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-5"
    >
      <h2 class="text-lg font-black text-gray-900 dark:text-white">
        📝 매입 정보 입력
      </h2>

      <!-- Date & Name -->
      <div class="space-y-4">
        <div>
          <label for="stock-date" class="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1 ml-1">
            매입 일자
          </label>
          <input
            id="stock-date"
            type="date"
            bind:value={newStock.date}
            class="w-full p-3.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 border border-gray-200 dark:border-gray-700 transition-all"
          />
        </div>

        <div>
          <label for="stock-name" class="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1 ml-1">
            종목명
          </label>
          <input
            id="stock-name"
            type="text"
            bind:value={newStock.name}
            placeholder="주식명 입력 또는 아래 추천 선택"
            class="w-full p-3.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 border border-gray-200 dark:border-gray-700 transition-all"
          />
          <!-- Chips -->
          <div class="flex gap-1.5 mt-2 flex-wrap">
            {#each POPULAR_STOCKS as stockName}
              <button
                type="button"
                on:click={() => (newStock.name = stockName)}
                class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 transition-colors"
              >
                {stockName}
              </button>
            {/each}
          </div>
        </div>

        <!-- Price & Quantity -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="stock-price" class="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1 ml-1">
              1주당 가격 (단가)
            </label>
            <input
              id="stock-price"
              type="number"
              bind:value={newStock.price}
              placeholder="0"
              class="w-full p-3.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 border border-gray-200 dark:border-gray-700"
            />
            {#if newStock.price}
              <p class="text-right mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {Number(newStock.price).toLocaleString()}원
              </p>
            {/if}
          </div>

          <div>
            <label for="stock-quantity" class="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1 ml-1">
              매입 수량
            </label>
            <input
              id="stock-quantity"
              type="number"
              bind:value={newStock.quantity}
              placeholder="0"
              class="w-full p-3.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 border border-gray-200 dark:border-gray-700"
            />
            {#if newStock.quantity}
              <p class="text-right mt-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                총 {Number(newStock.quantity).toLocaleString()}주
              </p>
            {/if}
          </div>
        </div>

        <!-- Calculated Total Banner -->
        {#if newStock.price && newStock.quantity}
          <div
            in:fade
            class="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl flex justify-between items-center border border-emerald-200 dark:border-emerald-800"
          >
            <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300">총 매입액</span>
            <span class="text-lg font-black text-emerald-700 dark:text-emerald-400">
              {(newStock.price * newStock.quantity).toLocaleString()}원
            </span>
          </div>
        {/if}

        <div class="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>

        <!-- Distribution by Family Members -->
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <h3 class="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
              💰 투자자별 분배 금액
            </h3>
            <span
              class="text-xs font-bold px-2 py-0.5 rounded-full {remainToFill === 0
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}"
            >
              {remainToFill === 0 ? "금액 일치 ✨" : `${remainToFill.toLocaleString()}원 남음`}
            </span>
          </div>

          <!-- Quick Split Shortcuts -->
          {#if calculatedTotal > 0}
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                on:click={() => handleEqualSplit(["엄마", "범수"])}
                class="py-2 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl active:scale-95 transition-all border border-emerald-200 dark:border-emerald-800"
              >
                엄마+범수 5:5 분배
              </button>
              <button
                type="button"
                on:click={() => handleEqualSplit(FAMILY_MEMBERS)}
                class="py-2 px-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl active:scale-95 transition-all border border-indigo-200 dark:border-indigo-800"
              >
                4인 균등 분배 (1/N)
              </button>
            </div>
          {/if}

          <!-- Member Inputs -->
          <div class="space-y-2">
            {#each FAMILY_MEMBERS as mem}
              <div class="flex items-center gap-2">
                <div class="w-12 text-xs font-bold text-gray-700 dark:text-gray-300">
                  {mem}
                </div>
                <div class="flex-1 relative">
                  <input
                    type="number"
                    bind:value={contributions[mem]}
                    placeholder="0"
                    class="w-full p-2.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-right pr-9 border border-gray-200 dark:border-gray-700 transition-all {contributions[mem] > 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}"
                  />
                  <span class="absolute right-3 top-2.5 text-[10px] text-gray-400 font-bold">원</span>
                </div>
                <button
                  type="button"
                  on:click={() => handleFullAmount(mem)}
                  disabled={calculatedTotal <= 0}
                  class="px-2.5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold active:scale-95 transition-all disabled:opacity-30"
                >
                  전액
                </button>
                <button
                  type="button"
                  on:click={() => handleAutoFill(mem)}
                  disabled={remainToFill <= 0}
                  class="px-2.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 rounded-xl text-xs font-bold active:scale-95 transition-all disabled:opacity-30 border border-emerald-200 dark:border-emerald-800"
                >
                  나머지
                </button>
              </div>
            {/each}
          </div>
        </div>

        <!-- Submit Button -->
        <button
          on:click={handleSubmit}
          disabled={isSubmitting || remainToFill !== 0}
          class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-md active:scale-95 transition-all disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:shadow-none"
        >
          {isSubmitting ? "저장 중..." : "매입 내역 저장하기"}
        </button>
      </div>
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
          <p class="text-xs text-gray-400 mt-1">상단의 '+ 새 주식 매입 기록하기'로 첫 투자를 남겨보세요!</p>
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
                  <div class="flex justify-between items-center text-xs p-3 bg-gray-50 dark:bg-gray-750 dark:bg-gray-700/40 rounded-2xl">
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
