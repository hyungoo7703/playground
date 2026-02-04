<script>
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { navigate } from "svelte-routing";
  import { base, GAS_URL } from "../lib/store.js";

  let monthlyEvents = [];
  let isLoading = true;
  const userName = localStorage.getItem("userName") || "가족";

  let dDayEvent = null;
  let dDayDiff = null;

  onMount(async () => {
    // 1. D-Day Check
    const storedDDay = localStorage.getItem("dDayEvent");
    if (storedDDay) {
      const event = JSON.parse(storedDDay);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(event.date);
      target.setHours(0, 0, 0, 0);

      const diffTime = target - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0) {
        dDayEvent = event;
        dDayDiff = diffDays;
      } else {
        localStorage.removeItem("dDayEvent"); // Clean up expired
      }
    }

    try {
      const response = await fetch(GAS_URL, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({ action: "getEvents" }),
      });
      const result = await response.json();

      if (result.success) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        monthlyEvents = result.events
          .filter((event) => {
            const eventDate = new Date(event.date);
            return (
              eventDate.getFullYear() === currentYear &&
              eventDate.getMonth() === currentMonth
            );
          })
          .sort((a, b) => a.date.localeCompare(b.date)); // Use string sort for consistency
      }
    } catch (e) {
      console.error("데이터 로드 실패:", e);
    } finally {
      isLoading = false;
    }
  });

  function navigateTo(page) {
    navigate(`${base}/${page}`);
  }

  function getDay(dateString) {
    return new Date(dateString).getDate();
  }
</script>

<div class="px-4 py-6 space-y-6 max-w-md mx-auto pb-20">
  <header
    in:fade={{ duration: 800 }}
    class="relative overflow-hidden rounded-[2.5rem] bg-gray-900 p-8 text-white shadow-2xl"
  >
    <div class="relative z-10">
      <span class="text-indigo-400 font-bold text-sm tracking-widest uppercase"
        >Welcome back</span
      >
      <h1 class="text-3xl font-black mt-1 leading-tight">
        {userName}님,<br />오늘도 반갑습니다!
      </h1>
    </div>
    <div
      class="absolute -right-10 -top-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl"
    ></div>
  </header>

  <!-- D-Day Banner -->
  {#if dDayEvent}
    {@const [dDayMain, ...dDaySubs] = dDayEvent.title.split("(")}
    <div
      in:fly={{ y: -20, duration: 500 }}
      class="relative bg-gradient-to-r from-pink-500 to-rose-500 rounded-[2rem] p-6 text-white shadow-lg overflow-hidden flex justify-between items-center group cursor-pointer"
      on:click={() => navigateTo("events")}
    >
      <div class="relative z-10">
        <span
          class="text-pink-200 text-xs font-bold uppercase tracking-wider mb-1 block"
          >Coming Up</span
        >
        <h3 class="font-black text-xl leading-tight text-white">
          {dDayMain.trim()}
          {#if dDaySubs.length > 0}
            <span class="block text-sm font-bold text-pink-200 mt-1 opacity-90">
              {dDaySubs.map((s) => s.replace(")", "").trim()).join(" ")}
            </span>
          {/if}
        </h3>
        <p class="text-xs text-white/80 mt-1">{dDayEvent.date}</p>
      </div>
      <div
        class="relative z-10 flex flex-col items-center justify-center bg-white/20 backdrop-blur-md rounded-2xl w-16 h-16 shadow-inner border border-white/30"
      >
        <span class="text-[10px] font-bold text-white/90">D-Day</span>
        <span class="text-2xl font-black leading-none"
          >{dDayDiff === 0 ? "DAY" : dDayDiff}</span
        >
      </div>
      <!-- Deco -->
      <div
        class="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all"
      ></div>
    </div>
  {/if}

  <section class="grid grid-cols-4 gap-2">
    <button
      on:click={() => navigateTo("bulletin-board")}
      class="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-green-100 dark:border-green-900 active:scale-95 transition-all"
    >
      <div
        class="w-9 h-9 bg-green-50 rounded-2xl flex items-center justify-center text-lg mb-2"
      >
        💬
      </div>
      <span class="text-[10px] font-bold text-green-600 dark:text-green-400"
        >게시판</span
      >
    </button>
    <button
      on:click={() => navigateTo("ledger")}
      class="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-yellow-100 dark:border-yellow-900 active:scale-95 transition-all"
    >
      <div
        class="w-9 h-9 bg-yellow-50 rounded-2xl flex items-center justify-center text-lg mb-2"
      >
        💰
      </div>
      <span class="text-[10px] font-bold text-yellow-600 dark:text-yellow-400"
        >장부</span
      >
    </button>
    <button
      on:click={() => navigateTo("stock")}
      class="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-emerald-100 dark:border-emerald-900 active:scale-95 transition-all"
    >
      <div
        class="w-9 h-9 bg-emerald-50 rounded-2xl flex items-center justify-center text-lg mb-2"
      >
        📈
      </div>
      <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
        >주식</span
      >
    </button>
    <button
      on:click={() => navigateTo("game")}
      class="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-indigo-100 dark:border-indigo-900 active:scale-95 transition-all"
    >
      <div
        class="w-9 h-9 bg-indigo-50 rounded-2xl flex items-center justify-center text-lg mb-2"
      >
        🎮
      </div>
      <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400"
        >게임</span
      >
    </button>
  </section>

  <section in:fly={{ x: -20, delay: 100 }} class="relative">
    <button
      on:click={() => navigateTo("english-listening")}
      class="w-full flex items-center justify-between p-5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[2rem] text-white shadow-lg active:scale-[0.98] transition-all overflow-hidden"
    >
      <div class="relative z-10 text-left">
        <h3 class="font-black text-lg">영어 듣기 공부 🎧</h3>
        <p class="text-xs opacity-80">실전 같은 대화로 귀를 뚫어보세요!</p>
      </div>
      <div class="relative z-10 bg-white/20 p-2 rounded-xl backdrop-blur-md">
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          ></path>
        </svg>
      </div>
      <div
        class="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl"
      ></div>
    </button>
  </section>

  <section in:fly={{ x: -20, delay: 200 }} class="relative">
    <button
      on:click={() => navigateTo("food-spinner")}
      class="w-full flex items-center justify-between p-5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2rem] text-white shadow-lg active:scale-[0.98] transition-all overflow-hidden"
    >
      <div class="relative z-10 text-left">
        <h3 class="font-black text-lg">오늘 뭐 먹지? 🎰</h3>
        <p class="text-xs opacity-80">고민될 땐 룰렛을 돌려보세요!</p>
      </div>
      <div class="relative z-10 bg-white/20 p-2 rounded-xl backdrop-blur-md">
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
            d="M9 5l7 7-7 7"
          ></path></svg
        >
      </div>
      <div
        class="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl"
      ></div>
    </button>
  </section>

  <section
    in:fly={{ y: 20, delay: 400 }}
    class="p-6 bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-50 dark:border-gray-700"
  >
    <div class="flex justify-between items-center mb-6">
      <h2
        class="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2"
      >
        <span class="w-1.5 h-5 bg-indigo-600 rounded-full"></span>
        이번 달 일정
      </h2>
      <button
        on:click={() => navigateTo("events")}
        class="text-xs font-bold text-indigo-600">전체보기</button
      >
    </div>

    <div class="space-y-4">
      {#if isLoading}
        <div class="animate-pulse flex flex-col gap-3">
          <div class="h-16 bg-gray-50 rounded-2xl"></div>
        </div>
      {:else if monthlyEvents.length > 0}
        {#each monthlyEvents as event (event.id)}
          {@const [mainTitle, ...subTitles] = event.title.split("(")}
          <li
            class="list-none flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl"
          >
            <div
              class="flex flex-col items-center justify-center min-w-[3rem] h-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm"
            >
              <span class="text-[10px] font-bold text-gray-400 uppercase"
                >{new Date().toLocaleString("en-US", { month: "short" })}</span
              >
              <span class="text-lg font-black text-indigo-600 leading-none"
                >{getDay(event.date)}</span
              >
            </div>
            <div class="flex-1 overflow-hidden">
              <p
                class="text-[10px] font-bold text-indigo-400 truncate uppercase"
              >
                {event.category}
              </p>
              <p
                class="font-bold text-gray-800 dark:text-gray-200 truncate text-left"
              >
                {mainTitle.trim()}
              </p>
              {#if subTitles.length > 0}
                <p
                  class="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate mt-0.5"
                >
                  {subTitles.map((s) => s.replace(")", "").trim()).join(" ")}
                </p>
              {/if}
            </div>
          </li>
        {/each}
      {:else}
        <div class="text-center py-8">
          <p class="text-sm text-gray-400">예정된 일정이 없습니다. ☕</p>
        </div>
      {/if}
    </div>
  </section>
</div>
