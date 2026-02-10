<script>
  import { navigate } from "svelte-routing";
  import { base } from "../lib/store.js";
  import GameCard from "../lib/components/GameCard.svelte";

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
    <!-- 1. 과일 팡팡 -->
    <GameCard
      title="과일 팡팡"
      description="상큼한 과일들을 연결해서 터뜨리세요! <br /> 부모님과 함께하는 즐거운 시간."
      badge="CLASSIC PUZZLE"
      onClick={() => goTo("fruit-pang")}
      className="border-4 border-sky-200/50 bg-white dark:bg-gray-800 shadow-xl"
      badgeClass="text-sky-500 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-300"
      titleClass="text-gray-800 dark:text-white"
      descClass="text-gray-500 dark:text-gray-400"
      actionBtnClass="bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300 shadow-inner"
      contentContainerClass="bg-white dark:bg-gray-800"
    >
      <div
        slot="background"
        class="absolute right-0 top-0 w-32 h-32 bg-sky-100/50 rounded-bl-[100px] transition-all group-hover:scale-110"
      ></div>
      <div slot="decoration" class="flex -space-x-2 animate-bounce">
        <span class="text-3xl drop-shadow-md">🍎</span>
        <span class="text-3xl drop-shadow-md">🍇</span>
        <span class="text-3xl drop-shadow-md">🍊</span>
      </div>
    </GameCard>

    <!-- 2. 네온 블래스트 -->
    <GameCard
      title="네온 블래스트"
      description="물리 법칙으로 핀을 터뜨리는 짜릿한 손맛! <br /> 지금 바로 새로운 스테이지에 도전하세요."
      badge="PHYSICS ARCADE"
      onClick={() => goTo("neon-blast")}
      className="border-2 border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
      badgeClass="text-cyan-400 bg-cyan-900/50 border border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.3)]"
      titleClass="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"
      descClass="text-gray-300 opacity-90"
      actionBtnClass="bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/40"
    >
      <div slot="background">
        <div class="absolute inset-0 bg-[#0a0a0a] transition-opacity"></div>
        <div
          class="absolute -right-8 -top-8 w-40 h-40 bg-cyan-500/20 blur-[50px] group-hover:bg-magenta-500/30 transition-all"
        ></div>
      </div>
      <div slot="badge-extra">
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
      <div slot="decoration" class="flex gap-3">
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
    </GameCard>

    <!-- 3. 네온 브릭 -->
    <GameCard
      title="네온 브릭"
      description="화려한 네온 빛깔의 벽돌 깨기! <br /> 무한히 생성되는 스테이지에 도전하세요."
      badge="RETRO ARCADE"
      onClick={() => goTo("neon-brick")}
      className="border-2 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
      badgeClass="text-purple-300 bg-purple-900/50 border border-purple-500/30 shadow-[0_0_10px_rgba(192,132,252,0.4)]"
      titleClass="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"
      descClass="text-gray-300 opacity-90"
      actionBtnClass="bg-gradient-to-tr from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/40"
    >
      <div slot="background">
        <div class="absolute inset-0 bg-gray-900 transition-opacity"></div>
        <div
          class="absolute -right-8 -top-8 w-40 h-40 bg-purple-500/30 blur-[50px] group-hover:bg-pink-500/30 transition-all"
        ></div>
      </div>
      <div slot="decoration" class="flex gap-1 animate-pulse">
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
    </GameCard>

    <!-- 4. 네온 서바이버 -->
    <GameCard
      title="네온 서바이버"
      description="몰려오는 적들을 막아내고 성장하세요! <br /> 로그라이크와 네온 액션의 만남."
      badge="SURVIVAL RPG"
      onClick={() => goTo("neon-survivor")}
      className="border-2 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
      badgeClass="text-green-300 bg-green-900/50 border border-green-500/30 shadow-[0_0_10px_rgba(74,222,128,0.4)]"
      titleClass="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"
      descClass="text-gray-300 opacity-90"
      actionBtnClass="bg-gradient-to-tr from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/40"
    >
      <div slot="background">
        <div class="absolute inset-0 bg-gray-900 transition-opacity"></div>
        <div
          class="absolute -right-8 -top-8 w-40 h-40 bg-green-500/30 blur-[50px] group-hover:bg-emerald-500/30 transition-all"
        ></div>
      </div>
      <div slot="badge-extra">
        <span
          class="neon-badge-label text-[10px] font-black px-2 py-0.5 rounded italic tracking-widest text-white border-2 border-green-500"
        >
          NEW
        </span>
      </div>
      <div slot="decoration" class="flex gap-1 animate-pulse">
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
    </GameCard>
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
