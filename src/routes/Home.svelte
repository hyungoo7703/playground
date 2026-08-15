<script>
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { navigate } from "svelte-routing";
  import { base, isAdmin } from "../lib/store.js";
  import { api } from "../lib/api.js";
  import { formatDate } from "../lib/utils.js";
  import { readCache, writeCache } from "../lib/cache.js";
  import FamilyButlerModal from "../lib/components/FamilyButlerModal.svelte";

  let isButlerOpen = false;

  let monthlyEvents = [];
  let isLoading = true;
  const userName = localStorage.getItem("userName") || "가족";
  const todayLabel = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // AI Knowledge custom notes (Admin only management)
  let aiKnowledgeList = [];
  let newKnowledgeText = "";
  let isAddingKnowledge = false;

  // Stock summary widget
  let stockCount = 0;
  let stockTotalAmount = 0;
  let stockLoaded = false;

  let dDayEvent = null;
  let dDayDiff = null;

  // Attendance widget state
  let todayCheckedIn = false;
  let attendanceStreak = 0;
  let attendanceLoaded = false;




  onMount(async () => {
    // 1. D-Day Check


    const storedDDay = localStorage.getItem("dDayEvent");
    let event = null;
    if (storedDDay) {
      try {
        event = JSON.parse(storedDDay);
      } catch {
        // 손상된 값이 onMount 전체를 중단시키지 않도록 제거
        localStorage.removeItem("dDayEvent");
      }
    }
    if (event) {
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

    // 2. 캐시 먼저 렌더 (SWR)
    const cachedEvents = readCache("events");
    if (cachedEvents) {
      applyEvents(cachedEvents);
      isLoading = false;
    }
    const cachedAttendance = readCache("attendance");
    if (cachedAttendance) {
      applyAttendance(cachedAttendance);
      attendanceLoaded = true;
    }
    const cachedLedger = readCache("ledger");
    if (cachedLedger) applyLedger(cachedLedger);

    const cachedStocks = readCache("stocks");
    if (cachedStocks) applyStocks(cachedStocks);

    // AI 맞춤 지식 캐시 먼저 렌더 (SWR)
    const cachedKnowledge = readCache("ai_knowledge");
    if (cachedKnowledge && Array.isArray(cachedKnowledge)) {
      aiKnowledgeList = cachedKnowledge;
    }

    // AI 맞춤 지식 비동기 갱신
    api.getManagement("ai_knowledge").then((res) => {
      if (res && res.success && Array.isArray(res.data)) {
        aiKnowledgeList = res.data.map((item) => (typeof item === "string" ? item : item.value)).filter(Boolean);
        writeCache("ai_knowledge", aiKnowledgeList);
      }
    }).catch(() => {});

    // 주식 데이터 비동기 갱신
    api.getStocks().then((res) => {
      if (res && res.success) {
        writeCache("stocks", res.stocks || []);
        applyStocks(res.stocks || []);
      }
    }).catch(() => {});

    // 3. 일정+출석+장부를 한 번의 왕복으로 갱신
    try {
      const res = await api.bootstrap();
      if (res.success) {
        writeCache("events", res.events || []);
        writeCache("attendance", res.attendance || []);
        writeCache("ledger", res.ledger || []);
        applyEvents(res.events || []);
        applyAttendance(res.attendance || []);
        applyLedger(res.ledger || []);
      } else {
        // GAS에 bootstrap 액션이 아직 없으면 개별 호출로 폴백
        const [evRes, attRes] = await Promise.all([
          api.getEvents(),
          api.getAttendance(),
        ]);
        if (evRes.success) {
          writeCache("events", evRes.events || []);
          applyEvents(evRes.events || []);
        }
        if (attRes.success) {
          writeCache("attendance", attRes.attendance || []);
          applyAttendance(attRes.attendance || []);
        }
      }
    } catch (e) {
      console.error("데이터 로드 실패:", e);
    } finally {
      isLoading = false;
      attendanceLoaded = true;
    }
  });

  function applyStocks(stocks) {
    if (!stocks || !Array.isArray(stocks)) return;
    const uniqueNames = new Set(stocks.map((s) => s.stock_name));
    stockCount = uniqueNames.size;
    stockTotalAmount = stocks.reduce(
      (sum, s) => sum + (Number(s.price) * Number(s.quantity) || 0),
      0,
    );
    stockLoaded = true;
  }

  function applyEvents(events) {

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    monthlyEvents = events
      .filter((event) => {
        const eventDate = new Date(event.date);
        return (
          eventDate.getFullYear() === currentYear &&
          eventDate.getMonth() === currentMonth
        );
      })
      .sort((a, b) => a.date.localeCompare(b.date)); // Use string sort for consistency
  }

  let monthCount = 0;
  let monthUnsettledCount = 0;
  let monthUnsettledAmount = 0;
  let monthTotalAmount = 0;
  let monthUnsettledItems = [];
  let ledgerLoaded = false;

  function applyLedger(ledger) {
    const ym = formatDate(new Date()).slice(0, 7);
    const monthItems = (ledger || []).filter((i) => String(i.date).startsWith(ym));
    monthCount = monthItems.length;
    const unsettled = monthItems.filter(
      (i) => !i.is_settled || i.is_settled === "FALSE",
    );
    monthUnsettledCount = unsettled.length;
    monthUnsettledAmount = unsettled.reduce(
      (sum, i) => sum + (parseFloat(String(i.amount).replace(/[^\d.-]/g, "")) || 0),
      0,
    );
    monthTotalAmount = monthItems.reduce(
      (sum, i) => sum + (parseFloat(String(i.amount).replace(/[^\d.-]/g, "")) || 0),
      0,
    );
    monthUnsettledItems = unsettled.map((i) => ({
      title: i.title,
      amount: i.amount,
      giver: i.giver,
      receiver: i.receiver,
      date: i.date,
    }));
    ledgerLoaded = true;
  }

  function applyAttendance(attendance) {
    const today = new Date();
    const todayStr = formatDate(today);
    const currentUser = localStorage.getItem("userName") || "가족";
    todayCheckedIn = attendance.some(
      (a) => a.date === todayStr && a.user_name === currentUser,
    );

    // Streak calc
    const userDates = attendance
      .filter((a) => a.user_name === currentUser)
      .map((a) => a.date)
      .sort()
      .reverse();
    let streak = 0;
    for (let i = 0; i < userDates.length; i++) {
      const check = new Date(today);
      check.setDate(check.getDate() - i);
      const checkStr = formatDate(check);
      if (userDates.includes(checkStr)) streak++;
      else break;
    }
    attendanceStreak = streak;
  }

  async function handleAddKnowledge() {
    const text = newKnowledgeText.trim();
    if (!text || isAddingKnowledge) return;
    isAddingKnowledge = true;

    // Optimistic UI update
    aiKnowledgeList = [...aiKnowledgeList, text];
    writeCache("ai_knowledge", aiKnowledgeList);
    newKnowledgeText = "";

    try {
      await api.addManagement("ai_knowledge", text);
    } catch (e) {
      console.error("AI 지식 추가 실패:", e);
    } finally {
      isAddingKnowledge = false;
    }
  }

  async function handleDeleteKnowledge(itemToDelete) {
    aiKnowledgeList = aiKnowledgeList.filter((item) => item !== itemToDelete);
    writeCache("ai_knowledge", aiKnowledgeList);

    try {
      await api.deleteManagement("ai_knowledge", itemToDelete);
    } catch (e) {
      console.error("AI 지식 삭제 실패:", e);
    }
  }

  function navigateTo(page) {
    navigate(`${base}/${page}`);
  }

  function getDay(dateString) {
    return new Date(dateString).getDate();
  }
</script>

<div class="space-y-6 max-w-md mx-auto pb-36">

  <header
    in:fade={{ duration: 800 }}
    class="relative overflow-hidden rounded-[2.5rem] bg-gray-900 p-8 text-white shadow-2xl"
  >
    <div class="relative z-10">
      <span class="text-indigo-400 font-bold text-sm tracking-widest"
        >{todayLabel}</span
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
    <button
      in:fly={{ y: -20, duration: 500 }}
      class="w-full relative bg-gradient-to-r from-pink-500 to-rose-500 rounded-[2rem] p-6 text-white shadow-lg overflow-hidden flex justify-between items-center group cursor-pointer text-left"
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
    </button>
  {:else}
    <button
      on:click={() => navigateTo("events")}
      class="w-full p-4 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-sm font-bold active:scale-[0.98] transition-all"
    >
      🎉 기다려지는 날이 있나요? 일정에서 D-Day를 설정해보세요
    </button>
  {/if}

  <!-- Attendance Widget -->
  <section in:fly={{ y: 20, duration: 400 }}>
    <button
      on:click={() => navigateTo("attendance")}
      class="w-full flex items-center justify-between p-5 rounded-[2rem] shadow-lg active:scale-[0.98] transition-all overflow-hidden relative
        {!attendanceLoaded
        ? 'bg-gray-200 dark:bg-gray-700 text-gray-400'
        : todayCheckedIn
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
          : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'}"
    >
      <div class="relative z-10 text-left">
        {#if !attendanceLoaded}
          <h3 class="font-black text-lg text-gray-500 dark:text-gray-300">
            출석체크 📅
          </h3>
          <p class="text-xs text-gray-400">확인 중...</p>
        {:else if todayCheckedIn}
          <h3 class="font-black text-lg">오늘 출석 완료! ✅</h3>
          <p class="text-xs opacity-80">
            {attendanceStreak > 0
              ? `🔥 ${attendanceStreak}일 연속 출석 중!`
              : "내일도 잊지 마세요~"}
          </p>
        {:else}
          <h3 class="font-black text-lg">출석체크 하러가기 👋</h3>
          <p class="text-xs opacity-80">터치하여 오늘의 출석을 남겨보세요!</p>
        {/if}
      </div>
      <div class="relative z-10 bg-white/20 p-2 rounded-xl backdrop-blur-md">
        <span class="text-2xl"
          >{!attendanceLoaded ? "⏳" : todayCheckedIn ? "🏅" : "📅"}</span
        >
      </div>
      <div
        class="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl"
      ></div>
    </button>
  </section>

  <!-- 자주 쓰는 액션: 출석 바로 아래 배치 -->
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
        <span class="text-2xl">🍽️</span>
      </div>
      <div
        class="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl"
      ></div>
    </button>
  </section>

  <!-- 우리 가족 주식 요약 위젯 -->
  <section in:fly={{ y: 20, delay: 350 }}>
    <button
      on:click={() => navigateTo("stock")}
      class="w-full flex items-center justify-between p-5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-[2rem] shadow-sm border border-emerald-100 dark:border-emerald-800/40 active:scale-[0.98] transition-all"
    >
      <div class="text-left">
        <h3
          class="font-black text-gray-900 dark:text-white flex items-center gap-2"
        >
          <span class="w-1.5 h-5 bg-emerald-500 rounded-full"></span>
          우리 가족 주식
        </h3>
        {#if stockLoaded}
          <p class="text-xs text-emerald-700 dark:text-emerald-300 font-bold mt-1">
            {stockCount > 0
              ? `총 ${stockCount}개 종목 · ${stockTotalAmount.toLocaleString()}원 투자 중 📈`
              : "아직 주식 내역이 없습니다. 시작해보세요! 🚀"}
          </p>
        {:else}
          <p class="text-xs text-gray-400 mt-1 animate-pulse">주식 현황 확인 중...</p>
        {/if}
      </div>
      <span class="text-2xl p-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">📈</span>
    </button>
  </section>

  <!-- 이번 달 일정 -->
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
        <ul class="space-y-3 list-none p-0 m-0">
          {#each monthlyEvents as event (event.id)}
            {@const [mainTitle, ...subTitles] = event.title.split("(")}
            <li
              class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl"
            >
              <div
                class="flex flex-col items-center justify-center min-w-[3rem] h-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm"
              >
                <span class="text-[10px] font-bold text-gray-400 uppercase"
                  >{new Date().toLocaleString("en-US", {
                    month: "short",
                  })}</span
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
        </ul>
      {:else}
        <div class="text-center py-8">
          <p class="text-sm text-gray-400">예정된 일정이 없습니다. ☕</p>
        </div>
      {/if}
    </div>
  </section>

  <!-- 이번 달 장부 요약: 하단 탭 바로 위에서 장부로 연결 -->
  <section in:fly={{ y: 20, delay: 500 }}>
    <button
      on:click={() => navigateTo("ledger")}
      class="w-full flex items-center justify-between p-5 bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-50 dark:border-gray-700 active:scale-[0.98] transition-all"
    >
      <div class="text-left">
        <h3

          class="font-black text-gray-900 dark:text-white flex items-center gap-2"
        >
          <span class="w-1.5 h-5 bg-yellow-400 rounded-full"></span>
          이번 달 장부
        </h3>
        {#if ledgerLoaded}
          <p class="text-xs text-gray-400 mt-1">
            총 {monthCount}건{monthUnsettledCount > 0
              ? ` · 미정산 ${monthUnsettledCount}건 (${monthUnsettledAmount.toLocaleString()}원)`
              : " · 모두 정산 완료 ✨"}
          </p>
        {:else}
          <p class="text-xs text-gray-400 mt-1 animate-pulse">확인 중...</p>
        {/if}
      </div>
      <span class="text-2xl">💰</span>
    </button>
    <p
      class="text-center text-[11px] text-gray-400 dark:text-gray-500 font-bold mt-3"
    >
      장부 · 일정 · 게시판은 아래 탭에서 언제든지 👇
    </p>
  </section>

  <!-- Admin Only: AI Custom Knowledge Management -->
  {#if $isAdmin}
    <section class="p-5 bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-pink-50/40 dark:from-gray-800/90 dark:via-indigo-950/40 dark:to-gray-900 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="text-base">🔒</span>
          <h3 class="font-black text-xs sm:text-sm text-indigo-950 dark:text-indigo-200">
            AI 집사용 가족 메모 (관리자 전용)
          </h3>
        </div>
        <span class="text-[10px] bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
          {aiKnowledgeList.length}개 저장됨
        </span>
      </div>
      <p class="text-[11px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
        가족 취향(엄마 매운거 X), TMI, 집 규칙을 적어두면 AI가 답변할 때 기억하고 맞춤 대답해줘요!
      </p>

      <!-- Knowledge Tag Chips List -->
      <div class="flex flex-wrap gap-1.5 mb-3">
        {#if aiKnowledgeList.length === 0}
          <p class="text-xs text-gray-400 dark:text-gray-500 py-1">등록된 맞춤 메모가 없습니다. 아래에서 추가해보세요!</p>
        {:else}
          {#each aiKnowledgeList as item}
            <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl border border-indigo-100 dark:border-indigo-800/60 shadow-sm">
              <span>💡 {item}</span>
              <button
                type="button"
                on:click={() => handleDeleteKnowledge(item)}
                class="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded ml-0.5"
                title="메모 삭제"
              >
                ✕
              </button>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Add Input Form -->
      <form on:submit|preventDefault={handleAddKnowledge} class="flex gap-2">
        <input
          type="text"
          bind:value={newKnowledgeText}
          placeholder="예: 엄마 매운음식 못드심, 분리수거 화요일"
          class="flex-1 min-w-0 px-3.5 py-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl text-xs sm:text-sm border border-indigo-100 dark:border-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
        />
        <button
          type="submit"
          disabled={!newKnowledgeText.trim() || isAddingKnowledge}
          class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-black shadow-md active:scale-95 transition-all shrink-0"
        >
          {isAddingKnowledge ? "저장 중..." : "추가"}
        </button>
      </form>
    </section>
  {/if}

  <!-- Floating AI Butler Button -->
  <button
    type="button"
    on:click={() => (isButlerOpen = true)}
    class="fixed bottom-24 right-5 sm:right-8 z-50 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white pl-3.5 pr-4 py-3 rounded-full shadow-2xl flex items-center gap-2 border-2 border-white/20 active:scale-95 transition-all group"
    aria-label="우리집 AI 집사 열기"
    in:fade={{ duration: 400 }}
  >
    <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg shadow-inner group-hover:rotate-12 transition-transform">
      🤖
    </div>
    <div class="text-left">
      <span class="block text-xs font-black leading-tight">AI 집사</span>
      <span class="block text-[9px] text-indigo-200 font-bold leading-tight">실시간 비서</span>
    </div>
    <span class="relative flex h-2 w-2 ml-0.5">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
    </span>
  </button>

  <!-- Family Butler Modal -->
  <FamilyButlerModal
    isOpen={isButlerOpen}
    onClose={() => (isButlerOpen = false)}
    {userName}
    {monthlyEvents}
    {dDayEvent}
    {dDayDiff}
    {monthCount}
    {monthUnsettledCount}
    {monthUnsettledAmount}
    {monthTotalAmount}
    {monthUnsettledItems}
    {todayCheckedIn}
    {attendanceStreak}
    {stockCount}
    {stockTotalAmount}
    {aiKnowledgeList}
  />
</div>

