<script>
  import { onMount, onDestroy } from "svelte";
  import { fly, fade } from "svelte/transition";
  import { quintOut, bounceOut } from "svelte/easing";
  import { base } from "../lib/store.js";

  // --- 1. 설정 ---
  const ROWS = 8;
  const COLS = 7;
  const FRUITS = ["🍎", "🍊", "🍇", "🥝", "🍋"];
  const BOMB = "💣";
  const MUSHROOM = "🍄";
  // 사운드 관리
  const popSoundPath = `${base}/sounds/pop.mp3`;
  const bombSoundPath = `${base}/sounds/bomb-explosion.mp3`;

  // --- 2. 상태 관리 ---
  let grid = [];
  let score = 0;
  let bestScore = 0;
  let isNewRecord = false;
  let isMuted = false;
  let isProcessing = false;
  let isShaking = false;

  let isHardMode = false;
  let energy = 100;
  let gameOver = false;
  let gameInterval = null;

  onMount(() => {
    bestScore = parseInt(localStorage.getItem("fruitBestScore") || "0");
    initGame();
  });

  function playPop(type = "normal") {
    if (isMuted) return;

    let soundPath = popSoundPath;
    let volume = 0.7;
    let duration = 300;

    if (type === "bomb") {
      soundPath = bombSoundPath;
      volume = 0.25; // 폭탄 볼륨 더 낮춤
      duration = 400;
    }

    const s = new Audio(soundPath);
    s.volume = volume;
    s.play().catch(() => {});

    setTimeout(() => {
      s.pause();
      s.remove();
    }, duration);
  }

  function startEnergyDrain() {
    stopEnergyDrain();
    energy = 100;
    gameInterval = setInterval(() => {
      if (isHardMode && !gameOver) {
        const speedMultiplier = 1 + score / 5000;
        energy = Math.max(0, energy - 0.6 * speedMultiplier);
        if (energy <= 0) handleGameOver();
      }
    }, 100);
  }

  function stopEnergyDrain() {
    if (gameInterval) clearInterval(gameInterval);
  }

  function handleGameOver() {
    stopEnergyDrain();
    gameOver = true;
    isShaking = true;
    playPop("bomb");
    setTimeout(() => (isShaking = false), 500);
  }

  function initGame(modeChange = false) {
    if (modeChange) score = 0;
    grid = Array.from({ length: ROWS }, () =>
      Array.from(
        { length: COLS },
        () => FRUITS[Math.floor(Math.random() * FRUITS.length)],
      ),
    );
    isNewRecord = false;
    isProcessing = false;
    gameOver = false;

    if (isHardMode) startEnergyDrain();
    else {
      stopEnergyDrain();
      energy = 100;
    }
  }

  async function handleCellClick(r, c) {
    if (isProcessing || gameOver) return;
    const target = grid[r][c];
    if (!target) return;

    if (target === MUSHROOM) {
      energy = Math.max(0, energy - 20);
      playPop("bomb");
      grid[r][c] = null;
      grid = [...grid];
      isProcessing = true;
      setTimeout(applyGravityOnly, 200);
      return;
    }

    if (target === BOMB) {
      isProcessing = true;
      await triggerBomb(r, c);
      return;
    }

    const group = getConnectedGroup(r, c, target);
    if (group.length >= 2) {
      isProcessing = true;
      playPop("normal"); // 한 그룹 터질 때 딱 한 번 재생

      score += group.length * 10;
      if (isHardMode) energy = Math.min(100, energy + group.length * 1.5);

      const shouldCreateBomb = group.length >= 5;
      group.forEach(({ r: row, c: col }, index) => {
        grid[row][col] = shouldCreateBomb && index === 0 ? BOMB : null;
      });
      grid = [...grid];
      setTimeout(applyGravityOnly, 200);
    }
  }

  function applyGravityOnly() {
    for (let c = 0; c < COLS; c++) {
      let emptyRow = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c] !== null) {
          const temp = grid[r][c];
          grid[r][c] = null;
          grid[emptyRow][c] = temp;
          emptyRow--;
        }
      }
    }
    grid = [...grid];
    setTimeout(refillGrid, 200);
  }

  function refillGrid() {
    let hasRefilled = false;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c] === null) {
          const rand = Math.random();
          if (isHardMode && rand < 0.07) grid[r][c] = MUSHROOM;
          else grid[r][c] = FRUITS[Math.floor(Math.random() * FRUITS.length)];
          hasRefilled = true;
        }
      }
    }
    if (hasRefilled) {
      // 리필 소리는 터지는 소리와 겹치지 않게 아주 살짝 지연해서 재생 가능
      setTimeout(() => playPop("refill"), 50);
      grid = [...grid];
    }
    if (score > bestScore) {
      bestScore = score;
      isNewRecord = true;
      localStorage.setItem("fruitBestScore", bestScore.toString());
    }
    setTimeout(() => {
      isProcessing = false;
    }, 200);
  }

  function getConnectedGroup(r, c, target, visited = new Set()) {
    const key = `${r},${c}`;
    if (
      r < 0 ||
      r >= ROWS ||
      c < 0 ||
      c >= COLS ||
      visited.has(key) ||
      grid[r][c] !== target
    )
      return [];
    visited.add(key);
    let group = [{ r, c }];
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].forEach(([dr, dc]) => {
      group = group.concat(getConnectedGroup(r + dr, c + dc, target, visited));
    });
    return group;
  }

  async function triggerBomb(r, c) {
    isShaking = true;
    playPop("bomb");
    for (let i = r - 1; i <= r + 1; i++) {
      for (let j = c - 1; j <= c + 1; j++) {
        if (i >= 0 && i < ROWS && j >= 0 && j < COLS) {
          grid[i][j] = null;
          score += 20;
        }
      }
    }
    grid = [...grid];
    setTimeout(() => {
      isShaking = false;
      applyGravityOnly();
    }, 300);
  }

  onDestroy(() => stopEnergyDrain());
</script>

<div
  class="flex flex-col items-center justify-between w-full h-[100dvh] bg-slate-50 dark:bg-gray-900 px-0 py-2 select-none overflow-hidden font-sans"
>
  <div class="w-full max-w-xs space-y-1.5 px-4 pt-1">
    <div
      class="text-center bg-indigo-600 text-white py-1 rounded-full shadow-md"
    >
      <p class="text-[11px] font-black italic">
        🍎 2개 이상 연결된 과일을 터치!
      </p>
    </div>

    <!-- Compact Score Board -->
    <div
      class="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-[1.5rem] shadow-xl border-b-4 border-indigo-100"
    >
      <div class="flex flex-col">
        <span class="text-[9px] font-bold text-gray-400 uppercase">Score</span>
        <span class="text-2xl font-black text-indigo-600 leading-none"
          >{score}</span
        >
      </div>
      <button
        on:click={() => (isMuted = !isMuted)}
        class="p-2 bg-slate-100 dark:bg-gray-700 rounded-xl text-lg"
      >
        {isMuted ? "🔇" : "🔊"}
      </button>
      <div class="flex flex-col items-end">
        <span class="text-[9px] font-bold text-gray-400 uppercase">Best</span>
        <span
          class="text-2xl font-black {isNewRecord
            ? 'text-orange-500 animate-bounce'
            : 'text-purple-600'} leading-none">{bestScore}</span
        >
      </div>
    </div>

    <div
      class="w-full h-4 bg-slate-200 dark:bg-gray-800 rounded-full p-1 shadow-inner transition-all {isHardMode
        ? 'opacity-100 scale-100'
        : 'opacity-0 scale-95 pointer-events-none'}"
    >
      <div
        class="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 transition-all duration-150 ease-linear"
        style="width: {energy}%"
      ></div>
    </div>

    <!-- Mode Buttons Moved to Top -->
    <div class="grid grid-cols-2 gap-2 pt-1">
      <button
        on:click={() => {
          isHardMode = false;
          initGame(true);
        }}
        class="py-1.5 rounded-xl font-black text-[11px] transition-all {!isHardMode
          ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100'
          : 'text-gray-400 bg-slate-100 dark:bg-gray-800 dark:text-gray-500'}"
      >
        일반 모드
      </button>
      <button
        on:click={() => {
          isHardMode = true;
          initGame(true);
        }}
        class="py-1.5 rounded-xl font-black text-[11px] transition-all {isHardMode
          ? 'bg-red-500 text-white shadow-md'
          : 'text-gray-400 bg-slate-100 dark:bg-gray-800 dark:text-gray-500'}"
      >
        하드 모드 🔥
      </button>
    </div>
  </div>

  <div
    class="flex-1 min-h-0 w-full flex items-center justify-center relative {isShaking
      ? 'shake-animation'
      : ''}"
  >
    <!-- Board Wrapper: Constrained by height and width to prevent overflow -->
    <div
      class="max-h-full max-w-[96%] min-w-0 w-auto h-auto aspect-[7/9] mx-auto bg-indigo-200 dark:bg-gray-700 p-1 rounded-[1.5rem] shadow-2xl border-2 border-white flex flex-col justify-center"
    >
      <div
        class="grid grid-cols-7 gap-px bg-white/40 rounded-[1.2rem] p-1 w-full h-full"
      >
        {#each grid as row, r}
          {#each row as cell, c}
            <div
              class="w-full aspect-square flex items-center justify-center relative"
            >
              {#if cell}
                <button
                  class="w-full h-full flex items-center justify-center text-3xl xs:text-4xl sm:text-5xl bg-white dark:bg-gray-800 rounded-md shadow-sm active:scale-75 transition-all duration-200"
                  on:click={() => handleCellClick(r, c)}
                  in:fly={{
                    y: -30,
                    duration: 400,
                    easing: bounceOut,
                    delay: r * 15,
                  }}
                >
                  <span
                    class={cell === BOMB || cell === MUSHROOM
                      ? "animate-pulse scale-110"
                      : ""}>{cell}</span
                  >
                </button>
              {/if}
            </div>
          {/each}
        {/each}
      </div>
    </div>

    {#if gameOver}
      <div
        class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 rounded-[2.5rem] backdrop-blur-md"
        in:fade
      >
        <span class="text-6xl mb-4">😵</span>
        <h2 class="text-3xl font-black text-white mb-2">게임 종료!</h2>
        <p class="text-indigo-300 font-bold text-xl mb-6">{score} 점 획득!</p>
        <button
          on:click={() => initGame()}
          class="bg-white text-indigo-600 px-8 py-3 rounded-2xl font-black shadow-2xl active:scale-95 transition-all"
        >
          다시 도전하기
        </button>
      </div>
    {/if}
  </div>

  <!-- Footer removed -->
</div>

<style>
  .shake-animation {
    animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }
  @keyframes shake {
    10%,
    90% {
      transform: translate3d(-1px, 0, 0);
    }
    20%,
    80% {
      transform: translate3d(2px, 0, 0);
    }
    30%,
    50%,
    70% {
      transform: translate3d(-3px, 0, 0);
    }
    40%,
    60% {
      transform: translate3d(3px, 0, 0);
    }
  }
  :global(body) {
    background-color: #f8fafc;
    margin: 0;
    padding: 0;
  }
  button {
    -webkit-tap-highlight-color: transparent;
    outline: none;
  }
</style>
