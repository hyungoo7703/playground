<script>
  import { navigate } from "svelte-routing";
  import { base } from "../lib/store.js";

  function goTo(path) {
    navigate(`${base}/${path}`);
  }
</script>

<div
  class="flex flex-col items-center w-full min-h-full p-4 pb-12 space-y-8 bg-gray-50 dark:bg-gray-900 transition-colors duration-300"
>
  <header class="text-center pt-8">
    <h1
      class="text-3xl font-black text-gray-800 dark:text-white mb-2 tracking-tight"
    >
      가족 오락관 <span class="text-indigo-500 text-xl font-bold italic"
        >v2.0</span
      >
    </h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">
      오늘도 즐거운 게임 한 판 어떠세요?
    </p>
  </header>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-2">
    <button
      on:click={() => goTo("fruit-pang")}
      class="relative group overflow-hidden rounded-[2.5rem] border-4 border-sky-200/50 bg-white dark:bg-gray-800 text-left shadow-xl transition-all hover:scale-[1.02] active:scale-95"
    >
      <div
        class="absolute right-0 top-0 w-32 h-32 bg-sky-100/50 rounded-bl-[100px] transition-all group-hover:scale-110"
      ></div>
      <div
        class="relative flex h-full flex-col justify-between bg-white dark:bg-gray-800 rounded-[2.3rem] p-7 z-10"
      >
        <div>
          <span
            class="inline-block px-3 py-1 mb-3 text-[10px] font-bold tracking-wider text-sky-500 uppercase bg-sky-50 rounded-full dark:bg-sky-900/30 dark:text-sky-300"
          >
            CLASSIC PUZZLE
          </span>
          <h2 class="text-2xl font-black text-gray-800 dark:text-white mb-2">
            과일 팡팡
          </h2>
          <p
            class="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed"
          >
            상큼한 과일들을 연결해서 터뜨리세요! <br />
            부모님과 함께하는 즐거운 시간.
          </p>
        </div>
        <div class="mt-8 flex items-center justify-between">
          <div class="flex -space-x-2 animate-bounce">
            <span class="text-3xl drop-shadow-md">🍎</span>
            <span class="text-3xl drop-shadow-md">🍇</span>
            <span class="text-3xl drop-shadow-md">🍊</span>
          </div>
          <div
            class="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-600 dark:text-sky-300 shadow-inner"
          >
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
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              ></path>
            </svg>
          </div>
        </div>
      </div>
    </button>

    <button
      on:click={() => goTo("neon-blast")}
      class="neon-border-frame relative group overflow-hidden rounded-[2.5rem] p-1 text-left transition-all hover:scale-[1.02] active:scale-95"
    >
      <div class="absolute inset-0 bg-[#0a0a0a] transition-opacity"></div>
      <div
        class="absolute -right-8 -top-8 w-40 h-40 bg-cyan-500/20 blur-[50px] group-hover:bg-magenta-500/30 transition-all"
      ></div>

      <div
        class="relative flex h-full flex-col justify-between rounded-[2.3rem] p-7 z-10 border border-white/5 backdrop-blur-md"
      >
        <div>
          <div class="flex justify-between items-start mb-4">
            <div class="flex gap-2 items-center">
              <span
                class="inline-block px-3 py-1 text-[10px] font-black tracking-tighter text-cyan-400 uppercase bg-cyan-900/40 border border-cyan-500/30 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.3)]"
              >
                PHYSICS ARCADE
              </span>
            </div>
            <div
              class="text-cyan-400 animate-pulse drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
            >
              <svg
                class="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>

          <h2
            class="text-2xl font-black text-white mb-2 tracking-tight text-shadow-cyan"
          >
            네온 블래스트
          </h2>
          <p
            class="text-sm text-gray-300 font-medium leading-relaxed opacity-90"
          >
            물리 법칙으로 핀을 터뜨리는 짜릿한 손맛! <br />
            지금 바로 새로운 스테이지에 도전하세요.
          </p>
        </div>

        <div class="mt-8 flex items-end justify-between">
          <div class="flex items-center gap-3">
            <div class="relative">
              <div
                class="w-4 h-4 rounded-full bg-white shadow-[0_0_15px_#fff] animate-bounce"
              ></div>
            </div>
            <div class="flex gap-1.5">
              <div
                class="w-2.5 h-2.5 rounded-full bg-magenta-500 shadow-[0_0_10px_#d946ef]"
              ></div>
              <div
                class="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"
              ></div>
            </div>
          </div>

          <div
            class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/40"
          >
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
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              ></path>
            </svg>
          </div>
        </div>
      </div>
    </button>

    <button
      on:click={() => goTo("neon-brick")}
      class="relative group overflow-hidden rounded-[2.5rem] p-1 text-left transition-all hover:scale-[1.02] active:scale-95 border-2 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
    >
      <div class="absolute inset-0 bg-gray-900 transition-opacity"></div>
      <div
        class="absolute -right-8 -top-8 w-40 h-40 bg-purple-500/30 blur-[50px] group-hover:bg-pink-500/30 transition-all"
      ></div>

      <div
        class="relative flex h-full flex-col justify-between rounded-[2.3rem] p-7 z-10"
      >
        <div>
          <div class="flex gap-2 items-center mb-3">
            <span
              class="inline-block px-3 py-1 text-[10px] font-black tracking-wider text-purple-300 uppercase bg-purple-900/50 border border-purple-500/30 rounded-full shadow-[0_0_10px_rgba(192,132,252,0.4)]"
            >
              RETRO ARCADE
            </span>
            <span
              class="neon-badge-label text-[10px] font-black px-2 py-0.5 rounded italic tracking-widest text-white border-2 border-magenta-500"
            >
              NEW
            </span>
          </div>
          <h2
            class="text-2xl font-black text-white mb-2 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"
          >
            네온 브릭
          </h2>
          <p
            class="text-sm text-gray-300 font-medium leading-relaxed opacity-90"
          >
            화려한 네온 빛깔의 벽돌 깨기! <br />
            무한히 생성되는 스테이지에 도전하세요.
          </p>
        </div>
        <div class="mt-8 flex items-center justify-between">
          <div class="flex gap-1 animate-pulse">
            <div
              class="w-3 h-3 bg-yellow-400 rounded-sm shadow-[0_0_8px_#facc15]"
            ></div>
            <div
              class="w-3 h-3 bg-pink-400 rounded-sm shadow-[0_0_8px_#f472b6]"
            ></div>
            <div
              class="w-3 h-3 bg-blue-400 rounded-sm shadow-[0_0_8px_#60a5fa]"
            ></div>
          </div>
          <div
            class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/40"
          >
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
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              ></path>
            </svg>
          </div>
        </div>
      </div>
    </button>

    <button
      on:click={() => goTo("neon-survivor")}
      class="relative group overflow-hidden rounded-[2.5rem] p-1 text-left transition-all hover:scale-[1.02] active:scale-95 border-2 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
    >
      <div class="absolute inset-0 bg-gray-900 transition-opacity"></div>
      <div
        class="absolute -right-8 -top-8 w-40 h-40 bg-green-500/30 blur-[50px] group-hover:bg-emerald-500/30 transition-all"
      ></div>

      <div
        class="relative flex h-full flex-col justify-between rounded-[2.3rem] p-7 z-10"
      >
        <div>
          <div class="flex gap-2 items-center mb-3">
            <span
              class="inline-block px-3 py-1 text-[10px] font-black tracking-wider text-green-300 uppercase bg-green-900/50 border border-green-500/30 rounded-full shadow-[0_0_10px_rgba(74,222,128,0.4)]"
            >
              SURVIVAL RPG
            </span>
            <span
              class="neon-badge-label text-[10px] font-black px-2 py-0.5 rounded italic tracking-widest text-white border-2 border-green-500"
            >
              Beta
            </span>
          </div>
          <h2
            class="text-2xl font-black text-white mb-2 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"
          >
            네온 서바이버
          </h2>
          <p
            class="text-sm text-gray-300 font-medium leading-relaxed opacity-90"
          >
            몰려오는 적들을 막아내고 성장하세요! <br />
            로그라이크와 네온 액션의 만남.
          </p>
        </div>
        <div class="mt-8 flex items-center justify-between">
          <div class="flex gap-1 animate-pulse">
            <div
              class="w-3 h-3 bg-green-400 rounded-sm shadow-[0_0_8px_#4ade80]"
            ></div>
            <div
              class="w-3 h-3 bg-emerald-400 rounded-sm shadow-[0_0_8px_#34d399]"
            ></div>
            <div
              class="w-3 h-3 bg-emerald-400 rounded-sm shadow-[0_0_8px_#34d399]"
            ></div>
          </div>
          <div
            class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-green-500/40"
          >
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
                d="M13 10V3L4 14h7v7l9-11h-7z"
              ></path>
            </svg>
          </div>
        </div>
      </div>
    </button>
  </div>

  <footer
    class="text-center opacity-30 text-[10px] font-bold tracking-widest uppercase dark:text-white pt-4"
  >
    Family Gaming Hub &copy; 2026
  </footer>
</div>

<style>
  /* 네온 블래스트 전용 테두리 프레임 */
  .neon-border-frame {
    background: linear-gradient(135deg, #22d3ee, #d946ef, #3b82f6);
    box-shadow: 0 0 15px rgba(34, 211, 238, 0.4);
    animation: neon-glow-pulse 3s infinite alternate;
  }

  @keyframes neon-glow-pulse {
    from {
      box-shadow: 0 0 10px rgba(34, 211, 238, 0.3);
    }
    to {
      box-shadow: 0 0 20px rgba(217, 70, 239, 0.5);
    }
  }

  .text-shadow-cyan {
    text-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
  }

  /* NEW 배지 네온 효과 */
  .neon-badge-label {
    box-shadow:
      0 0 8px #d946ef,
      inset 0 0 4px #d946ef;
    text-shadow: 0 0 5px #fff;
  }

  button {
    -webkit-tap-highlight-color: transparent;
    outline: none;
  }
</style>
