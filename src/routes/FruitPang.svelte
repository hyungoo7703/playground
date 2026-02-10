<script>
  import { onMount, onDestroy } from "svelte";
  import { fly, fade } from "svelte/transition";
  import { quintOut, bounceOut } from "svelte/easing";
  import { base } from "../lib/store.js";
  import { audioManager } from "../lib/audioManager.js";
  import {
    createGrid,
    getConnectedGroup,
    applyGravity,
    fillEmptyCells,
    explodeBomb,
    ROWS,
    COLS,
    FRUITS,
    BOMB,
    MUSHROOM,
  } from "../lib/fruitPangLogic.js";

  // 사운드 경로
  const SOUND_POP = "pop";
  const SOUND_BOMB = "bomb";

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
    audioManager.load(SOUND_POP, `${base}/sounds/pop.mp3`, 10);
    audioManager.load(SOUND_BOMB, `${base}/sounds/bomb-explosion.mp3`, 3);
    initGame();
  });

  function playPop(type = "normal") {
    if (isMuted) return;
    if (type === "bomb") {
      audioManager.play(SOUND_BOMB, 0.4, 400);
    } else {
      audioManager.play(SOUND_POP, 0.7, 300);
    }
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
    grid = createGrid();
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

    const group = getConnectedGroup(grid, r, c, target);
    if (group.length >= 2) {
      isProcessing = true;
      playPop("normal");

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
    grid = applyGravity(grid);
    grid = [...grid];
    setTimeout(refillGrid, 200);
  }

  function refillGrid() {
    const result = fillEmptyCells(grid, isHardMode);
    grid = result.grid;

    if (result.hasRefilled) {
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

  async function triggerBomb(r, c) {
    isShaking = true;
    playPop("bomb");

    const result = explodeBomb(grid, r, c);
    grid = result.grid;
    score += result.scoreDelta;

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
        on:click={() => {
          isMuted = !isMuted;
          audioManager.setMute(isMuted);
        }}
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
