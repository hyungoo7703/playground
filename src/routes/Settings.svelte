<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { isDarkMode, deferredPrompt } from "../lib/store.js";
  import {
    getAiConfig,
    saveAiConfig,
    syncAiConfigFromGAS,
    testAiConnection,
  } from "../lib/aiApi.js";
  import {
    getNotificationPermission,
    registerPushDevice,
    autoRegisterPushIfGranted,
    sendTestNotification,
    isNotificationSupported,
  } from "../lib/notification.js";

  // AI State
  let aiUrl = "";
  let aiToken = "";
  let showToken = false;
  let aiStatus = "idle"; // 'idle' | 'syncing' | 'testing' | 'success' | 'error'
  let aiMessage = "";
  let isConnected = false;

  // Notification State
  let notiPermission = "default";
  let notiMessage = "";
  let isSendingNoti = false;
  let isRegisteringNoti = false;

  onMount(() => {
    // 1. AI 설정 불러오기
    const cfg = getAiConfig();
    aiUrl = cfg.aiUrl;
    aiToken = cfg.aiToken;
    if (cfg.isConfigured) {
      isConnected = true;
    }

    // 2. 알림 권한 상태 확인 및 이미 허용된 경우 자동 기기 등록
    notiPermission = getNotificationPermission();
    if (notiPermission === "granted") {
      autoRegisterPushIfGranted();
    }
  });

  // AI 서버에서 설정 동기화
  async function handleSyncAiConfig() {
    aiStatus = "syncing";
    aiMessage = "서버(GAS)에서 AI 설정을 가져오는 중...";

    try {
      const cfg = await syncAiConfigFromGAS();
      aiUrl = cfg.aiUrl;
      aiToken = cfg.aiToken;
      aiStatus = "success";
      aiMessage = "✅ 서버에서 AI 설정을 성공적으로 가져와 저장했습니다!";
      isConnected = true;
    } catch (error) {
      aiStatus = "error";
      aiMessage = `❌ 설정 가져오기 실패: ${error.message}`;
    }
  }

  // AI 연결 테스트 (헬스체크)
  async function handleTestAiConnection() {
    if (!aiUrl) {
      aiStatus = "error";
      aiMessage = "AI 서버 주소를 먼저 입력하거나 동기화해주세요.";
      return;
    }

    aiStatus = "testing";
    aiMessage = "AI 서버 헬스체크 확인 중...";

    const res = await testAiConnection(aiUrl);
    if (res.success) {
      aiStatus = "success";
      aiMessage = `🟢 연결 성공! 모델: ${res.data?.defaultModel || "gemini-2.0-flash"} (정상 가동 중)`;
      isConnected = true;
    } else {
      aiStatus = "error";
      aiMessage = `🔴 연결 실패: ${res.message}`;
      isConnected = false;
    }
  }

  // AI 설정 수동 저장
  function handleSaveAiConfig() {
    const cfg = saveAiConfig(aiUrl, aiToken);
    isConnected = cfg.isConfigured;
    aiStatus = "success";
    aiMessage = "💾 AI 설정이 로컬스토리지에 저장되었습니다.";
  }

  // 알림 권한 요청 및 기기 등록
  async function handleRequestNotification() {
    isRegisteringNoti = true;
    notiMessage = "알림 권한 요청 및 기기 등록 중...";

    try {
      const result = await registerPushDevice();
      notiPermission = result.permission;
      if (result.success) {
        notiMessage = "🔔 알림 권한 허용 및 구글 시트에 기기 등록이 완료되었습니다!";
      } else if (result.permission === "denied") {
        notiMessage = "🚫 알림 권한이 차단되었습니다. 브라우저 사이트 설정에서 권한을 변경해주세요.";
      }
    } catch (e) {
      notiMessage = `알림 등록 오류: ${e.message}`;
    } finally {
      isRegisteringNoti = false;
    }
  }

  // 테스트 알림 발송
  async function handleSendTestNoti() {
    isSendingNoti = true;
    const ok = await sendTestNotification();
    if (ok) {
      notiMessage = "✨ 테스트 알림을 발송했습니다. 화면 상단 배너를 확인해보세요!";
    } else {
      notiMessage = "⚠️ 알림 발송에 실패했습니다. 권한을 확인해주세요.";
    }
    isSendingNoti = false;
  }

  function logout() {
    if (!confirm("로그아웃 하시겠습니까?")) return;
    // 로그인 정보만 삭제 (게임 세이브, 다크모드 등은 유지)
    ["accessCode", "userName", "currentUser", "role", "aiToken"].forEach((key) =>
      localStorage.removeItem(key),
    );
    location.reload();
  }

  async function installPWA() {
    if (!$deferredPrompt) return;

    // 브라우저 설치 프롬프트 표시
    $deferredPrompt.prompt();

    // 사용자 응답 확인
    const { outcome } = await $deferredPrompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt.set(null); // 설치 승인 시 버튼 숨김
    }
  }
</script>

<div class="space-y-6 max-w-md mx-auto pb-24">
  <h2 class="text-2xl font-black text-gray-800 dark:text-gray-200">설정</h2>

  <!-- 1. 기본 설정 (다크모드) -->
  <section class="p-6 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-3xl">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🌓</span>
        <span class="text-base font-bold text-gray-800 dark:text-gray-200">다크 모드</span>
      </div>
      <button
        on:click={() => isDarkMode.set(!$isDarkMode)}
        class="relative inline-flex items-center h-6 rounded-full w-11 transition-colors {$isDarkMode
          ? 'bg-indigo-600'
          : 'bg-gray-300'}"
        aria-label="다크 모드 토글"
      >
        <span
          class="inline-block w-4 h-4 transform bg-white rounded-full transition-transform {$isDarkMode
            ? 'translate-x-6'
            : 'translate-x-1'}"
        ></span>
      </button>
    </div>
  </section>

  <!-- 2. AI 연결 설정 (freeplan-ai-system) -->
  <section class="p-6 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-3xl space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-black text-gray-800 dark:text-gray-200 flex items-center gap-2">
        <span>🤖</span> AI 연결 설정
      </h3>
      <span
        class="text-xs px-2.5 py-1 rounded-full font-bold {isConnected
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}"
      >
        {isConnected ? "🟢 연결됨" : "⚪ 미설정"}
      </span>
    </div>

    <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
      Google Gemini 기반의 AI 게이트웨이 서비스와 통신합니다. 서버에서 동기화하거나 직접 입력할 수 있습니다.
    </p>

    <!-- AI URL Input -->
    <div class="space-y-1">
      <label for="ai-url-input" class="block text-xs font-bold text-gray-600 dark:text-gray-300">AI 서버 주소 (URL)</label>
      <input
        id="ai-url-input"
        type="text"
        bind:value={aiUrl}
        placeholder="https://freeplan-ai-system.vercel.app"
        class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    <!-- AI Token Input -->
    <div class="space-y-1">
      <div class="flex justify-between items-center">
        <label for="ai-token-input" class="block text-xs font-bold text-gray-600 dark:text-gray-300">앱 비밀 토큰</label>
        <button
          type="button"
          on:click={() => (showToken = !showToken)}
          class="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold"
        >
          {showToken ? "숨기기 🙈" : "보기 👁️"}
        </button>
      </div>
      {#if showToken}
        <input
          id="ai-token-input"
          type="text"
          bind:value={aiToken}
          placeholder="fp_live_sec_..."
          class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      {:else}
        <input
          id="ai-token-input"
          type="password"
          bind:value={aiToken}
          placeholder="fp_live_sec_..."
          class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      {/if}
    </div>

    <!-- Feedback Message Box -->
    {#if aiMessage}
      <div
        in:fade
        class="p-3 rounded-xl text-xs font-medium leading-relaxed {aiStatus === 'success'
          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
          : aiStatus === 'error'
            ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 border border-red-200 dark:border-red-800'
            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'}"
      >
        {aiMessage}
      </div>
    {/if}

    <!-- Action Buttons -->
    <div class="grid grid-cols-2 gap-2 pt-1">
      <button
        on:click={handleSyncAiConfig}
        disabled={aiStatus === "syncing"}
        class="py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 font-bold rounded-xl text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <span>🔄</span>
        <span>{aiStatus === "syncing" ? "가져오는 중..." : "서버에서 동기화"}</span>
      </button>

      <button
        on:click={handleTestAiConnection}
        disabled={aiStatus === "testing" || !aiUrl}
        class="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <span>⚡</span>
        <span>{aiStatus === "testing" ? "확인 중..." : "연결 테스트"}</span>
      </button>
    </div>

    <button
      on:click={handleSaveAiConfig}
      class="w-full py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-750 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-bold rounded-xl text-xs active:scale-95 transition-all"
    >
      💾 직접 입력값 로컬 저장
    </button>
  </section>

  <!-- 3. 푸시 알림 설정 (PWA / Web Notifications) -->
  <section class="p-6 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-3xl space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-black text-gray-800 dark:text-gray-200 flex items-center gap-2">
        <span>🔔</span> 푸시 알림 설정
      </h3>
      <span
        class="text-xs px-2.5 py-1 rounded-full font-bold {notiPermission === 'granted'
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
          : notiPermission === 'denied'
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}"
      >
        {notiPermission === "granted"
          ? "🟢 허용됨"
          : notiPermission === "denied"
            ? "🔴 차단됨"
            : notiPermission === "unsupported"
              ? "⚠️ 미지원"
              : "⚪ 권한 필요"}
      </span>
    </div>

    <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
      출석체크 리마인더, D-Day 알림 및 가족 소식을 스마트폰과 브라우저 상단 배너로 받아보실 수 있습니다.
    </p>

    {#if notiMessage}
      <div
        in:fade
        class="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-medium leading-relaxed"
      >
        {notiMessage}
      </div>
    {/if}

    <div class="space-y-2 pt-1">
      {#if notiPermission !== "granted"}
        <button
          on:click={handleRequestNotification}
          disabled={isRegisteringNoti}
          class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>🔔</span> {isRegisteringNoti ? "권한 요청 중..." : "푸시 알림 권한 켜기"}
        </button>
      {:else}
        <button
          on:click={handleRequestNotification}
          disabled={isRegisteringNoti}
          class="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-bold rounded-2xl text-xs active:scale-95 transition-all flex items-center justify-center gap-2 border border-indigo-200 dark:border-indigo-800 disabled:opacity-50"
        >
          <span>🔄</span> {isRegisteringNoti ? "시트에 등록 중..." : "구글 시트에 내 기기 등록 / 갱신"}
        </button>

        <button
          on:click={handleSendTestNoti}
          disabled={isSendingNoti}
          class="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-2xl text-xs active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>📨</span> {isSendingNoti ? "발송 중..." : "테스트 알림 보내보기"}
        </button>
      {/if}
    </div>

  </section>

  <!-- 4. PWA 앱 설치 버튼 (지원되는 경우) -->
  {#if $deferredPrompt}
    <section in:fade>
      <button
        on:click={installPWA}
        class="w-full flex items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 border-2 border-indigo-500 rounded-3xl text-indigo-600 dark:text-indigo-400 font-bold shadow-md active:scale-95 transition-all"
      >
        <span>📥</span> 홈 화면에 앱으로 추가 (PWA)
      </button>
    </section>
  {/if}

  <!-- 5. 계정 및 데이터 관리 -->
  <section class="p-6 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-3xl space-y-3">
    <h3 class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">계정 및 데이터 관리</h3>
    
    <button
      on:click={logout}
      class="w-full flex items-center justify-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded-2xl text-gray-700 dark:text-gray-300 font-bold active:scale-95 transition-all text-xs"
    >
      <span>🚪</span> 로그아웃
    </button>

    <button
      on:click={() => {
        if (
          confirm(
            "로컬스토리지를 초기화하면 로그인 정보, AI 설정, 다크모드 등 모든 설정이 삭제됩니다. 계속하시겠습니까?",
          )
        ) {
          localStorage.clear();
          location.reload();
        }
      }}
      class="w-full flex items-center justify-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 font-bold active:scale-95 transition-all text-xs"
    >
      <span>🗑️</span> 로컬스토리지 초기화
    </button>
    <p class="text-[11px] text-gray-400 text-center">
      로그인 접속 코드 및 AI 연결 토큰을 포함한 모든 브라우저 데이터가 초기화됩니다.
    </p>
  </section>
</div>
