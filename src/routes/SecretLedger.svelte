<script>
    import { onMount } from "svelte";
    import { fade, slide } from "svelte/transition";
    import { currentUser } from "../lib/store.js";

    let expenses = [];
    let newItem = "";
    let newAmount = "";
    let newDate = new Date().toISOString().split("T")[0];
    let newCategory = "식비";
    let showForm = false;

    // 로컬 스토리지 키
    const STORAGE_KEY = "secretLedgerData";

    onMount(() => {
        loadExpenses();
    });

    function loadExpenses() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            expenses = JSON.parse(data).sort(
                (a, b) => new Date(b.date) - new Date(a.date),
            );
        }
    }

    function saveExpenses() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
        expenses = expenses; // 트리거 업데이트
    }

    function addExpense() {
        if (!newItem || !newAmount) return alert("내역과 금액을 입력해주세요.");

        const expense = {
            id: Date.now(),
            date: newDate,
            item: newItem,
            amount: parseInt(newAmount),
            category: newCategory,
        };

        expenses = [expense, ...expenses];
        saveExpenses();

        // 초기화
        newItem = "";
        newAmount = "";
        showForm = false;
    }

    function deleteExpense(id) {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        expenses = expenses.filter((e) => e.id !== id);
        saveExpenses();
    }

    // 월별 그룹화
    $: groupedExpenses = expenses.reduce((acc, curr) => {
        const month = curr.date.slice(0, 7); // YYYY-MM
        if (!acc[month]) acc[month] = [];
        acc[month].push(curr);
        return acc;
    }, {});

    // 월별 합계
    $: monthlyTotals = Object.keys(groupedExpenses).reduce((acc, month) => {
        acc[month] = groupedExpenses[month].reduce(
            (sum, item) => sum + item.amount,
            0,
        );
        return acc;
    }, {});

    function formatMoney(amount) {
        return amount.toLocaleString() + "원";
    }
</script>

<div class="p-4 max-w-md mx-auto space-y-6 pb-20">
    <div class="flex items-center justify-between">
        <h2
            class="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2"
        >
            🤫 비자금 장부
            <span
                class="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg"
                >Admin Only</span
            >
        </h2>
        <div class="text-xs text-gray-400">
            {$currentUser === "현구" || $currentUser === "관리자"
                ? "접속 허용됨"
                : "접속 불가"}
        </div>
    </div>

    {#if $currentUser !== "현구" && $currentUser !== "관리자"}
        <div
            class="p-10 text-center text-gray-500 bg-red-50 rounded-2xl border border-red-100"
        >
            <p class="font-bold text-red-500 mb-2">접근 권한이 없습니다.</p>
            <p class="text-sm">이 페이지는 관리자(현구)만 볼 수 있습니다.</p>
        </div>
    {:else}
        <!-- 입력 폼 토글 -->
        <button
            on:click={() => (showForm = !showForm)}
            class="w-full py-3 bg-gray-900 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
        >
            {showForm ? "닫기" : "📝 내역 추가하기"}
        </button>

        {#if showForm}
            <div
                transition:slide
                class="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 space-y-3"
            >
                <div class="flex gap-2">
                    <input
                        type="date"
                        bind:value={newDate}
                        class="flex-[2] p-3 bg-gray-50 dark:bg-gray-900 dark:text-white rounded-xl text-sm border-none"
                    />
                    <select
                        bind:value={newCategory}
                        class="flex-1 p-3 bg-gray-50 dark:bg-gray-900 dark:text-white rounded-xl text-sm border-none"
                    >
                        <option>식비</option><option>취미</option><option
                            >모임</option
                        ><option>쇼핑</option><option>기타</option>
                    </select>
                </div>
                <input
                    type="text"
                    bind:value={newItem}
                    placeholder="사용 내역 (몰래 산 건담...)"
                    class="w-full p-3 bg-gray-50 dark:bg-gray-900 dark:text-white rounded-xl text-sm border-none"
                />
                <input
                    type="number"
                    bind:value={newAmount}
                    placeholder="금액"
                    class="w-full p-3 bg-gray-50 dark:bg-gray-900 dark:text-white rounded-xl text-sm border-none"
                />
                <button
                    on:click={addExpense}
                    class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl active:scale-95 transition-all"
                    >저장</button
                >
            </div>
        {/if}

        <!-- 리스트 -->
        <div class="space-y-6">
            {#each Object.keys(groupedExpenses).sort().reverse() as month}
                <section class="space-y-3">
                    <div class="flex justify-between items-end px-2">
                        <h3
                            class="text-lg font-bold text-gray-800 dark:text-white"
                        >
                            {month}
                        </h3>
                        <span
                            class="text-sm font-bold text-indigo-600 dark:text-indigo-400"
                            >Total: {formatMoney(monthlyTotals[month])}</span
                        >
                    </div>

                    <div
                        class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
                    >
                        {#each groupedExpenses[month] as expense (expense.id)}
                            <div
                                class="flex justify-between items-center p-4 border-b border-gray-50 dark:border-gray-700 last:border-none group"
                            >
                                <div class="flex-1">
                                    <div
                                        class="flex items-center gap-2 text-xs text-gray-400 mb-0.5"
                                    >
                                        <span
                                            class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-300"
                                            >{expense.category}</span
                                        >
                                        <span>{expense.date.slice(8)}일</span>
                                    </div>
                                    <div
                                        class="font-bold text-gray-800 dark:text-gray-200"
                                    >
                                        {expense.item}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div
                                        class="font-bold text-gray-900 dark:text-white"
                                    >
                                        {formatMoney(expense.amount)}
                                    </div>
                                    <button
                                        on:click={() =>
                                            deleteExpense(expense.id)}
                                        class="text-xs text-red-300 hover:text-red-500 transition-colors mt-1 opacity-100 lg:opacity-0 group-hover:opacity-100"
                                        >삭제</button
                                    >
                                </div>
                            </div>
                        {/each}
                    </div>
                </section>
            {/each}

            {#if expenses.length === 0}
                <div class="text-center py-20 text-gray-400">
                    <p>아직 기록된 비자금이 없네요... 💸</p>
                </div>
            {/if}
        </div>
    {/if}
</div>
