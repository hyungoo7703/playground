<script>
  import { isDarkMode, deferredPrompt } from "../lib/store.js";
  import { fade } from "svelte/transition";

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

<section
  id="settings"
  class="p-6 bg-white dark:bg-gray-800 shadow-md rounded-2xl"
>
  <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">설정</h2>

  <div class="flex items-center justify-between">
    <span class="text-lg font-medium text-gray-700 dark:text-gray-300"
      >다크 모드</span
    >
    <button
      on:click={() => isDarkMode.set(!$isDarkMode)}
      class="relative inline-flex items-center h-6 rounded-full w-11 transition-colors {$isDarkMode
        ? 'bg-blue-600'
        : 'bg-gray-300'}"
    >
      <span
        class="inline-block w-4 h-4 transform bg-white rounded-full transition-transform {$isDarkMode
          ? 'translate-x-6'
          : 'translate-x-1'}"
      ></span>
    </button>
  </div>

  <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
    <button
      on:click={() => {
        if (
          confirm(
            "로컬스토리지를 초기화하면 로그인 정보와 모든 설정이 삭제됩니다. 계속하시겠습니까?",
          )
        ) {
          localStorage.clear();
          location.reload();
        }
      }}
      class="w-full flex items-center justify-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 font-bold active:scale-95 transition-all"
    >
      <span>🗑️</span> 로컬스토리지 초기화
    </button>
    <p class="text-xs text-gray-400 mt-2 text-center">
      로그인 정보, 다크모드 설정 등 모든 로컬 데이터가 삭제됩니다.
    </p>
  </div>
</section>

{#if $deferredPrompt}
  <section in:fade class="mt-4">
    <button
      on:click={installPWA}
      class="w-full flex items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 border-2 border-indigo-500 rounded-2xl text-indigo-600 dark:text-indigo-400 font-bold shadow-md active:scale-95 transition-all"
    >
      <span>📥</span> 앱으로 다운로드 (PWA)
    </button>
  </section>
{/if}
