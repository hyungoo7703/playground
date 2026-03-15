<script>
  import { navigate } from "svelte-routing";
  import { base, isLoggedIn, currentUser, userRole } from "../lib/store.js";
  import { api } from "../lib/api.js";

  let accessCode = "";
  let isLoading = false;
  let errorMessage = "";

  async function handleLogin() {
    if (!accessCode) {
      errorMessage = "코드를 입력해주세요.";
      return;
    }

    isLoading = true;
    errorMessage = "";

    try {
      const result = await api.login(accessCode);

      if (result.success) {
        localStorage.setItem("accessCode", accessCode);
        localStorage.setItem("userName", result.userName);
        localStorage.setItem("currentUser", result.userName); // currentUser도 업데이트
        localStorage.setItem("role", result.role);

        currentUser.set(result.userName); // 스토어 업데이트
        userRole.set(result.role); // 역할 스토어 업데이트
        isLoggedIn.set(true); // 스토어 업데이트 (MainLayout의 {#if}가 즉시 바뀜)
        navigate(base || "/", { replace: true });
      } else {
        errorMessage = result.message;
      }
    } catch (error) {
      errorMessage = "서버 연결에 실패했습니다.";
      console.error(error);
    } finally {
      isLoading = false;
    }
  }
</script>

<div
  class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4"
>
  <div
    class="max-w-md w-full space-y-8 p-10 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700"
  >
    <div>
      <h2
        class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white"
      >
        코드 입력
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
        접속 코드를 입력하여 입장하세요
      </p>
    </div>

    <div class="mt-8 space-y-6">
      <div class="rounded-md shadow-sm -space-y-px">
        <div>
          <label for="access-code" class="sr-only">Access Code</label>
          <input
            id="access-code"
            type="password"
            bind:value={accessCode}
            on:keydown={(e) => e.key === "Enter" && handleLogin()}
            class="appearance-none rounded-lg relative block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            placeholder="코드를 입력하세요"
          />
        </div>
      </div>

      {#if errorMessage}
        <div
          class="text-red-500 dark:text-red-400 text-sm text-center font-medium"
        >
          {errorMessage}
        </div>
      {/if}

      <div>
        <button
          on:click={handleLogin}
          disabled={isLoading}
          class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-all disabled:bg-gray-400"
        >
          {#if isLoading}
            <span class="animate-pulse">확인 중...</span>
          {:else}
            입장하기
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>
