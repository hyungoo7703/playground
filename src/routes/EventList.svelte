<script>
  import { onMount } from "svelte";
  import { fade, slide, fly } from "svelte/transition";
  import { api } from "../lib/api.js";
  import { formatDate } from "../lib/utils.js";
  import { isAdmin } from "../lib/store.js";
  import { readCache, writeCache } from "../lib/cache.js";
  import Spinner from "../lib/components/Spinner.svelte";

  let events = [];
  let isLoading = true;

  // Selected Category Filter
  let selectedCategory = "전체";

  // Form State
  let showFormModal = false;
  let newDate = formatDate(new Date());
  let newTitle = "";
  let newCategory = "일반";
  let isSubmitting = false;
  let editingId = null;

  // Active D-Day state
  let currentDDayId = null;
  let currentDDayTitle = "";

  const CATEGORIES = ["외식", "여행", "경조사", "병원", "일반"];
  const CATEGORY_EMOJIS = {
    외식: "🍽️",
    여행: "✈️",
    경조사: "🎂",
    병원: "🏥",
    일반: "📅",
  };

  const TITLE_SUGGESTIONS = [
    "가족 외식",
    "엄마 생신",
    "아빠 생신",
    "가족 여행",
    "병원 정기검진",
    "관리비 납부일",
  ];

  function loadDDay() {
    const stored = localStorage.getItem("dDayEvent");
    if (stored) {
      try {
        const ev = JSON.parse(stored);
        currentDDayId = ev.id;
        currentDDayTitle = ev.title;
      } catch {
        currentDDayId = null;
        currentDDayTitle = "";
      }
    } else {
      currentDDayId = null;
      currentDDayTitle = "";
    }
  }

  async function fetchEvents() {
    const cached = readCache("events");
    if (cached) {
      events = cached;
      isLoading = false;
    } else {
      isLoading = true;
    }

    const res = await api.getEvents();
    if (res.success) {
      events = res.events.sort((a, b) => a.date.localeCompare(b.date));
      writeCache("events", events);
    }
    isLoading = false;
  }

  function openAddModal() {
    editingId = null;
    newDate = formatDate(new Date());
    newTitle = "";
    newCategory = "일반";
    showFormModal = true;
  }

  function openEditModal(event) {
    editingId = event.id;
    newDate = event.date;
    newTitle = event.title;
    newCategory = event.category || "일반";
    showFormModal = true;
  }

  function setDateShortcut(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    newDate = formatDate(d);
  }

  function setWeekendShortcut() {
    const d = new Date();
    const day = d.getDay();
    const distToSat = (6 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + distToSat);
    newDate = formatDate(d);
  }

  async function handleSubmit() {
    if (!newDate || !newTitle.trim()) return alert("날짜와 일정 제목을 입력해주세요.");
    isSubmitting = true;

    const payload = {
      date: newDate,
      title: newTitle.trim(),
      category: newCategory,
    };

    if (editingId) payload.id = editingId;

    try {
      const result = editingId
        ? await api.updateEvent(payload)
        : await api.addEvent(payload);

      if (result.success) {
        showFormModal = false;
        await fetchEvents();
        loadDDay();
      } else {
        alert(result.message || "저장에 실패했습니다.");
      }
    } catch {
      alert("통신 오류가 발생했습니다.");
    } finally {
      isSubmitting = false;
    }
  }

  async function handleDelete(id) {
    if (!confirm("정말 이 일정을 삭제하시겠습니까?")) return;
    try {
      const res = await api.deleteEvent(id);
      if (res.success) {
        if (currentDDayId === id) {
          localStorage.removeItem("dDayEvent");
          loadDDay();
        }
        await fetchEvents();
      } else {
        alert("삭제 실패: " + res.message);
      }
    } catch {
      alert("통신 오류가 발생했습니다.");
    }
  }

  function toggleDDay(event) {
    if (currentDDayId === event.id) {
      localStorage.removeItem("dDayEvent");
      loadDDay();
      alert("홈 화면 D-Day 설정이 해제되었습니다.");
    } else {
      localStorage.setItem("dDayEvent", JSON.stringify(event));
      loadDDay();
      alert(`'${event.title}' 일정이 홈 화면 D-Day로 설정되었습니다! 🎉`);
    }
  }

  import { showLocalNotification } from "../lib/notification.js";

  // Push Notification State (Admin only)
  let showEventPushModal = false;
  let selectedPushEventId = null;
  let isSendingEventPush = false;

  $: todayStr = formatDate(new Date());
  $: upcomingEvents = events.filter((e) => e.date >= todayStr);
  $: nearestUpcomingEvent =
    upcomingEvents.length > 0
      ? upcomingEvents[0]
      : events.length > 0
        ? events[events.length - 1]
        : null;

  function generateEventPushMessage(event) {
    if (!event)
      return {
        title: "[가족 일정 알림] 📅",
        body: "가족 일정을 확인해보세요!",
        diffDays: 0,
      };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(event.date);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

    let timingPhrase = "";
    let pushTitle = `[가족 일정 알림] 📅`;

    if (diffDays === 0) {
      timingPhrase = `오늘은 '${event.title}' 날이에요! 🎉`;
      pushTitle = `[오늘의 가족 일정] 📅`;
    } else if (diffDays === 1) {
      timingPhrase = `내일은 '${event.title}' 날이에요! 잊지 마세요 ✨`;
      pushTitle = `[내일의 가족 일정] 📅`;
    } else if (diffDays === 2) {
      timingPhrase = `모레는 '${event.title}' 날이에요! 🗓️`;
      pushTitle = `[다가오는 가족 일정] 📅`;
    } else if (diffDays > 2) {
      timingPhrase = `${diffDays}일 뒤(${event.date.slice(5)})는 '${event.title}' 날이에요! 🗓️`;
      pushTitle = `[다가오는 가족 일정] 📅`;
    } else {
      timingPhrase = `'${event.title}' (${event.date.slice(5)}) 일정이 있습니다!`;
    }

    return {
      title: pushTitle,
      body: timingPhrase,
      diffDays,
    };
  }

  function openEventPushModal() {
    if (!$isAdmin) return alert("관리자만 일정을 푸쉬할 수 있습니다.");
    if (events.length === 0) return alert("등록된 일정이 없습니다.");
    selectedPushEventId = nearestUpcomingEvent
      ? nearestUpcomingEvent.id
      : events[0]?.id;
    showEventPushModal = true;
  }

  $: selectedPushEvent =
    events.find((e) => e.id === selectedPushEventId) || nearestUpcomingEvent;
  $: currentPushPreview = generateEventPushMessage(selectedPushEvent);

  async function sendEventPushToAll() {
    if (!selectedPushEvent) return alert("발송할 일정을 선택해주세요.");
    isSendingEventPush = true;

    const { title, body } = currentPushPreview;
    const targets = ["아빠", "엄마", "현구", "범수"];
    let successCount = 0;
    let serverMessages = [];

    // 현재 기기 로컬 알림 즉시 팝업
    showLocalNotification(title, { body });

    for (const target of targets) {
      try {
        const res = await api.sendPushNotification({
          target_user: target,
          title,
          body,
          url: `${window.location.origin}${window.location.pathname}#/events`,
        });
        if (res && res.success) {
          successCount++;
        } else if (res && res.message) {
          serverMessages.push(`${target}: ${res.message}`);
        }
      } catch (e) {
        serverMessages.push(`${target}: ${e.message}`);
      }
    }

    isSendingEventPush = false;
    showEventPushModal = false;

    if (serverMessages.length > 0 && successCount === 0) {
      alert(
        `[알림 발송 상태]\n서버 응답: ${serverMessages[0]}\n\n※ 상대방 기기가 '설정' 화면에서 '알림 허용 및 기기 등록'을 완료했는지 확인해주세요!`,
      );
    } else {
      alert(
        `가족 전체에게 푸쉬 알림을 발송했습니다! 🚀\n\n📢 ${title}\n💬 "${body}"`,
      );
    }
  }


  function getDDayLabel(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { text: "D-Day (오늘!)", isFuture: true, isToday: true };
    if (diffDays > 0) return { text: `D-${diffDays}`, isFuture: true, isToday: false };
    return { text: `${Math.abs(diffDays)}일 전`, isFuture: false, isToday: false };
  }

  function formatDisplayDate(dateStr) {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[d.getDay()];
    return { month, day, weekday };
  }

  onMount(() => {
    fetchEvents();
    loadDDay();
  });

  $: filteredEvents =
    selectedCategory === "전체"
      ? events
      : events.filter((e) => e.category === selectedCategory);

</script>

<div class="space-y-6 max-w-md mx-auto relative">
  <!-- Header Card -->
  <header
    class="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-rose-500 via-pink-600 to-indigo-600 p-7 text-white shadow-xl space-y-4"
  >
    <div class="relative z-10 space-y-2">
      <div class="flex justify-between items-center">
        <span class="text-pink-100 font-bold text-xs tracking-widest uppercase">
          Family Schedule
        </span>
        <span class="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
          총 {events.length}개 일정
        </span>
      </div>
      <h1 class="text-3xl font-black tracking-tight leading-tight">
        가족 일정 📅
      </h1>
      {#if currentDDayTitle}
        <div class="pt-2 border-t border-white/20 flex items-center justify-between text-xs">
          <span class="text-pink-100 font-medium">현재 홈 D-Day</span>
          <span class="font-bold bg-white/20 px-2.5 py-1 rounded-xl truncate max-w-[200px]">
            🎉 {currentDDayTitle}
          </span>
        </div>
      {/if}
    </div>

    <!-- Decor -->
    <div class="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
    <div class="absolute -left-8 -bottom-8 w-32 h-32 bg-pink-400/20 rounded-full blur-2xl"></div>
  </header>

  <!-- Admin Exclusive: Family Schedule Push & Add Event -->
  {#if $isAdmin}
    <div class="space-y-2.5">
      <button
        type="button"
        on:click={openEventPushModal}
        class="w-full p-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white rounded-3xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-between gap-3 text-left"
      >
        <div class="flex items-center gap-3">
          <span class="text-2xl p-2 bg-white/20 rounded-2xl backdrop-blur-md shrink-0">
            🔔
          </span>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-black tracking-wide">가족 전체에게 일정 푸쉬 보내기</span>
              <span class="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">나만 가능</span>
            </div>
            {#if nearestUpcomingEvent}
              {@const prev = generateEventPushMessage(nearestUpcomingEvent)}
              <p class="text-[11px] text-pink-100 font-medium truncate mt-0.5">
                미리보기: "{prev.body}"
              </p>
            {:else}
              <p class="text-[11px] text-pink-100 font-medium truncate mt-0.5">
                다가오는 일정 알림을 보냅니다
              </p>
            {/if}
          </div>
        </div>
        <span class="text-xs bg-white text-indigo-700 px-3 py-1.5 rounded-xl font-black shrink-0 shadow-sm">
          발송 ➔
        </span>
      </button>

      <button
        type="button"
        on:click={openAddModal}
        class="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 font-black text-xs"
      >
        <span>➕ 새 가족 일정 추가하기</span>
      </button>
    </div>
  {/if}


  <!-- Category Filter Pills -->
  <div class="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
    <button
      type="button"
      on:click={() => (selectedCategory = "전체")}
      class="px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all {selectedCategory ===
      '전체'
        ? 'bg-rose-500 text-white shadow-sm'
        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700'}"
    >
      전체보기
    </button>
    {#each CATEGORIES as cat}
      <button
        type="button"
        on:click={() => (selectedCategory = cat)}
        class="px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all {selectedCategory ===
        cat
          ? 'bg-rose-500 text-white shadow-sm'
          : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700'}"
      >
        {CATEGORY_EMOJIS[cat] || ""} {cat}
      </button>
    {/each}
  </div>

  <!-- Events List -->
  <div class="space-y-3">
    {#if isLoading}
      <div class="py-16 text-center">
        <Spinner label="가족 일정을 불러오는 중..." />
      </div>
    {:else if filteredEvents.length === 0}
      <div class="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400">
        <span class="text-4xl block mb-2">☕</span>
        <p class="text-sm font-bold text-gray-600 dark:text-gray-300">등록된 일정이 없습니다.</p>
        <p class="text-xs text-gray-400 mt-1">다가오는 생일이나 외식 일정을 등록해보세요!</p>
      </div>
    {:else}
      {#each filteredEvents as event (event.id)}
        {@const dDayInfo = getDDayLabel(event.date)}
        {@const dateInfo = formatDisplayDate(event.date)}
        {@const isDDayPinned = currentDDayId === event.id}
        {@const [mainTitle, ...subTitles] = event.title.split("(")}

        <div
          class="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-3 transition-all relative overflow-hidden group {isDDayPinned
            ? 'ring-2 ring-rose-400 bg-rose-50/20 dark:bg-rose-950/20'
            : ''}"
        >
          <!-- Date Badge Box -->
          <div
            class="flex flex-col items-center justify-center w-14 h-14 rounded-2xl shrink-0 {dDayInfo.isToday
              ? 'bg-rose-500 text-white shadow-md'
              : dDayInfo.isFuture
                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}"
          >
            <span class="text-[10px] font-bold uppercase leading-none">
              {dateInfo.month}월
            </span>
            <span class="text-xl font-black leading-tight">
              {dateInfo.day}
            </span>
            <span class="text-[9px] font-bold leading-none opacity-80">
              {dateInfo.weekday}요일
            </span>
          </div>

          <!-- Content Details -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {CATEGORY_EMOJIS[event.category] || "📅"} {event.category}
              </span>
              <span
                class="text-[10px] font-black px-2 py-0.5 rounded-full {dDayInfo.isToday
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200 animate-pulse'
                  : dDayInfo.isFuture
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-700'}"
              >
                {dDayInfo.text}
              </span>
            </div>

            <h3 class="font-black text-sm text-gray-900 dark:text-white truncate">
              {mainTitle.trim()}
            </h3>

            {#if subTitles.length > 0}
              <p class="text-[11px] text-gray-400 truncate mt-0.5">
                {subTitles.map((s) => s.replace(")", "").trim()).join(" ")}
              </p>
            {/if}
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 shrink-0">
            <!-- Pin as Home D-Day Button -->
            <button
              type="button"
              on:click={() => toggleDDay(event)}
              class="p-2 rounded-xl text-sm transition-all active:scale-90 {isDDayPinned
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-400 hover:text-rose-500'}"
              title={isDDayPinned ? "홈 D-Day 해제" : "홈 D-Day로 설정"}
            >
              {isDDayPinned ? "⭐" : "☆"}
            </button>

            {#if $isAdmin}
              <button
                type="button"
                on:click={() => openEditModal(event)}
                class="p-2 bg-gray-100 hover:bg-indigo-50 dark:bg-gray-700 dark:hover:bg-indigo-950 text-gray-400 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all"
                title="수정"
              >
                ✏️
              </button>
              <button
                type="button"
                on:click={() => handleDelete(event.id)}
                class="p-2 bg-gray-100 hover:bg-rose-50 dark:bg-gray-700 dark:hover:bg-rose-950 text-gray-400 hover:text-rose-500 rounded-xl text-xs font-bold transition-all"
                title="삭제"
              >
                🗑️
              </button>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Add / Edit Modal -->
  {#if showFormModal}
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      transition:fade
    >
      <div
        class="w-full max-w-sm max-h-[88vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl relative space-y-4"
        transition:slide={{ duration: 250, axis: "y" }}
      >
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-black text-gray-900 dark:text-white">
            {editingId ? "일정 수정" : "새 가족 일정 등록"}
          </h2>
          <button
            type="button"
            on:click={() => (showFormModal = false)}
            class="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold"
          >
            ✕
          </button>
        </div>

        <div class="space-y-4">
          <!-- Date Picker + Quick Buttons -->
          <div class="space-y-1.5">
            <label for="event-date" class="text-xs font-bold text-gray-400 dark:text-gray-500 block">
              날짜 선택
            </label>
            <input
              id="event-date"
              type="date"
              bind:value={newDate}
              class="w-full p-3.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-rose-500 border border-gray-200 dark:border-gray-700"
            />
            <div class="flex gap-1.5 pt-1">
              <button
                type="button"
                on:click={() => setDateShortcut(0)}
                class="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95"
              >
                오늘
              </button>
              <button
                type="button"
                on:click={() => setDateShortcut(1)}
                class="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95"
              >
                내일
              </button>
              <button
                type="button"
                on:click={setWeekendShortcut}
                class="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95"
              >
                이번 주말
              </button>
            </div>
          </div>

          <!-- Category Selection Chips -->
          <div>
            <span class="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1.5">
              분류
            </span>
            <div class="grid grid-cols-3 gap-1.5">
              {#each CATEGORIES as cat}
                <button
                  type="button"
                  on:click={() => (newCategory = cat)}
                  class="py-2 px-2.5 rounded-xl text-xs font-bold transition-all border {newCategory ===
                  cat
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}"
                >
                  {CATEGORY_EMOJIS[cat]} {cat}
                </button>
              {/each}
            </div>
          </div>

          <!-- Title Input + Suggestions -->
          <div class="space-y-1.5">
            <label for="event-title" class="text-xs font-bold text-gray-400 dark:text-gray-500 block">
              일정 내용
            </label>
            <input
              id="event-title"
              type="text"
              bind:value={newTitle}
              placeholder="예: 가족 외식 (저녁 7시)"
              class="w-full p-3.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-rose-500 border border-gray-200 dark:border-gray-700"
            />
            <div class="flex gap-1 overflow-x-auto pb-1 scrollbar-none pt-1">
              {#each TITLE_SUGGESTIONS as sugg}
                <button
                  type="button"
                  on:click={() => (newTitle = sugg)}
                  class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300 rounded-lg whitespace-nowrap hover:bg-rose-50 hover:text-rose-600"
                >
                  + {sugg}
                </button>
              {/each}
            </div>
          </div>
        </div>

        <div class="flex gap-2 pt-2">
          <button
            type="button"
            on:click={() => (showFormModal = false)}
            class="flex-1 py-3.5 font-bold text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-2xl active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            on:click={handleSubmit}
            disabled={isSubmitting}
            class="flex-1 py-3.5 font-black text-xs text-white bg-rose-500 hover:bg-rose-600 rounded-2xl shadow-md active:scale-95 disabled:opacity-40"
          >
            {isSubmitting ? "저장 중..." : editingId ? "수정 완료" : "일정 등록"}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Schedule Push Modal (Admin only) -->
  {#if showEventPushModal}
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      transition:fade
    >
      <div
        class="w-full max-w-sm max-h-[90vh] flex flex-col bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl relative space-y-4"
        transition:slide={{ duration: 250, axis: "y" }}
      >
        <div class="flex justify-between items-center shrink-0">
          <div>
            <h2 class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-1.5">
              🔔 가족 전체 일정 푸쉬 알림
            </h2>
            <p class="text-[11px] text-gray-400">
              시점에 맞춘 일정 알림 메시지가 가족 모두에게 전송됩니다.
            </p>
          </div>
          <button
            type="button"
            on:click={() => (showEventPushModal = false)}
            class="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold"
          >
            ✕
          </button>
        </div>

        <div class="space-y-4 overflow-y-auto flex-1 pr-1">
          <!-- Select Event -->
          <div class="space-y-1.5">
            <span class="text-xs font-bold text-gray-400 dark:text-gray-500 block">
              알림 보낼 일정 선택
            </span>
            <div class="space-y-2">
              {#each events as ev}
                {@const msg = generateEventPushMessage(ev)}
                <button
                  type="button"
                  on:click={() => (selectedPushEventId = ev.id)}
                  class="w-full p-3 rounded-2xl border text-left transition-all {selectedPushEventId === ev.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'}"
                >
                  <div class="flex justify-between items-center">
                    <span class="text-xs font-black text-gray-900 dark:text-white">
                      {ev.title}
                    </span>
                    <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-md">
                      {ev.date}
                    </span>
                  </div>
                  <p class="text-[11px] text-gray-500 dark:text-gray-300 mt-1 font-medium">
                    "{msg.body}"
                  </p>
                </button>
              {/each}
            </div>
          </div>

          <!-- Live Preview Box -->
          {#if selectedPushEvent}
            <div class="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-800 space-y-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                📱 푸쉬 알림 미리보기
              </span>
              <div class="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-indigo-50 dark:border-indigo-900/50 space-y-1">
                <p class="text-xs font-black text-gray-900 dark:text-white">
                  📢 {currentPushPreview.title}
                </p>
                <p class="text-xs text-gray-700 dark:text-gray-200 leading-relaxed font-medium">
                  {currentPushPreview.body}
                </p>
              </div>
              <p class="text-[10px] text-gray-400 text-center font-bold">
                👨‍👩‍👧‍👦 발송 대상: 아빠, 엄마, 현구, 범수 (전체 기기)
              </p>
            </div>
          {/if}
        </div>

        <div class="flex gap-2 shrink-0 pt-2">
          <button
            type="button"
            on:click={() => (showEventPushModal = false)}
            class="flex-1 py-3.5 font-bold text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-2xl active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            on:click={sendEventPushToAll}
            disabled={isSendingEventPush || !selectedPushEvent}
            class="flex-1 py-3.5 font-black text-xs text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-2xl shadow-lg active:scale-95 disabled:opacity-40"
          >
            {isSendingEventPush ? "전체 발송 중..." : "🚀 지금 가족 전체에게 발송"}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

