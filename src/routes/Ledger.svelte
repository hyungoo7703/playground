<script>
  import { onMount } from "svelte";
  import { fade, slide } from "svelte/transition";
  import { api } from "../lib/api.js";
  import { formatDate } from "../lib/utils.js";
  import { readCache, writeCache } from "../lib/cache.js";
  import { currentUser, isAdmin } from "../lib/store.js";
  import { showLocalNotification } from "../lib/notification.js";
  import Spinner from "../lib/components/Spinner.svelte";


  let ledgerItems = [];
  let isLoading = true;
  let showForm = false;
  let isSubmitting = false;

  // Form State
  let formData = {
    id: null,
    date: formatDate(new Date()),
    type: "이체",
    title: "",
    amount: "",
    giver: "나",
    receiver: "가족",
    is_settled: false,
  };

  const USERS = ["아빠", "엄마", "현구", "범수"];
  const TYPES = ["이체", "지출", "수입"];

  async function loadLedger() {
    const cached = readCache("ledger");
    if (cached) {
      ledgerItems = cached.sort((a, b) => new Date(a.date) - new Date(b.date));
      isLoading = false;
    } else {
      isLoading = true;
    }

    const res = await api.getLedger();
    if (res.success) {
      ledgerItems = res.ledger.sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      );
      writeCache("ledger", ledgerItems);
    } else if (!cached) {
      alert("장부 불러오기 실패: " + (res.message || "알 수 없는 오류"));
    }
    isLoading = false;
  }

  let viewAsUser = USERS.includes($currentUser) ? $currentUser : "현구";
  let showOnlyMine = false;


  // Fixed Rules State
  let rules = [];
  let showRuleModal = false;
  let isRuleSubmitting = false;
  let isBatchSubmitting = false;
  let newRuleDay = 25;
  let newRuleTitle = "범수 정기입금(생활비 + 투자)";
  let newRuleAmount = "";
  let newRuleGiver = "범수";
  let newRuleReceiver = "엄마";

  // Async Action Loading Feedback States
  let settlingId = null;
  let isDeleting = false;
  let deletingRuleId = null;

  onMount(() => {
    loadLedger();
  });

  async function openRuleModal() {
    if (!$isAdmin) return alert("관리자만 접근할 수 있습니다.");
    showRuleModal = true;
    isLoading = true;
    const res = await api.getRules();
    if (res.success) {
      rules = res.rules;
    } else {
      rules = [];
    }
    isLoading = false;
  }

  function addRuleAmount(val) {
    const current = cleanAmount(newRuleAmount);
    newRuleAmount = String(current + val);
  }


  async function handleAddRule() {
    const ruleAmount = cleanAmount(newRuleAmount);
    if (!newRuleTitle.trim() || !ruleAmount)
      return alert("내역 이름과 금액을 모두 입력해주세요.");

    isRuleSubmitting = true;
    const payload = {
      day: parseInt(newRuleDay) || 25,
      title: newRuleTitle.trim(),
      amount: ruleAmount,
      giver: newRuleGiver,
      receiver: newRuleReceiver,
      type: "이체",
    };

    const res = await api.addRule(payload);
    if (res.success) {
      newRuleTitle = "범수 정기입금(생활비 + 투자)";
      newRuleAmount = "";
      const r = await api.getRules();
      if (r.success) rules = r.rules;
    } else {
      alert("고정 규칙 등록 실패: " + res.message);
    }
    isRuleSubmitting = false;
  }


  async function handleDeleteRule(id) {
    if (!confirm("고정 내역을 삭제하시겠습니까?")) return;
    deletingRuleId = id;
    try {
      const res = await api.deleteRule(id);
      if (res.success) {
        const r = await api.getRules();
        if (r.success) rules = r.rules;
      } else {
        alert("삭제 실패: " + res.message);
      }
    } catch (e) {
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      deletingRuleId = null;
    }
  }

  async function applyRulesToMonth() {
    if (rules.length === 0) return alert("등록된 고정 내역 규칙이 없습니다.");
    if (
      !confirm(
        `${displayMonth}월 장부에 ${rules.length}개의 고정 이체 내역을 일괄 추가하시겠습니까?`,
      )
    )
      return;

    isBatchSubmitting = true;

    const newItems = [];
    rules.forEach((rule) => {
      const y = displayYear;
      const m = String(displayMonth).padStart(2, "0");
      const lastDay = new Date(displayYear, displayMonth, 0).getDate();
      const dayNum = Math.min(parseInt(rule.day || 1), lastDay);
      const d = String(dayNum).padStart(2, "0");

      const alreadyExists = ledgerItems.some(
        (item) =>
          item.title === rule.title &&
          String(item.date).startsWith(`${y}-${m}`) &&
          item.giver === rule.giver &&
          item.receiver === rule.receiver,
      );
      if (alreadyExists) return;

      newItems.push({
        date: `${y}-${m}-${d}`,
        day: dayNum,
        type: rule.type || "이체",
        title: rule.title,
        amount: cleanAmount(rule.amount),
        giver: rule.giver,
        receiver: rule.receiver,
        is_settled: false,
      });
    });

    if (newItems.length === 0) {
      isBatchSubmitting = false;
      return alert(
        "이번 달에 추가할 내역이 없습니다. (이미 추가된 내역은 중복 방지를 위해 건너뛰었습니다)",
      );
    }

    const res = await api.batchAddLedger(newItems);
    if (res.success) {
      alert(`총 ${newItems.length}건이 성공적으로 추가되었습니다!`);
      showRuleModal = false;
      loadLedger();
    } else {
      alert("일괄 추가 실패: " + res.message);
    }
    isBatchSubmitting = false;
  }

  function openAddForm() {
    formData = {
      id: null,
      date: formatDate(new Date()),
      type: "이체",
      title: "",
      amount: "",
      giver: "나",
      receiver: "가족",
      is_settled: false,
    };
    showForm = true;
  }

  function openEditForm(item) {
    formData = { ...item };
    showForm = true;
  }

  const cleanAmount = (v) =>
    parseFloat(String(v).replace(/[^\d.-]/g, "")) || 0;

  async function handleSubmit() {
    const amount = cleanAmount(formData.amount);
    if (!formData.title || !amount)
      return alert("내용과 금액을 입력해주세요.");

    isSubmitting = true;
    let res;

    const payload = { ...formData, amount };

    if (payload.date) {
      payload.day = new Date(payload.date).getDate();
    }

    if (formData.id) {
      res = await api.updateLedger(payload);
    } else {
      res = await api.addLedger(payload);
    }

    if (res.success) {
      showForm = false;
      loadLedger();
    } else {
      alert("저장 실패: " + res.message);
    }
    isSubmitting = false;
  }

  async function handleDelete(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    isDeleting = true;
    try {
      const res = await api.deleteLedger(id);
      if (res.success) {
        showForm = false;
        await loadLedger();
      } else {
        alert("삭제 실패: " + res.message);
      }
    } catch (e) {
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      isDeleting = false;
    }
  }

  async function toggleSettle(item) {
    if (settlingId) return;
    settlingId = item.id;
    try {
      const res = await api.settleLedger({
        id: item.id,
        is_settled: !item.is_settled,
      });

      if (res.success) {
        await loadLedger();
      } else {
        alert("정산 처리 실패: " + (res.message || "알 수 없는 오류"));
      }
    } catch (e) {
      alert("정산 처리 중 오류가 발생했습니다.");
    } finally {
      settlingId = null;
    }
  }

  function formatAmount(amt) {
    const num = parseFloat(amt);
    if (!isNaN(num) && String(amt).match(/^[\d\.\-]+$/)) {
      return num.toLocaleString();
    }
    return amt;
  }

  let currentDate = new Date();
  $: displayYear = currentDate.getFullYear();
  $: displayMonth = currentDate.getMonth() + 1;

  function prevMonth() {
    currentDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1,
    );
  }

  function nextMonth() {
    currentDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      1,
    );
  }

  $: filteredItems = ledgerItems.filter((item) => {
    const d = new Date(item.date);
    const isMonthMatch =
      d.getFullYear() === displayYear && d.getMonth() + 1 === displayMonth;
    if (!isMonthMatch) return false;

    if (showOnlyMine) {
      return item.giver === viewAsUser || item.receiver === viewAsUser;
    }
    return true;
  });

  $: totalAmount = filteredItems.reduce((sum, item) => {
    const n = parseFloat(item.amount);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  $: unsettledItems = filteredItems.filter((i) => !i.is_settled);
  $: unsettledAmount = unsettledItems.reduce((sum, item) => {
    const n = parseFloat(item.amount);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  // Nudge Push State
  let showNudgeModal = false;
  let isSendingNudge = {};
  let isBatchSendingNudge = false;

  // Only unsettled items with type === "이체"
  $: unsettledTransfers = filteredItems.filter(
    (i) => (!i.is_settled || i.is_settled === "FALSE") && i.type === "이체",
  );

  // Group unsettled transfers by 'giver' (주는 사람)
  $: debtorsList = Object.values(
    unsettledTransfers.reduce((acc, item) => {
      const giver = item.giver || "미지정";
      if (!acc[giver]) {
        acc[giver] = {
          giver,
          totalAmount: 0,
          items: [],
        };
      }
      acc[giver].totalAmount += parseFloat(item.amount) || 0;
      acc[giver].items.push(item);
      return acc;
    }, {}),
  );

  function openNudgeModal() {
    if (!$isAdmin) return alert("관리자만 독촉할 수 있습니다.");
    if (debtorsList.length === 0) {
      return alert("현재 미정산된 이체 내역이 없습니다! 🎉");
    }
    showNudgeModal = true;
  }

  async function sendNudgePush(debtor) {
    isSendingNudge = { ...isSendingNudge, [debtor.giver]: true };

    const title = `[${displayMonth}월 장부 이체 알림] 💸`;
    const body = `${debtor.giver}님, ${displayMonth}월 미정산 이체 ${debtor.totalAmount.toLocaleString()}원(${debtor.items.length}건)이 있습니다. 확인 후 정산해주세요! 🙏`;

    try {
      const res = await api.sendPushNotification({
        target_user: debtor.giver,
        title,
        body,
        url: `${window.location.origin}${window.location.pathname}#/ledger`,
      });

      if (res && res.success) {
        alert(`${debtor.giver}님에게 푸쉬 알림을 성공적으로 보냈습니다! 🚀`);
      } else {
        alert(
          `[알림 발송 상태]\n서버 응답: ${res?.message || "기기 미등록"}\n\n※ ${debtor.giver}님의 기기에서 '설정' ➔ '알림 권한 허용 및 기기 등록'을 완료했는지 확인해주세요!`,
        );
      }
    } catch (e) {
      alert("푸쉬 발송 중 오류가 발생했습니다: " + e.message);
    } finally {
      isSendingNudge = { ...isSendingNudge, [debtor.giver]: false };
    }
  }

  async function sendAllNudgePush() {
    if (
      !confirm(
        `미정산 이체가 있는 모든 가족(${debtorsList.length}명)에게 푸쉬 알림을 보낼까요?`,
      )
    )
      return;
    isBatchSendingNudge = true;

    let successCount = 0;
    let serverMessages = [];

    for (const debtor of debtorsList) {
      const title = `[${displayMonth}월 장부 이체 알림] 💸`;
      const body = `${debtor.giver}님, ${displayMonth}월 미정산 이체 ${debtor.totalAmount.toLocaleString()}원(${debtor.items.length}건)이 있습니다. 확인 후 정산해주세요! 🙏`;

      try {
        const res = await api.sendPushNotification({
          target_user: debtor.giver,
          title,
          body,
          url: `${window.location.origin}${window.location.pathname}#/ledger`,
        });
        if (res && res.success) {
          successCount++;
        } else if (res && res.message) {
          serverMessages.push(`${debtor.giver}: ${res.message}`);
        }
      } catch (e) {
        serverMessages.push(`${debtor.giver}: ${e.message}`);
      }
    }

    isBatchSendingNudge = false;

    if (serverMessages.length > 0 && successCount === 0) {
      alert(
        `[알림 발송 상태]\n서버 응답: ${serverMessages[0]}\n\n※ 상대방 기기가 '설정' 화면에서 '알림 허용 및 기기 등록'을 완료했는지 확인해주세요!`,
      );
    } else {
      alert(
        `총 ${debtorsList.length}명 중 ${successCount}명에게 푸쉬 알림 발송 완료! 🚀`,
      );
    }
  }

</script>

<div class="space-y-6 max-w-md mx-auto relative">
  <!-- Header Card -->
  <header
    class="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-7 text-white shadow-xl space-y-5"
  >
    <div class="relative z-10 space-y-4">
      <!-- Tier 1: Month Nav & Nudge Button -->
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-2 bg-black/20 rounded-2xl px-3 py-1.5 backdrop-blur-md">
          <button
            type="button"
            on:click={prevMonth}
            class="text-indigo-200 hover:text-white active:scale-75 transition-all p-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="text-white font-black text-sm tracking-wider">
            {displayYear}.{String(displayMonth).padStart(2, "0")}
          </span>
          <button
            type="button"
            on:click={nextMonth}
            class="text-indigo-200 hover:text-white active:scale-75 transition-all p-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {#if $isAdmin}
          <button
            type="button"
            on:click={openNudgeModal}
            class="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-2xl font-bold backdrop-blur-md active:scale-95 transition-all flex items-center gap-1.5 border border-white/20"
          >
            <span>📢</span> 독촉하기
          </button>
        {/if}
      </div>

      <!-- Tier 2: Unsettled Big Hero -->
      <div class="text-center py-2 space-y-1">
        <span class="text-indigo-200 text-xs font-bold uppercase tracking-widest block">
          {displayMonth}월 미정산 금액
        </span>

        <div class="flex items-baseline justify-center gap-1">
          <h1 class="text-4xl font-black tracking-tight text-white">
            {unsettledAmount.toLocaleString()}
          </h1>
          <span class="text-lg font-bold text-indigo-200">원</span>
        </div>
        <p class="text-[11px] text-indigo-300 font-medium">
          총 이체 예정 {totalAmount.toLocaleString()}원 · 미정산 {unsettledItems.length}건
        </p>
      </div>

      <!-- Tier 3: Filters & Rules Button -->
      <div class="flex items-center justify-between gap-2 pt-2 border-t border-white/15">
        <div class="flex items-center gap-1.5">
          <select
            bind:value={viewAsUser}
            disabled={!$isAdmin}
            class="bg-black/25 text-indigo-100 text-xs font-bold py-1.5 px-2.5 rounded-xl border-none outline-none backdrop-blur-md"
          >
            {#each USERS as u}<option value={u}>{u}</option>{/each}
          </select>
          <button
            type="button"
            on:click={() => (showOnlyMine = !showOnlyMine)}
            class="text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all border {showOnlyMine
              ? 'bg-white text-indigo-700 border-white shadow-sm'
              : 'bg-black/20 text-indigo-200 border-transparent hover:bg-black/30'}"
          >
            내 내역만
          </button>
        </div>

        {#if $isAdmin}
          <button
            type="button"
            on:click={openRuleModal}
            class="px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-xs active:scale-95 transition-all shadow-sm flex items-center gap-1"
          >
            <span>📌</span> 고정 이체 ({rules.length})
          </button>
        {/if}
      </div>
    </div>

    <!-- Decor -->
    <div class="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
    <div class="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-400/20 rounded-full blur-2xl"></div>
  </header>

  <!-- Items List -->
  <div class="space-y-3">
    {#if isLoading && !showRuleModal}
      <div class="flex flex-col items-center justify-center py-16">
        <Spinner label="장부를 불러오는 중..." />
      </div>
    {:else if filteredItems.length === 0}
      <div class="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400">
        <span class="text-4xl block mb-2">💸</span>
        <p class="text-sm font-bold text-gray-600 dark:text-gray-300">내역이 없습니다.</p>
        <p class="text-xs text-gray-400 mt-1">우측 하단의 '+' 버튼으로 새 내역을 추가해보세요!</p>
      </div>
    {:else}
      {#each filteredItems as item (item.id)}
        <div
          class="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center gap-3 active:scale-[0.99] transition-all relative overflow-hidden group"
        >
          <!-- Left Color Bar -->
          <div
            class="absolute left-0 top-0 bottom-0 w-1.5 {item.is_settled
              ? 'bg-gray-200 dark:bg-gray-700'
              : 'bg-rose-500'}"
          ></div>

          <!-- Item Details -->
          <div
            class="pl-2 flex-1 {$isAdmin ? 'cursor-pointer' : ''}"
            on:click={() => $isAdmin && openEditForm(item)}
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[10px] font-black px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {new Date(item.date).getDate()}일
              </span>
              <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                {item.type}
              </span>
            </div>

            <h3
              class="font-black text-sm text-gray-900 dark:text-white {item.is_settled
                ? 'line-through opacity-50'
                : ''}"
            >
              {item.title}
            </h3>

            <div class="flex items-center gap-1.5 text-xs font-bold text-gray-400 mt-0.5">
              <span>{item.giver}</span>
              <span class="text-gray-300">→</span>
              <span>{item.receiver}</span>
              {#if $isAdmin}
                <span class="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                  ✏️ 수정
                </span>
              {/if}
            </div>
          </div>

          <!-- Amount & Settle Toggle -->
          <div class="flex flex-col items-end gap-1.5 text-right">
            <span
              class="font-black text-base {item.is_settled
                ? 'text-gray-400 dark:text-gray-500'
                : 'text-gray-900 dark:text-white'}"
            >
              {formatAmount(item.amount)}<span class="text-xs font-normal">원</span>
            </span>

            <button
              type="button"
              disabled={settlingId === item.id}
              on:click|stopPropagation={() => toggleSettle(item)}
              class="inline-flex items-center justify-center min-w-[76px] text-xs font-bold px-3 py-1.5 rounded-full border transition-all active:scale-90 {settlingId === item.id ? 'opacity-60 cursor-not-allowed' : ''} {item.is_settled
                ? 'border-gray-200 text-gray-400 bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600'
                : 'border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'}"
            >
              {#if settlingId === item.id}
                <svg class="animate-spin -ml-0.5 mr-1 h-3 w-3 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>처리중</span>
              {:else}
                <span>{item.is_settled ? "✓ 정산완료" : "⏳ 미정산"}</span>
              {/if}
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Add/Edit Modal -->
  {#if showForm}
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      transition:fade
    >
      <div
        class="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl relative space-y-4"
        transition:slide={{ duration: 300, axis: "y" }}
      >
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-black text-gray-900 dark:text-white">
            {formData.id ? "내역 수정" : "새로운 내역 등록"}
          </h2>
          {#if formData.id}
            <button
              type="button"
              disabled={isDeleting || isSubmitting}
              on:click={() => handleDelete(formData.id)}
              class="text-rose-500 hover:text-rose-600 disabled:opacity-40 text-xs font-bold p-1 flex items-center gap-1"
            >
              {#if isDeleting}
                <svg class="animate-spin h-3 w-3 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>삭제 중...</span>
              {:else}
                <span>삭제</span>
              {/if}
            </button>
          {/if}
        </div>

        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label for="ledger-date" class="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1">날짜</label>
              <input
                id="ledger-date"
                type="date"
                bind:value={formData.date}
                class="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 text-xs font-bold outline-none border border-gray-200 dark:border-gray-700"
              />
            </div>
            <div>
              <label for="ledger-type" class="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1">분류</label>
              <select
                id="ledger-type"
                bind:value={formData.type}
                class="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 text-xs font-bold outline-none border border-gray-200 dark:border-gray-700"
              >
                {#each TYPES as t}<option value={t}>{t}</option>{/each}
              </select>
            </div>
          </div>

          <div>
            <label for="ledger-title" class="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1">내용</label>
            <input
              id="ledger-title"
              type="text"
              bind:value={formData.title}
              placeholder="예: 마트 장보기, 용돈 등"
              class="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-3.5 py-3 font-bold text-sm outline-none border border-gray-200 dark:border-gray-700"
            />
          </div>

          <div>
            <label for="ledger-amount" class="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1">금액 (원)</label>
            <input
              id="ledger-amount"
              type="text"
              bind:value={formData.amount}
              placeholder="0"
              class="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-3.5 py-3 text-lg font-black outline-none border border-gray-200 dark:border-gray-700"
            />
          </div>

          <div class="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <div>
              <label for="ledger-giver" class="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1">누가</label>
              <select
                id="ledger-giver"
                bind:value={formData.giver}
                class="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 text-xs font-bold outline-none border border-gray-200 dark:border-gray-700"
              >
                {#each USERS as u}<option value={u}>{u}</option>{/each}
              </select>
            </div>
            <span class="text-gray-400 font-bold mt-5">→</span>
            <div>
              <label for="ledger-receiver" class="text-xs font-bold text-gray-400 dark:text-gray-500 block mb-1">누구에게</label>
              <select
                id="ledger-receiver"
                bind:value={formData.receiver}
                class="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 text-xs font-bold outline-none border border-gray-200 dark:border-gray-700"
              >
                {#each USERS as u}<option value={u}>{u}</option>{/each}
              </select>
            </div>
          </div>

          <label
            class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl cursor-pointer border border-gray-200 dark:border-gray-700"
          >
            <input
              type="checkbox"
              bind:checked={formData.is_settled}
              class="w-4 h-4 text-indigo-600 rounded"
            />
            <span class="text-xs font-bold text-gray-700 dark:text-gray-300">정산 완료 처리</span>
          </label>
        </div>

        <div class="flex gap-2 pt-2">
          <button
            type="button"
            on:click={() => (showForm = false)}
            class="flex-1 py-3.5 font-bold text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-2xl active:scale-95 transition-all"
          >
            취소
          </button>
          <button
            type="button"
            on:click={handleSubmit}
            disabled={isSubmitting}
            class="flex-1 py-3.5 font-black text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-md active:scale-95 transition-all"
          >
            {isSubmitting ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Simplified Fixed Rules Modal -->
  {#if showRuleModal}
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      transition:fade
    >
      <div
        class="w-full max-w-sm max-h-[88vh] flex flex-col bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl relative space-y-4"
        transition:slide={{ duration: 300, axis: "y" }}
      >
        <div class="flex justify-between items-center shrink-0">
          <div>
            <h2 class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-1.5">
              📌 매월 고정 이체 관리
            </h2>
            <p class="text-[11px] text-gray-400">용돈/관리비 등 매달 반복되는 이체 내역</p>
          </div>
          <button
            type="button"
            on:click={() => (showRuleModal = false)}
            class="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold"
          >
            ✕
          </button>
        </div>

        <!-- 1-Click Batch Apply Button -->
        <div class="shrink-0 bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 space-y-2">
          <div class="flex justify-between items-center text-xs font-bold text-indigo-950 dark:text-indigo-200">
            <span>{displayMonth}월 장부로 일괄 가져오기</span>
            <span class="text-indigo-600 dark:text-indigo-400">{rules.length}개 규칙</span>
          </div>
          <button
            type="button"
            on:click={applyRulesToMonth}
            disabled={isBatchSubmitting || rules.length === 0}
            class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all disabled:opacity-40"
          >
            {isBatchSubmitting ? "추가하는 중..." : `📋 ${displayMonth}월 장부에 즉시 등록하기`}
          </button>
        </div>

        <!-- Rules List (Scrollable) -->
        <div class="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[100px] max-h-[220px]">
          {#if rules.length === 0}
            <div class="text-center py-6 text-gray-400 text-xs bg-gray-50 dark:bg-gray-900 rounded-2xl">
              아직 등록된 고정 이체 규칙이 없습니다.<br />아래 폼에서 규칙을 등록해보세요!
            </div>
          {:else}
            {#each rules as rule}
              <div class="bg-gray-50 dark:bg-gray-900 p-3.5 rounded-2xl flex justify-between items-center border border-gray-100 dark:border-gray-700">
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-black px-1.5 py-0.5 rounded">
                      매월 {rule.day}일
                    </span>
                    <span class="font-bold text-xs text-gray-900 dark:text-white">
                      {rule.title}
                    </span>
                  </div>
                  <p class="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-1">
                    {formatAmount(rule.amount)}원 <span class="text-[11px] text-gray-400 font-normal">({rule.giver} → {rule.receiver})</span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deletingRuleId === rule.id}
                  on:click={() => handleDeleteRule(rule.id)}
                  class="p-2 text-gray-400 hover:text-rose-500 disabled:opacity-40 transition-colors text-xs flex items-center justify-center min-w-[28px]"
                  title="삭제"
                >
                  {#if deletingRuleId === rule.id}
                    <svg class="animate-spin h-3.5 w-3.5 text-rose-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                  {:else}
                    🗑️
                  {/if}
                </button>
              </div>
            {/each}
          {/if}
        </div>

        <!-- Add New Fixed Rule Form -->
        <div class="shrink-0 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl space-y-3 border border-gray-100 dark:border-gray-700">
          <span class="text-xs font-black text-gray-800 dark:text-gray-200 block">
            ➕ 새 고정 이체 규칙 등록
          </span>

          <!-- Day & Title -->
          <div class="flex gap-2">
            <div class="flex items-center gap-1 bg-white dark:bg-gray-800 px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shrink-0">
              <span class="text-[10px] text-gray-400 font-bold">매월</span>
              <input
                type="number"
                min="1"
                max="31"
                bind:value={newRuleDay}
                class="w-7 text-center text-xs font-black bg-transparent text-gray-900 dark:text-white outline-none"
              />
              <span class="text-[10px] text-gray-400 font-bold">일</span>
            </div>
            <input
              type="text"
              bind:value={newRuleTitle}
              placeholder="내역 이름 (예: 범수 정기입금)"
              class="flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 rounded-xl text-xs font-bold outline-none border border-gray-200 dark:border-gray-700"
            />
          </div>

          <!-- Amount + Quick Buttons -->
          <div class="space-y-1.5">
            <div class="relative">
              <input
                type="text"
                bind:value={newRuleAmount}
                placeholder="이체 금액 입력"
                class="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2.5 rounded-xl text-xs font-black outline-none border border-gray-200 dark:border-gray-700 pr-8"
              />
              <span class="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">원</span>
            </div>
            <div class="flex gap-1">
              <button
                type="button"
                on:click={() => addRuleAmount(100000)}
                class="flex-1 py-1 bg-white dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 active:scale-95"
              >
                +10만
              </button>
              <button
                type="button"
                on:click={() => addRuleAmount(300000)}
                class="flex-1 py-1 bg-white dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 active:scale-95"
              >
                +30만
              </button>
              <button
                type="button"
                on:click={() => addRuleAmount(500000)}
                class="flex-1 py-1 bg-white dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 active:scale-95"
              >
                +50만
              </button>
              <button
                type="button"
                on:click={() => addRuleAmount(1000000)}
                class="flex-1 py-1 bg-white dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 active:scale-95"
              >
                +100만
              </button>
            </div>
          </div>

          <!-- Giver -> Receiver -->
          <div class="grid grid-cols-[1fr_auto_1fr] gap-1.5 items-center">
            <div class="space-y-0.5">
              <span class="text-[9px] font-bold text-gray-400 pl-1">보내는 사람</span>
              <select
                bind:value={newRuleGiver}
                class="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-2.5 py-1.5 rounded-xl text-xs font-bold outline-none border border-gray-200 dark:border-gray-700"
              >
                {#each USERS as u}<option value={u}>{u}</option>{/each}
              </select>
            </div>
            <span class="text-gray-400 text-xs font-bold pt-3">➔</span>
            <div class="space-y-0.5">
              <span class="text-[9px] font-bold text-gray-400 pl-1">받는 사람</span>
              <select
                bind:value={newRuleReceiver}
                class="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-2.5 py-1.5 rounded-xl text-xs font-bold outline-none border border-gray-200 dark:border-gray-700"
              >
                {#each USERS as u}<option value={u}>{u}</option>{/each}
              </select>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="button"
            on:click={handleAddRule}
            disabled={isRuleSubmitting}
            class="w-full py-3 bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white rounded-xl text-xs font-black active:scale-95 transition-all shadow-sm disabled:opacity-40"
          >
            {isRuleSubmitting ? "등록 중..." : "➕ 고정 이체 규칙 저장하기"}
          </button>
        </div>
      </div>
    </div>
  {/if}



  <!-- Nudge Push Modal (이체 기록 한정, 주는 사람별 선택 푸쉬) -->
  {#if showNudgeModal}
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      transition:fade
    >
      <div
        class="w-full max-w-sm max-h-[85vh] flex flex-col bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl relative space-y-4"
        transition:slide={{ duration: 250, axis: "y" }}
      >
        <div class="flex justify-between items-center shrink-0">
          <div>
            <h2 class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-1.5">
              📢 이체 독촉 푸쉬 발송
            </h2>
            <p class="text-[11px] text-gray-400">
              미정산 이체 내역이 있는 '주는 사람'에게 푸쉬를 보냅니다.
            </p>
          </div>
          <button
            type="button"
            on:click={() => (showNudgeModal = false)}
            class="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold"
          >
            ✕
          </button>
        </div>

        <!-- All Givers Batch Send Button -->
        {#if debtorsList.length > 1}
          <button
            type="button"
            on:click={sendAllNudgePush}
            disabled={isBatchSendingNudge}
            class="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-black text-xs shadow-md active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <span>⚡</span>
            <span>{isBatchSendingNudge ? "일괄 발송 중..." : `모두에게 한 번에 푸쉬 보내기 (${debtorsList.length}명)`}</span>
          </button>
        {/if}

        <!-- Debtors List -->
        <div class="flex-1 overflow-y-auto space-y-3 pr-1">
          {#each debtorsList as debtor}
            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
              <!-- Giver Header -->
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                  <span class="text-xl p-1.5 bg-white dark:bg-gray-800 rounded-xl leading-none shadow-sm">
                    {debtor.giver === "엄마" ? "👩" : debtor.giver === "아빠" ? "👨" : debtor.giver === "범수" ? "👦" : "🧑"}
                  </span>
                  <div>
                    <p class="text-xs font-black text-gray-900 dark:text-white leading-tight">
                      {debtor.giver} (주는 사람)
                    </p>
                    <p class="text-[10px] text-gray-400">
                      미정산 이체 {debtor.items.length}건
                    </p>
                  </div>
                </div>

                <span class="text-sm font-black text-rose-600 dark:text-rose-400">
                  {debtor.totalAmount.toLocaleString()}원
                </span>
              </div>

              <!-- Unsettled items preview -->
              <div class="space-y-1 bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 text-[11px]">
                {#each debtor.items as it}
                  <div class="flex justify-between items-center text-gray-600 dark:text-gray-300">
                    <span class="truncate max-w-[170px]">• {it.title} ({it.date.slice(5)})</span>
                    <span class="font-bold text-gray-800 dark:text-gray-200">
                      {Number(it.amount).toLocaleString()}원
                    </span>
                  </div>
                {/each}
              </div>

              <!-- Send Button -->
              <button
                type="button"
                on:click={() => sendNudgePush(debtor)}
                disabled={isSendingNudge[debtor.giver]}
                class="w-full py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>🔔</span>
                <span>{isSendingNudge[debtor.giver] ? "푸쉬 발송 중..." : `${debtor.giver}에게 푸쉬 알림 발송`}</span>
              </button>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Floating Add Button for Admin -->
  {#if $isAdmin}

    <button
      type="button"
      on:click={() => openAddForm()}
      class="fixed bottom-24 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl font-light z-40 active:scale-90 transition-all border-2 border-white/20"
      transition:fade
    >
      +
    </button>
  {/if}
</div>
