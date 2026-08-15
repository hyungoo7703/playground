<script>
    import { onMount } from "svelte";
    import { fade, fly, scale } from "svelte/transition";
    import { navigate } from "svelte-routing";
    import { base, currentUser } from "../lib/store.js";
    import { api } from "../lib/api.js";
    import { formatDate } from "../lib/utils.js";
    import { readCache, writeCache } from "../lib/cache.js";

    let attendance = [];
    let ledgerItems = [];
    let isLoading = true;
    let todayChecked = false;
    let isSubmitting = false;
    let toastMessage = "";
    let toastType = "success";
    let showRules = false;

    // Reward usage modal
    let showUseRewardModal = false;
    let useAmount = "";
    let useDescription = "";
    let isUseSubmitting = false;

    // 100-day streak celebration
    let show100Modal = false;
    let cardPickAvailable = false;
    let cardPickKey = "";
    $: cardPickKey = `attendance_100day_cardpick_${$currentUser}`;

    // Calendar state
    let currentDate = new Date();
    $: currentYear = currentDate.getFullYear();
    $: currentMonth = currentDate.getMonth();
    $: monthName = currentDate.toLocaleString("ko-KR", { month: "long" });
    $: daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    $: firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    $: calendarDays = buildCalendarDays(daysInMonth, firstDayOfMonth);

    const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

    // Stamp emojis - randomly assigned per day for fun
    const STAMPS = ["🌟", "⭐", "🏅", "🎖️", "💮", "🌸", "✨", "💯"];

    function buildCalendarDays(total, startDay) {
        const days = [];
        for (let i = 0; i < startDay; i++) days.push(null);
        for (let d = 1; d <= total; d++) days.push(d);
        return days;
    }

    $: currentMonthAttendanceCount = myAttendanceDays.size;
    $: progressPercentage = (currentMonthAttendanceCount / daysInMonth) * 100;

    // Get attendance dates for current month (as Set of day numbers)
    $: myAttendanceDays = new Set(
        attendance
            .filter((a) => {
                const d = new Date(a.date);
                return (
                    d.getFullYear() === currentYear &&
                    d.getMonth() === currentMonth &&
                    a.user_name === $currentUser
                );
            })
            .map((a) => new Date(a.date).getDate()),
    );

    // All family members' attendance for current month
    $: familyAttendanceToday = attendance.filter((a) => {
        const today = formatDate(new Date());
        return a.date === today;
    });

    // Streak calculation
    $: streak = calcStreak(attendance, $currentUser);

    // Reward calculation
    $: myRecords = attendance.filter((a) => a.user_name === $currentUser);

    // 갓챠 보상 시스템
    const GACHA_REWARDS = [50, 100, 200, 300]; // 일일 (각 25%)
    const PERFECT_GACHA_REWARDS = [500, 900, 1400]; // 올출석 보너스 (각 33%)

    function hashStr(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    // 해시 개선 기준 날짜: 이전 기록은 구 해시, 이후는 신 해시
    const GACHA_FIX_DATE = "2026-03-03";

    function getGachaReward(dateStr, userName) {
        if (dateStr < GACHA_FIX_DATE) {
            // 기존 해시 (호환성 유지)
            return GACHA_REWARDS[hashStr(dateStr + userName) % 4];
        }
        // 개선된 해시: 유저별 다른 보상
        let seed = "";
        const maxLen = Math.max(dateStr.length, userName.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < userName.length) seed += userName[i];
            if (i < dateStr.length) seed += dateStr[i];
        }
        return GACHA_REWARDS[hashStr(seed) % 4];
    }

    function getPerfectBonus(year, month, userName) {
        if (year < 2026 || (year === 2026 && month < 2)) {
            // 기존 해시 (2026년 3월 이전)
            return PERFECT_GACHA_REWARDS[
                hashStr(`perfect-${year}-${month}-${userName}`) % 3
            ];
        }
        return PERFECT_GACHA_REWARDS[
            hashStr(`${userName}-perfect-${year}-${month}-${userName}`) % 3
        ];
    }

    function calcEarned(records) {
        // Group by year-month, keeping actual dates
        const monthMap = {};
        records.forEach((a) => {
            const d = new Date(a.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!monthMap[key])
                monthMap[key] = {
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    dates: new Map(),
                };
            // Store date string -> user_name for gacha calc
            monthMap[key].dates.set(d.getDate(), a.date);
        });

        const userName = $currentUser;
        let total = 0;
        Object.values(monthMap).forEach(({ year, month, dates }) => {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const now = new Date();
            const isCurrentMonth =
                year === now.getFullYear() && month === now.getMonth();

            if (!isCurrentMonth && dates.size === daysInMonth) {
                // 올출석: 갓챠 합산 + 올출석 보너스 갓챠
                let gachaSum = 0;
                dates.forEach((dateStr) => {
                    gachaSum += getGachaReward(dateStr, userName);
                });
                total += gachaSum + getPerfectBonus(year, month, userName);
            } else {
                dates.forEach((dateStr) => {
                    total += getGachaReward(dateStr, userName);
                });
            }
        });

        return total;
    }

    $: totalEarned = calcEarned(myRecords);
    $: totalUsed = ledgerItems
        .filter(
            (item) =>
                item.title &&
                item.title.startsWith("보상지급") &&
                item.receiver === $currentUser,
        )
        .reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);
    $: rewardBalance = totalEarned - totalUsed;

    // Reward usage history (from ledger)
    $: usageHistory = ledgerItems
        .filter(
            (item) =>
                item.title &&
                item.title.startsWith("보상지급") &&
                item.receiver === $currentUser,
        )
        .map((item) => ({
            date: item.date,
            amount: parseInt(item.amount) || 0,
            desc: item.title.replace("보상지급 (", "").replace(")", ""),
        }))
        .reverse();

    // formatDate는 lib/utils.js에서 import

    function calcStreak(data, user) {
        const userDates = data
            .filter((a) => a.user_name === user)
            .map((a) => a.date)
            .sort()
            .reverse();

        if (userDates.length === 0) return 0;

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < userDates.length; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const checkStr = formatDate(checkDate);
            if (userDates.includes(checkStr)) {
                streak++;
            } else {
                break;
            }
        }
        return streak;
    }

    function getStampForDay(day) {
        // Deterministic "random" stamp based on day + month
        const seed = day * 31 + currentMonth * 7 + currentYear;
        return STAMPS[seed % STAMPS.length];
    }

    function prevMonth() {
        currentDate = new Date(currentYear, currentMonth - 1, 1);
    }

    function nextMonth() {
        const now = new Date();
        // Don't go past current month
        if (
            currentYear < now.getFullYear() ||
            (currentYear === now.getFullYear() && currentMonth < now.getMonth())
        ) {
            currentDate = new Date(currentYear, currentMonth + 1, 1);
        }
    }

    async function doCheckIn() {
        if (todayChecked || isSubmitting) return;
        isSubmitting = true;

        try {
            const result = await api.addAttendance({
                user_name: $currentUser,
                message: "",
            });

            if (result.success) {
                todayChecked = true;
                const refreshed = await api.getAttendance();
                if (refreshed.success) attendance = refreshed.attendance || [];

                // 올출석 보너스 체크: 지난달 올출석이면 알림
                const now = new Date();
                const lastMonth =
                    now.getMonth() === 0 ? 11 : now.getMonth() - 1;
                const lastMonthYear =
                    now.getMonth() === 0
                        ? now.getFullYear() - 1
                        : now.getFullYear();
                const daysInLastMonth = new Date(
                    lastMonthYear,
                    lastMonth + 1,
                    0,
                ).getDate();
                const lastMonthDays = (
                    refreshed.success ? refreshed.attendance || [] : attendance
                )
                    .filter((a) => a.user_name === $currentUser)
                    .filter((a) => {
                        const d = new Date(a.date);
                        return (
                            d.getFullYear() === lastMonthYear &&
                            d.getMonth() === lastMonth
                        );
                    }).length;

                // 올출석 보너스 알림: 이번 달 첫 출석일 때만 표시
                const refreshedRecords = refreshed.success
                    ? refreshed.attendance || []
                    : attendance;
                const thisMonthCount = refreshedRecords.filter((a) => {
                    const d = new Date(a.date);
                    return (
                        a.user_name === $currentUser &&
                        d.getFullYear() === now.getFullYear() &&
                        d.getMonth() === now.getMonth()
                    );
                }).length;

                const todayReward = getGachaReward(
                    formatDate(new Date()),
                    $currentUser,
                );
                const perfectBonus = getPerfectBonus(
                    lastMonthYear,
                    lastMonth,
                    $currentUser,
                );
                if (lastMonthDays === daysInLastMonth && thisMonthCount === 1) {
                    showToast(
                        `🎉 출석 완료! +${todayReward}원 🎰 | 올출석 보너스 +${perfectBonus.toLocaleString()}원 🌟`,
                        "success",
                    );
                } else {
                    showToast(
                        `출석 완료! +${todayReward}원 보상 획득! 🎰`,
                        "success",
                    );
                }

                // 100일 연속 출석 축하 모달 (연속 깨지면 리셋)
                const newStreak = calcStreak(
                    refreshed.success ? refreshed.attendance || [] : attendance,
                    $currentUser,
                );

                // Add server-side or ledger validation to prevent multiple claims
                const hasClaimed100DayReward = ledgerItems.some(
                    (item) =>
                        item.receiver === $currentUser &&
                        item.title &&
                        item.title.includes("100일 연속 출석"),
                );

                const celebrated100Key = `attendance_100day_${$currentUser}`;

                if (
                    newStreak >= 100 &&
                    !localStorage.getItem(celebrated100Key) &&
                    !hasClaimed100DayReward
                ) {
                    localStorage.setItem(celebrated100Key, "true");
                    localStorage.setItem(
                        `attendance_100day_cardpick_${$currentUser}`,
                        "available",
                    );

                    // Add automatic ledger record for transparency so it isn't claimed twice on another device
                    await api.addLedger({
                        date: formatDate(new Date()),
                        day: new Date().getDate(),
                        type: "기타",
                        title: `100일 연속 출석 달성 🏆`,
                        amount: 0,
                        giver: "시스템",
                        receiver: $currentUser,
                        is_settled: true,
                    });

                    const refreshedLedger = await api.getLedger();
                    if (refreshedLedger.success)
                        ledgerItems = refreshedLedger.ledger || [];

                    cardPickAvailable = true;
                    setTimeout(() => {
                        show100Modal = true;
                    }, 800);
                }
            } else {
                showToast(result.message || "출석에 실패했습니다.", "error");
            }
        } catch (e) {
            showToast("오류가 발생했습니다.", "error");
        } finally {
            isSubmitting = false;
        }
    }

    async function submitUseReward() {
        const amt = parseInt(String(useAmount).replace(/[^\d]/g, ""), 10);
        if (!amt || amt <= 0) return showToast("금액을 입력해주세요.", "error");
        if (amt > rewardBalance)
            return showToast(
                `잔액이 부족합니다. (잔액: ${rewardBalance}원)`,
                "error",
            );
        if (!useDescription.trim())
            return showToast("사용 목적을 입력해주세요.", "error");

        isUseSubmitting = true;
        try {
            const today = formatDate(new Date());
            const result = await api.addLedger({
                date: today,
                day: new Date().getDate(),
                type: "이체",
                title: `보상지급 (${useDescription.trim()})`,
                amount: amt,
                giver: "현구",
                receiver: $currentUser,
                is_settled: false,
            });

            if (result.success) {
                showUseRewardModal = false;
                useAmount = "";
                useDescription = "";
                showToast(
                    `${amt}원 보상 사용 완료! 장부에 기록됨 💰`,
                    "success",
                );
                // Refresh ledger data
                const refreshed = await api.getLedger();
                if (refreshed.success) ledgerItems = refreshed.ledger || [];
            } else {
                showToast(
                    result.message || "보상 사용에 실패했습니다.",
                    "error",
                );
            }
        } catch (e) {
            showToast("오류가 발생했습니다.", "error");
        } finally {
            isUseSubmitting = false;
        }
    }

    function showToast(msg, type = "success") {
        toastMessage = msg;
        toastType = type;
        setTimeout(() => (toastMessage = ""), 3000);
    }

    onMount(async () => {
        // 캐시 먼저 그리고, 뒤에서 갱신 (SWR)
        const cachedAtt = readCache("attendance");
        const cachedLedger = readCache("ledger");
        if (cachedAtt) {
            attendance = cachedAtt;
            const today = formatDate(new Date());
            todayChecked = attendance.some(
                (a) => a.date === today && a.user_name === $currentUser,
            );
        }
        if (cachedLedger) ledgerItems = cachedLedger;
        if (cachedAtt && cachedLedger) isLoading = false;

        try {
            const [attResult, ledgerResult] = await Promise.all([
                api.getAttendance(),
                api.getLedger(),
            ]);

            if (attResult.success) {
                attendance = attResult.attendance || [];
                writeCache("attendance", attendance);
                const today = formatDate(new Date());
                todayChecked = attendance.some(
                    (a) => a.date === today && a.user_name === $currentUser,
                );
            }

            if (ledgerResult.success) {
                ledgerItems = ledgerResult.ledger || [];
                writeCache("ledger", ledgerItems);
            }
        } catch (e) {
            console.error("출석 데이터 로드 실패:", e);
        } finally {
            isLoading = false;
        }

        // Check for unused card pick opportunity
        const cpKey = `attendance_100day_cardpick_${$currentUser}`;
        if (localStorage.getItem(cpKey) === "available") {
            cardPickAvailable = true;
        }
    });
</script>

<div class="space-y-6 max-w-md mx-auto">

    <!-- Header -->
    <header
        class="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-8 text-white shadow-2xl"
    >
        <div class="relative z-10">
            <span
                class="text-amber-100 font-bold text-xs tracking-widest uppercase block mb-1"
                >Daily Check-in</span
            >
            <h1 class="text-3xl font-black leading-tight">출석체크 📅</h1>
            <div class="mt-3 flex items-center gap-2 flex-wrap">
                {#if isLoading}
                    <div
                        class="flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-2xl px-4 py-2"
                    >
                        <span class="text-sm opacity-80 animate-pulse"
                            >⏳ 보상 파악중...</span
                        >
                    </div>
                {:else}
                    {#if streak > 0}
                        <div
                            class="flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-2xl px-4 py-2"
                        >
                            <span class="text-2xl">🔥</span>
                            <span class="font-black text-lg">{streak}일</span>
                            <span class="text-sm opacity-90">연속!</span>
                        </div>
                    {/if}
                    {#if rewardBalance > 0}
                        <div
                            class="flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-2xl px-4 py-2"
                        >
                            <span class="text-2xl">💰</span>
                            <span class="font-black text-lg"
                                >{rewardBalance.toLocaleString()}원</span
                            >
                        </div>
                    {/if}
                {/if}
            </div>

            <!-- Progress Bar -->
            <div
                class="mt-5 bg-black/20 rounded-full h-2 overflow-hidden shadow-inner flex shrink-0 w-full"
            >
                <div
                    class="bg-white h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-1"
                    style="width: {progressPercentage}%"
                >
                    {#if progressPercentage > 10}
                        <div
                            class="w-1 h-1 bg-amber-500 rounded-full opacity-50"
                        ></div>
                    {/if}
                </div>
            </div>
            <div
                class="mt-1.5 flex justify-between text-[10px] font-bold text-amber-100/90 w-full"
            >
                <span>이번 달 달성률</span>
                <span>{currentMonthAttendanceCount} / {daysInMonth}일</span>
            </div>
        </div>
        <div
            class="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"
        ></div>
        <div
            class="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl"
        ></div>
    </header>

    <!-- Reward Rules Info -->
    <section
        class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800/40"
    >
        <button
            on:click={() => (showRules = !showRules)}
            class="w-full flex items-center justify-between outline-none shrink-0 cursor-pointer active:scale-[0.98] transition-all"
        >
            <div class="flex items-center gap-2">
                <span class="text-lg">💡</span>
                <span
                    class="font-bold text-amber-700 dark:text-amber-300 text-sm"
                    >보상 규칙 확인하기</span
                >
            </div>
            <span
                class="text-amber-600 dark:text-amber-400 transition-transform duration-300 text-xs {showRules
                    ? 'rotate-180'
                    : ''}">▼</span
            >
        </button>
        {#if showRules}
            <div
                class="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/30 text-xs text-amber-700 dark:text-amber-300 space-y-2"
                transition:fade={{ duration: 200 }}
            >
                <p>
                    🎰 매일 출석 시 <strong>50~300원</strong> 랜덤 적립 (50/100/200/300원)
                </p>
                <p>
                    🌟 한 달 올출석 시 <strong>+500/900/1,400원</strong> 랜덤 보너스
                </p>
                <p>
                    🏆 100일 연속 출석 시 <strong>용돈카드 뽑기 기회</strong> 제공
                    (1회)
                </p>
            </div>
        {/if}
    </section>

    <!-- Card Pick Reminder Banner -->
    {#if cardPickAvailable}
        <section>
            <button
                on:click={() => {
                    localStorage.setItem(cardPickKey, "used");
                    cardPickAvailable = false;
                    navigate(`${base}/card-pick`);
                }}
                class="w-full flex items-center justify-between p-5 rounded-[2rem] bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg active:scale-[0.98] transition-all"
            >
                <div class="text-left">
                    <h3 class="font-black text-lg">🏆 100일 연속 출석 보상!</h3>
                    <p class="text-xs opacity-80">
                        용돈카드 뽑기 기회가 남아있어요! 터치하세요!
                    </p>
                </div>
                <span class="text-3xl">🃏</span>
            </button>
        </section>
    {/if}

    <!-- Check-in Button -->
    <section>
        <button
            on:click={doCheckIn}
            disabled={todayChecked || isSubmitting || isLoading}
            class="w-full relative overflow-hidden rounded-[2.5rem] p-6 shadow-xl transition-all active:scale-[0.98]
            {isLoading
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                : todayChecked
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800/50'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white ' +
                    (!isSubmitting ? 'animate-pulse hover:animate-none' : '')}"
        >
            {#if isLoading}
                <div class="flex items-center justify-center gap-4">
                    <span class="text-3xl animate-pulse">📅</span>
                    <div class="text-left">
                        <p class="font-black text-lg">출석여부 파악중...</p>
                        <p class="text-[11px] opacity-80 font-bold">
                            잠시만 기다려주세요 ⏳
                        </p>
                    </div>
                </div>
            {:else if todayChecked}
                <div class="flex items-center justify-center gap-4">
                    <div
                        class="w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm"
                        in:scale={{ duration: 500, delay: 100 }}
                    >
                        <span class="text-2xl">🎉</span>
                    </div>
                    <div class="text-left">
                        <p
                            class="font-black text-lg text-emerald-600 dark:text-emerald-400"
                        >
                            오늘 출석 완료!
                        </p>
                        <p
                            class="text-xs font-bold text-emerald-600/60 dark:text-emerald-400/60"
                        >
                            내일도 잊지 말고 와주세요~
                        </p>
                    </div>
                </div>
            {:else if isSubmitting}
                <div class="flex items-center justify-center gap-4">
                    <div
                        class="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"
                    ></div>
                    <div class="text-left">
                        <p class="font-black text-lg">출석 중...</p>
                        <p class="text-[11px] opacity-80 font-bold">
                            잠시만 기다려주세요 ⏳
                        </p>
                    </div>
                </div>
            {:else}
                <div
                    class="relative z-10 flex items-center justify-center gap-4"
                >
                    <span class="text-4xl animate-bounce">👋</span>
                    <div class="text-left">
                        <p class="font-black text-xl">출석하기!</p>
                        <p class="text-[11px] font-bold opacity-80">
                            이곳을 터치하여 출석을 완료하세요
                        </p>
                    </div>
                </div>
                <div
                    class="absolute -right-4 -bottom-4 w-20 h-20 bg-white/20 rounded-full blur-xl"
                ></div>
            {/if}
        </button>
    </section>

    <!-- Calendar -->
    <section
        class="p-6 bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-50 dark:border-gray-700"
    >
        <!-- Month Navigation -->
        <div class="flex items-center justify-between mb-6">
            <button
                on:click={prevMonth}
                class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 active:scale-90 transition-all"
            >
                <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M15 19l-7-7 7-7"
                    /></svg
                >
            </button>
            <h2 class="text-xl font-black text-gray-900 dark:text-white">
                {currentYear}년 {monthName}
            </h2>
            <button
                on:click={nextMonth}
                class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 active:scale-90 transition-all"
            >
                <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M9 5l7 7-7 7"
                    /></svg
                >
            </button>
        </div>

        <!-- Weekday Headers -->
        <div class="grid grid-cols-7 gap-1 mb-2">
            {#each WEEKDAYS as day, i}
                <div
                    class="text-center text-[11px] font-extrabold py-1
            {i === 0
                        ? 'text-rose-400'
                        : i === 6
                          ? 'text-blue-400'
                          : 'text-gray-400'}"
                >
                    {day}
                </div>
            {/each}
        </div>

        <!-- Calendar Grid -->
        <div class="grid grid-cols-7 gap-1">
            {#each calendarDays as day, i}
                {#if day === null}
                    <div
                        class="aspect-square bg-gray-50/50 dark:bg-gray-800/50 rounded-xl"
                    ></div>
                {:else}
                    {@const isToday =
                        day === new Date().getDate() &&
                        currentMonth === new Date().getMonth() &&
                        currentYear === new Date().getFullYear()}
                    {@const hasStamp = myAttendanceDays.has(day)}
                    {@const isSunday = i % 7 === 0}
                    {@const isSaturday = i % 7 === 6}
                    {@const textColor = isToday
                        ? "text-orange-600 dark:text-orange-400"
                        : isSunday
                          ? "text-rose-400/90 dark:text-rose-400/80"
                          : isSaturday
                            ? "text-blue-400/90 dark:text-blue-400/80"
                            : "text-gray-600 dark:text-gray-400"}
                    <div
                        class="aspect-square flex flex-col items-center justify-center rounded-xl text-sm relative transition-all
              {isToday
                            ? 'bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-400 shadow-sm z-10'
                            : 'bg-gray-50/30 dark:bg-gray-700/10'}
              {hasStamp
                            ? 'bg-amber-50/70 dark:bg-amber-900/20 shadow-inner'
                            : ''}"
                    >
                        <span
                            class="text-[11px] font-bold leading-none {textColor} {hasStamp
                                ? 'opacity-90'
                                : ''}"
                        >
                            {day}
                        </span>
                        {#if hasStamp}
                            <span
                                class="text-lg leading-none mt-0.5"
                                in:scale={{ duration: 300 }}
                                >{getStampForDay(day)}</span
                            >
                        {/if}
                    </div>
                {/if}
            {/each}
        </div>
    </section>

    <!-- Today's Family Check-ins -->
    {#if familyAttendanceToday.length > 0}
        <section
            class="p-6 bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-50 dark:border-gray-700"
        >
            <h2
                class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4"
            >
                <span class="w-1.5 h-5 bg-orange-500 rounded-full"></span>
                오늘의 출석 현황
            </h2>
            <div class="flex flex-wrap gap-4">
                {#each familyAttendanceToday as item}
                    <div class="flex flex-col items-center gap-1.5">
                        <div
                            class="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-400 to-teal-500 text-white font-black text-lg shadow-md border-2 border-white dark:border-gray-800 relative"
                        >
                            {item.user_name?.charAt(0)}
                            <div
                                class="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-[2px] shadow-sm"
                            >
                                <span class="text-[10px] leading-none block"
                                    >✨</span
                                >
                            </div>
                        </div>
                        <span
                            class="text-[11px] font-bold text-gray-700 dark:text-gray-300"
                            >{item.user_name}</span
                        >
                        <span class="text-[9px] text-gray-400 font-bold"
                            >{item.timestamp?.split(" ")[1]?.substring(0, 5) ||
                                "오늘"}</span
                        >
                    </div>
                {/each}
            </div>
        </section>
    {/if}

    <!-- Reward Wallet -->
    <section
        class="p-6 bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-50 dark:border-gray-700"
    >
        <h2
            class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4"
        >
            <span class="w-1.5 h-5 bg-amber-500 rounded-full"></span>
            보상 지갑
        </h2>
        <div class="flex items-center justify-between mb-4">
            <div>
                <p class="text-xs text-gray-400 font-bold">사용 가능 잔액</p>
                {#if isLoading}
                    <p
                        class="text-lg font-bold text-gray-400 animate-pulse mt-1"
                    >
                        ⏳ 계산 중...
                    </p>
                {:else}
                    <p
                        class="text-3xl font-black text-gray-900 dark:text-white"
                    >
                        {rewardBalance.toLocaleString()}<span
                            class="text-sm font-bold text-gray-400">원</span
                        >
                    </p>
                    <p class="text-[10px] text-gray-400 mt-1">
                        총 적립 {totalEarned.toLocaleString()}원 · 사용 {totalUsed.toLocaleString()}원
                    </p>
                {/if}
            </div>
            <button
                on:click={() => {
                    useAmount = "";
                    useDescription = "";
                    showUseRewardModal = true;
                }}
                disabled={rewardBalance <= 0 || isLoading}
                class="px-5 py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-40"
            >
                보상 사용 🎁
            </button>
        </div>

        {#if usageHistory.length > 0}
            <div
                class="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3"
            >
                <p class="text-xs font-bold text-gray-400 mb-2">사용 내역</p>
                <ul class="space-y-2">
                    {#each usageHistory as u}
                        <li
                            class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded-xl"
                        >
                            <div>
                                <span
                                    class="text-sm font-bold text-gray-800 dark:text-gray-200"
                                    >{u.desc}</span
                                >
                                <span class="text-[10px] text-gray-400 ml-2"
                                    >{u.date}</span
                                >
                            </div>
                            <span class="text-sm font-black text-rose-500"
                                >-{u.amount.toLocaleString()}원</span
                            >
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}
    </section>
</div>

<!-- Reward Use Modal -->
{#if showUseRewardModal}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-label="보상 사용 모달"
        on:click|self={() => (showUseRewardModal = false)}
        on:keydown={(e) => e.key === "Escape" && (showUseRewardModal = false)}
        transition:fade={{ duration: 200 }}
    >
        <div
            class="w-full max-w-sm bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-2xl"
            in:scale={{ duration: 300, start: 0.9 }}
        >
            <h3 class="text-xl font-black text-gray-900 dark:text-white mb-1">
                보상 사용하기 🎁
            </h3>
            <p class="text-sm text-gray-500 mb-5">
                잔액: <span class="font-bold text-amber-600"
                    >{rewardBalance.toLocaleString()}원</span
                >
            </p>

            <div class="space-y-3">
                <input
                    type="number"
                    bind:value={useAmount}
                    placeholder="사용할 금액 (예: 500)"
                    class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl text-lg font-black focus:outline-none focus:ring-2 focus:ring-rose-400 dark:text-white"
                />
                <input
                    type="text"
                    bind:value={useDescription}
                    placeholder="사용 목적 (예: 커피값)"
                    class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-400 dark:text-white"
                />
            </div>

            <div class="flex gap-3 mt-5">
                <button
                    on:click={() => (showUseRewardModal = false)}
                    class="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 active:scale-95 transition-all"
                >
                    취소
                </button>
                <button
                    on:click={submitUseReward}
                    disabled={isUseSubmitting}
                    class="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-rose-500 to-pink-500 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                    {#if isUseSubmitting}
                        <span
                            class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                        ></span>
                    {:else}
                        사용하기
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- 100-Day Streak Celebration Modal -->
{#if show100Modal}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-label="100일 연속 출석 축하 모달"
        on:click|self={() => (show100Modal = false)}
        on:keydown={(e) => e.key === "Escape" && (show100Modal = false)}
        transition:fade={{ duration: 300 }}
    >
        <div
            class="w-full max-w-sm bg-gradient-to-b from-amber-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-[2.5rem] p-8 shadow-2xl text-center"
            in:scale={{ duration: 500, start: 0.5 }}
        >
            <div class="text-6xl mb-4 animate-bounce">🎉</div>
            <h3 class="text-2xl font-black text-gray-900 dark:text-white mb-2">
                축하합니다! 🏆
            </h3>
            <p
                class="text-lg font-bold text-amber-600 dark:text-amber-400 mb-1"
            >
                100일 연속 출석 달성!
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
                대단한 끈기에요! 🔥<br />특별 보상으로 용돈카드 뽑기 기회를
                드려요! <br />따로 저장되지 않기 때문에
                <b>현구를 호출하세요!</b>
            </p>

            <div class="flex flex-col gap-3">
                <button
                    on:click={() => {
                        show100Modal = false;
                        localStorage.setItem(cardPickKey, "used");
                        cardPickAvailable = false;
                        navigate(`${base}/card-pick`);
                    }}
                    class="w-full py-4 rounded-2xl font-black text-white text-lg bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 active:scale-95 transition-all shadow-lg"
                >
                    🃏 용돈카드 뽑으러 가기!
                </button>
                <button
                    on:click={() => (show100Modal = false)}
                    class="w-full py-3 rounded-2xl font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 active:scale-95 transition-all"
                >
                    나중에
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Toast -->
{#if toastMessage}
    <div
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm max-w-[90vw]
      {toastType === 'success'
            ? 'bg-green-500 text-white'
            : 'bg-red-500 text-white'}"
        in:fly={{ y: 30, duration: 300 }}
        out:fade={{ duration: 200 }}
    >
        {toastMessage}
    </div>
{/if}
