<script>
    import { onMount } from "svelte";
    import { fade, slide } from "svelte/transition";
    import { api } from "../lib/api.js";
    import { formatDate } from "../lib/utils.js";
    import { readCache, writeCache } from "../lib/cache.js";
    import Spinner from "../lib/components/Spinner.svelte";
    import { navigate } from "svelte-routing";
    import { currentUser, isAdmin } from "../lib/store.js";

    let stocks = [];
    let isLoading = true;
    let showAddForm = false;
    let isSubmitting = false;

    // New Stock Form
    let newStock = {
        date: formatDate(new Date()),
        name: "",
        price: "", // Unit Price
        currency: "KRW",
        quantity: "", // Shares
    };

    // Contributors
    const FAMILY_MEMBERS = ["엄마", "범수"];
    let contributions = {
        엄마: 0,
        범수: 0,
    };

    // Derived: Total Contributed
    $: totalContributed = Object.values(contributions).reduce(
        (a, b) => a + (parseInt(b) || 0),
        0,
    );
    $: calculatedTotal =
        (parseInt(newStock.price) || 0) * (parseFloat(newStock.quantity) || 0);
    $: remainToFill = calculatedTotal - totalContributed;

    async function loadStocks() {
        // 캐시 먼저 그리고, 뒤에서 갱신 (SWR)
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
            contributions[who] =
                (parseInt(contributions[who]) || 0) + remainToFill;
        }
    }

    function handleHalfSplit() {
        if (calculatedTotal > 0) {
            const half = Math.floor(calculatedTotal / 2);
            contributions["엄마"] = half;
            contributions["범수"] = calculatedTotal - half;
        }
    }

    function handleFullAmount(who) {
        if (calculatedTotal > 0) {
            contributions = { 엄마: 0, 범수: 0 };
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

        // Prepare Batch Items
        const items = [];
        const price = parseInt(newStock.price);

        for (const [owner, amount] of Object.entries(contributions)) {
            if (amount > 0) {
                const quantity = Number((amount / price).toFixed(6)); // Calc quantity
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
        contributions = { 엄마: 0, 범수: 0 };
    }

    async function deleteStock(id) {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        const res = await api.deleteStock(id);
        if (res.success) loadStocks();
    }

    onMount(loadStocks);

    // Helper for summary
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

            // Calc ownership
            if (!acc[item.stock_name].owners[item.owner])
                acc[item.stock_name].owners[item.owner] = 0;
            acc[item.stock_name].owners[item.owner] += Number(item.quantity);

            return acc;
        }, {}),
    );

    const MEMBER_COLORS = {
        아빠: "bg-blue-500",
        엄마: "bg-pink-500",
        현구: "bg-indigo-500",
        범수: "bg-yellow-500",
    };
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
    <header
        class="bg-emerald-600 px-6 pt-12 pb-8 rounded-b-[2.5rem] shadow-lg mb-6 flex flex-col items-center text-center"
    >
        <h1 class="text-3xl font-black text-white mb-2">우리 가족 주식 📈</h1>
        <p class="text-emerald-100 font-bold text-sm opacity-80">
            티끌 모아 태산! 함께 부자 되자
        </p>
    </header>

    <main class="px-5 space-y-6">
        <!-- Action Button -->
        <button
            on:click={() => (showAddForm = !showAddForm)}
            class="w-full py-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-emerald-600 font-black text-lg border-2 border-emerald-100 dark:border-gray-700 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
            <span>{showAddForm ? "목록 보기" : "+ 주식 매입 기록하기"}</span>
        </button>

        {#if showAddForm}
            <div
                transition:slide
                class="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-xl border border-emerald-100 dark:border-gray-700 space-y-6"
            >
                <h2 class="text-xl font-black text-gray-900 dark:text-white">
                    📝 매입 정보 입력
                </h2>

                <!-- Basic Info -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2">
                        <label
                            for="stock-date"
                            class="block text-xs font-bold text-gray-400 mb-1 ml-1"
                            >매입 일자 (언제 샀나요?)</label
                        >
                        <input
                            id="stock-date"
                            type="date"
                            bind:value={newStock.date}
                            class="w-full p-4 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </div>
                    <div class="col-span-2">
                        <label
                            for="stock-name"
                            class="block text-xs font-bold text-gray-400 mb-1 ml-1"
                            >종목명 (어떤 주식인가요?)</label
                        >
                        <input
                            id="stock-name"
                            type="text"
                            bind:value={newStock.name}
                            placeholder="주식명 직접 입력 또는 아래에서 선택"
                            class="w-full p-4 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <!-- Popular Stocks Chips -->
                        <div class="flex gap-2 mt-2 flex-wrap">
                            {#each ["삼성전자", "현대차", "갤럭시아머니트리", "슈프리마에이치큐"] as stockName}
                                <button
                                    on:click={() => (newStock.name = stockName)}
                                    class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors shadow-sm"
                                >
                                    {stockName}
                                </button>
                            {/each}
                        </div>
                    </div>
                    <div>
                        <label
                            for="stock-price"
                            class="block text-xs font-bold text-gray-400 mb-1 ml-1"
                            >1주당 가격</label
                        >
                        <input
                            id="stock-price"
                            type="number"
                            bind:value={newStock.price}
                            placeholder="단가 입력"
                            class="w-full p-4 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {#if newStock.price}
                            <div class="text-right mt-1 mr-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                {Number(newStock.price).toLocaleString()}원
                            </div>
                        {/if}
                    </div>
                    <div>
                        <label
                            for="stock-quantity"
                            class="block text-xs font-bold text-gray-400 mb-1 ml-1"
                            >매입 수량</label
                        >
                        <input
                            id="stock-quantity"
                            type="number"
                            bind:value={newStock.quantity}
                            placeholder="수량 입력"
                            class="w-full p-4 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {#if newStock.quantity}
                            <div class="text-right mt-1 mr-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                                총 {Number(newStock.quantity).toLocaleString()}주
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- Calculated Total -->
                {#if newStock.price && newStock.quantity}
                    <div
                        class="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl flex justify-between items-center border border-gray-100 dark:border-gray-700"
                    >
                        <span
                            class="text-sm font-bold text-gray-500 dark:text-gray-400"
                            >총 매입액 (예상)</span
                        >
                        <span
                            class="text-xl font-black text-gray-900 dark:text-white"
                        >
                            {(
                                newStock.price * newStock.quantity
                            ).toLocaleString()}
                            <span class="text-sm font-normal text-gray-400"
                                >원</span
                            >
                        </span>
                    </div>
                {/if}

                <div class="h-px bg-gray-100 dark:bg-gray-700 my-2"></div>

                <!-- Distribution -->
                <div>
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-gray-900 dark:text-white">
                            💰 누구 돈으로 샀나요?
                        </h3>
                        <span
                            class="text-xs font-bold {remainToFill === 0
                                ? 'text-emerald-500'
                                : 'text-red-500'}"
                        >
                            {remainToFill === 0
                                ? "딱 맞습니다! 👍"
                                : `${remainToFill.toLocaleString()}원 남음`}
                        </span>
                    </div>

                    {#if calculatedTotal > 0}
                    <div class="flex gap-2 mb-4">
                        <button on:click={handleHalfSplit} class="flex-1 py-3 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-black rounded-xl active:scale-95 transition-all shadow-sm border border-emerald-200 dark:border-emerald-800">
                            ⚖️ 5:5 반반 나누기
                        </button>
                    </div>
                    {/if}

                    <div class="space-y-3">
                        {#each FAMILY_MEMBERS as mem}
                            <div class="flex items-center gap-2">
                                <div
                                    class="w-10 text-sm font-bold text-gray-600 dark:text-gray-300"
                                >
                                    {mem}
                                </div>
                                <div class="flex-1 relative">
                                    <input
                                        type="number"
                                        bind:value={contributions[mem]}
                                        placeholder="0"
                                        class="w-full p-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-right pr-12 transition-all {contributions[
                                            mem
                                        ] > 0
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
                                            : ''}"
                                    />
                                    <span
                                        class="absolute right-4 top-3.5 text-xs text-gray-400 font-bold"
                                        >원</span
                                    >
                                </div>
                                <!-- Quick Fill Buttons -->
                                <button
                                    on:click={() => handleFullAmount(mem)}
                                    disabled={calculatedTotal <= 0}
                                    class="px-3 py-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold active:scale-95 transition-all disabled:opacity-30 border border-blue-100 dark:border-blue-800/50"
                                >
                                    전액
                                </button>
                                <button
                                    on:click={() => handleAutoFill(mem)}
                                    disabled={remainToFill <= 0}
                                    class="px-3 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-300 disabled:opacity-30 active:scale-95 border border-gray-200 dark:border-gray-600"
                                >
                                    나머지
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Preview Calculation -->
                {#if newStock.price && totalContributed > 0}
                    <div
                        class="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl space-y-2"
                    >
                        <h4
                            class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest"
                        >
                            예상 지분 계산
                        </h4>
                        {#each Object.entries(contributions) as [owner, amt]}
                            {#if amt > 0}
                                <div class="flex justify-between text-sm">
                                    <span
                                        class="text-gray-600 dark:text-gray-300"
                                        >{owner}</span
                                    >
                                    <span
                                        class="font-bold text-gray-900 dark:text-white"
                                        >{(amt / newStock.price).toFixed(2)} 주</span
                                    >
                                </div>
                            {/if}
                        {/each}
                    </div>
                {/if}

                <button
                    on:click={handleSubmit}
                    disabled={isSubmitting || remainToFill !== 0}
                    class="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all disabled:bg-gray-300 disabled:shadow-none"
                >
                    {isSubmitting ? "저장 중..." : "저장하기"}
                </button>
            </div>
        {:else}
            <!-- List View -->
            <div class="space-y-4">
                {#if isLoading}
                    <Spinner label="주식 데이터를 가져오는 중..." />
                {:else if stocks.length === 0}
                    <div
                        class="text-center py-20 bg-white dark:bg-gray-800 rounded-[2rem] text-gray-400"
                    >
                        아직 주식 내역이 없습니다.<br />첫 투자를 기록해보세요!
                    </div>
                {:else}
                    <!-- Summary Cards -->
                    {#each summaryByStock as item}
                        <div
                            class="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
                        >
                            <!-- Header -->
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <h3
                                        class="text-2xl font-black text-gray-900 dark:text-white mb-1"
                                    >
                                        {item.name}
                                    </h3>
                                    <div
                                        class="text-xs font-bold text-gray-400"
                                    >
                                        평단가 @{(
                                            item.total_price / item.quantity
                                        ).toLocaleString()}원
                                    </div>
                                </div>
                                <div class="text-right">
                                    <span
                                        class="block text-2xl font-black text-emerald-600 dark:text-emerald-400"
                                        >{item.quantity.toFixed(2)}주</span
                                    >
                                    <span
                                        class="text-xs font-bold text-gray-400"
                                        >약 {item.total_price.toLocaleString()}원</span
                                    >
                                </div>
                            </div>

                            <!-- Visual Bar -->
                            <div
                                class="h-4 bg-gray-100 dark:bg-gray-700 rounded-full flex overflow-hidden mb-4"
                            >
                                {#each Object.entries(item.owners) as [owner, qty]}
                                    {#if qty > 0}
                                        <div
                                            class={MEMBER_COLORS[owner] ||
                                                "bg-gray-400"}
                                            style="width: {(qty /
                                                item.quantity) *
                                                100}%"
                                        ></div>
                                    {/if}
                                {/each}
                            </div>

                            <!-- Ownership Details -->
                            <div class="flex flex-wrap gap-3 mb-4">
                                {#each Object.entries(item.owners) as [owner, qty]}
                                    {#if qty > 0}
                                        <div
                                            class="flex items-center gap-1.5 text-xs font-bold bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-lg"
                                        >
                                            <div
                                                class="w-2 h-2 rounded-full {MEMBER_COLORS[
                                                    owner
                                                ] || 'bg-gray-400'}"
                                            ></div>
                                            <span
                                                class="text-gray-600 dark:text-gray-300"
                                                >{owner}
                                                {qty.toFixed(2)}주</span
                                            >
                                        </div>
                                    {/if}
                                {/each}
                            </div>

                            <!-- History (Collapsible) -->
                            <details class="group">
                                <summary
                                    class="flex items-center gap-2 text-xs font-bold text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-200 select-none pb-2"
                                >
                                    <span
                                        >🕒 매입 내역 보기 ({item.count}건)</span
                                    >
                                    <span
                                        class="group-open:rotate-180 transition-transform"
                                        >▼</span
                                    >
                                </summary>
                                <div
                                    class="space-y-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700"
                                >
                                    {#each stocks.filter((s) => s.stock_name === item.name) as stock}
                                        <div
                                            class="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-700/30 rounded-xl"
                                        >
                                            <div class="flex flex-col">
                                                <span
                                                    class="font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1"
                                                >
                                                    <div
                                                        class="w-1.5 h-1.5 rounded-full {MEMBER_COLORS[
                                                            stock.owner
                                                        ]}"
                                                    ></div>
                                                    {stock.owner}
                                                </span>
                                                <span
                                                    class="text-[10px] text-gray-400"
                                                    >{stock.date}</span
                                                >
                                            </div>
                                            <div
                                                class="flex flex-col items-end"
                                            >
                                                <span
                                                    class="font-bold text-gray-900 dark:text-white"
                                                    >{Number(
                                                        stock.quantity,
                                                    ).toFixed(2)}주</span
                                                >
                                                <span
                                                    class="text-[10px] text-gray-400"
                                                    >@{Number(
                                                        stock.price,
                                                    ).toLocaleString()}</span
                                                >
                                            </div>
                                            {#if $isAdmin}
                                                <button
                                                    on:click={() =>
                                                        deleteStock(stock.id)}
                                                    class="text-gray-400 hover:text-red-500 ml-2 p-2 transition-colors"
                                                    title="삭제하기"
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        class="h-4 w-4"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                        />
                                                    </svg>
                                                </button>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            </details>
                        </div>
                    {/each}
                {/if}
            </div>
        {/if}
    </main>
</div>
