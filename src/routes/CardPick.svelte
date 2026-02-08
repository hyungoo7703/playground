<script>
    import { onMount } from "svelte";
    import { fade, scale, fly } from "svelte/transition";
    import { flip } from "svelte/animate";
    import { navigate } from "svelte-routing";
    import { currentUser, base } from "../lib/store.js";
    import { api } from "../lib/api.js";

    // --- 상태 관리 ---
    let amounts = []; // 구글 시트에서 가져온 금액 리스트
    let isLoading = true;

    // 카드 상태
    let cards = [];
    let shuffling = false;
    let selectedCard = null;
    let revealed = false;
    let revealedAmount = "";

    // 관리자
    let newAmount = "";
    let isAdding = false;
    const userRole = localStorage.getItem("role");

    // 카드 뒷면 색상
    const CARD_COLORS = [
        "from-indigo-500 to-purple-600",
        "from-pink-500 to-rose-600",
        "from-amber-500 to-orange-600",
        "from-emerald-500 to-teal-600",
        "from-cyan-500 to-blue-600",
        "from-violet-500 to-fuchsia-600",
    ];

    /** 금액 리스트 가져오기 */
    async function fetchAmounts() {
        isLoading = true;
        try {
            const data = await api.getManagement("cardpick");
            if (data.success) {
                amounts = data.data.map((item) => item.value);
                initializeCards();
            }
        } catch (e) {
            console.error("데이터 로드 실패:", e);
            // 기본값
            amounts = ["5,000원", "10,000원", "15,000원", "20,000원"];
            initializeCards();
        } finally {
            isLoading = false;
        }
    }

    /** 관리자 금액 추가 */
    async function addAmount() {
        if (!newAmount.trim() || isAdding) return;
        isAdding = true;

        try {
            const data = await api.addManagement("cardpick", newAmount);
            if (data.success) {
                newAmount = "";
                await fetchAmounts();
            }
        } catch (e) {
            alert("추가 중 오류가 발생했습니다.");
        } finally {
            isAdding = false;
        }
    }

    /** 카드 초기화 및 셔플 */
    function initializeCards() {
        cards = amounts.map((amount, i) => ({
            id: i,
            amount,
            // 모든 카드 뒷면 색상 통일 (예측 불가하도록)
            color: "from-indigo-500 to-purple-600",
            flipped: false,
            x: 0,
            y: 0,
        }));
        shuffleCards();
    }

    /** 셔플 애니메이션 */
    async function shuffleCards() {
        if (shuffling || cards.length === 0) return;

        shuffling = true;
        selectedCard = null;
        revealed = false;
        revealedAmount = "";

        // 카드 뒤집기 리셋
        cards = cards.map((c) => ({ ...c, flipped: false }));

        // 셔플 애니메이션 (여러 번 섞기)
        for (let round = 0; round < 5; round++) {
            await new Promise((r) => setTimeout(r, 150));

            // Fisher-Yates 셔플
            const newCards = [...cards];
            for (let i = newCards.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
            }
            cards = newCards;
        }

        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        shuffling = false;
    }

    /** 카드 선택 */
    function selectCard(card) {
        if (shuffling) return;

        // 이미 뒤집힌 카드면 무시
        if (card.flipped) return;

        // 첫 번째 선택인 경우 당첨 카드로 기록
        const isFirstPick = !revealed;
        if (isFirstPick) {
            selectedCard = card.id;
            revealedAmount = card.amount;
        }

        // 선택한 카드 뒤집기 (기존 뒤집힌 카드는 유지)
        setTimeout(() => {
            cards = cards.map((c) => ({
                ...c,
                flipped: c.id === card.id ? true : c.flipped,
            }));

            if (isFirstPick) {
                revealed = true;
                if (navigator.vibrate)
                    navigator.vibrate([100, 50, 100, 50, 200]);
            } else {
                if (navigator.vibrate) navigator.vibrate(50);
            }
        }, 150);
    }

    /** 다시 뽑기 */
    function resetGame() {
        shuffleCards();
    }

    onMount(fetchAmounts);
</script>

<div class="px-4 py-6 max-w-lg mx-auto">
    <!-- 헤더 -->
    <div class="text-center mb-6">
        <h1
            class="text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent"
        >
            🎴 용돈 카드뽑기
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            카드를 골라 용돈을 받으세요!
        </p>
    </div>

    {#if isLoading}
        <div class="text-center py-20">
            <div class="text-4xl animate-bounce">🎴</div>
            <p class="text-gray-400 mt-4 animate-pulse">카드 준비 중...</p>
        </div>
    {:else}
        <!-- 카드 영역 -->
        <div
            class="relative min-h-[320px] flex items-center justify-center mb-6"
        >
            <div class="flex flex-wrap justify-center gap-3 md:gap-4">
                {#each cards as card (card.id)}
                    <button
                        on:click={() => selectCard(card)}
                        disabled={shuffling || card.flipped}
                        animate:flip={{ duration: 300 }}
                        class="relative w-20 h-28 md:w-24 md:h-32 rounded-xl shadow-xl transition-all duration-300 transform
                            {selectedCard === card.id
                            ? 'scale-110 z-10 ring-4 ring-yellow-400'
                            : 'hover:scale-105'}
                            {shuffling ? 'animate-pulse' : ''}
                            {card.flipped ? 'cursor-default' : ''}"
                        style="perspective: 1000px;"
                    >
                        <div
                            class="absolute inset-0 w-full h-full transition-transform duration-500 transform-gpu"
                            style="transform-style: preserve-3d; transform: {card.flipped
                                ? 'rotateY(180deg)'
                                : 'rotateY(0deg)'};"
                        >
                            <!-- 카드 뒷면 -->
                            <div
                                class="absolute inset-0 w-full h-full rounded-xl bg-gradient-to-br {card.color} flex items-center justify-center border-4 border-white/30 shadow-lg backface-hidden"
                                style="backface-visibility: hidden;"
                            >
                                <span class="text-4xl md:text-5xl opacity-80"
                                    >?</span
                                >
                            </div>

                            <!-- 카드 앞면 -->
                            <div
                                class="absolute inset-0 w-full h-full rounded-xl bg-gradient-to-br from-yellow-100 to-amber-200 dark:from-yellow-900/50 dark:to-amber-800/50 flex flex-col items-center justify-center border-4 border-yellow-400 shadow-lg"
                                style="backface-visibility: hidden; transform: rotateY(180deg);"
                            >
                                <span class="text-2xl mb-1">💰</span>
                                <span
                                    class="text-xs md:text-sm font-black text-amber-700 dark:text-amber-300 text-center px-1 break-keep"
                                >
                                    {card.amount}
                                </span>
                            </div>
                        </div>
                    </button>
                {/each}
            </div>
        </div>

        <!-- 결과 표시 -->
        {#if revealed}
            <div
                class="mb-6 p-6 bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-2xl text-center shadow-lg border-2 border-yellow-300 dark:border-yellow-700"
                transition:scale={{ duration: 300 }}
            >
                <div class="text-5xl mb-2">🎉</div>
                <p
                    class="text-sm text-amber-600 dark:text-amber-400 font-bold mb-1"
                >
                    당첨!
                </p>
                <div
                    class="text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent"
                >
                    {revealedAmount}
                </div>
            </div>
        {/if}

        <!-- 버튼 -->
        <div class="space-y-3">
            <button
                on:click={resetGame}
                disabled={shuffling}
                class="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-bold text-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {#if shuffling}
                    <span class="animate-spin">🔄</span>
                    <span>섞는 중...</span>
                {:else}
                    <span>🔀</span>
                    <span>{revealed ? "다시 뽑기" : "카드 섞기"}</span>
                {/if}
            </button>

            <!-- 메인으로 버튼 (보상 받은 후) -->
            {#if revealed}
                <button
                    on:click={() => navigate(base || "/")}
                    class="w-full py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2"
                >
                    🏠 메인으로
                </button>
            {/if}
        </div>

        <!-- 관리자 전용 -->
        {#if userRole === "admin"}
            <div
                class="mt-8 bg-amber-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-amber-100 dark:border-slate-700"
                transition:fade
            >
                <h4
                    class="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3"
                >
                    🔧 관리자: 금액 관리
                </h4>
                <div class="flex gap-2">
                    <input
                        type="text"
                        bind:value={newAmount}
                        placeholder="예: 10,000원"
                        class="flex-1 px-4 py-3 rounded-xl border-none text-sm bg-white dark:bg-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-amber-500"
                        on:keydown={(e) => e.key === "Enter" && addAmount()}
                    />
                    <button
                        on:click={addAmount}
                        disabled={isAdding || !newAmount}
                        class="px-5 bg-amber-600 text-white rounded-xl font-bold text-sm disabled:bg-slate-400 transition-colors"
                    >
                        {isAdding ? ".." : "추가"}
                    </button>
                </div>

                <!-- 현재 금액 리스트 -->
                <div class="mt-4 flex flex-wrap gap-2">
                    {#each amounts as amt}
                        <span
                            class="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-bold"
                        >
                            {amt}
                        </span>
                    {/each}
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .backface-hidden {
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
    }
</style>
