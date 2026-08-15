<script>
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { navigate } from "svelte-routing";
  import { base } from "../lib/store.js";
  import { api } from "../lib/api.js";
  import { formatDate } from "../lib/utils.js";
  import { readCache, writeCache } from "../lib/cache.js";

  let monthlyEvents = [];
  let isLoading = true;
  const userName = localStorage.getItem("userName") || "가족";
  const todayLabel = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // Ledger summary (bottom card)
  let monthCount = 0;
  let monthUnsettled = 0;
  let ledgerLoaded = false;

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

  function applyLedger(ledger) {
    const ym = formatDate(new Date()).slice(0, 7);
    const monthItems = ledger.filter((i) => String(i.date).startsWith(ym));
    monthCount = monthItems.length;
    monthUnsettled = monthItems.filter(
      (i) => !i.is_settled || i.is_settled === "FALSE",
    ).length;
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

  function navigateTo(page) {
    navigate(`${base}/${page}`);
  }

  function getDay(dateString) {
    return new Date(dateString).getDate();
  }
</script>

<div class="space-y-6 max-w-md mx-auto">

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

  <!-- 우리 가족 주식 요약 위젯 -->
  <section in:fly={{ y: 20, delay: 450 }}>
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
            총 {monthCount}건{monthUnsettled > 0
              ? ` · 미정산 ${monthUnsettled}건`
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
</div>

