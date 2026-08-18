<script>
  import { onMount, onDestroy } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { navigate } from "svelte-routing";
  import { base } from "../lib/store.js";

  const SIZE = 4;
  const SAVE_KEY = "neon2048_save";

  let board = emptyBoard();
  let score = 0;
  let best = 0;
  let moveCount = 0; // 셀 애니메이션 재시작용 key
  let spawnCell = null; // "r,c"
  let mergedCells = new Set();
  let isGameOver = false;
  let hasWon = false; // 2048 달성 순간 1회 표시
  let keepPlaying = false;

  // 값별 네온 색상 (배경, 글로우)
  const TILE_COLORS = {
    2: ["#155e75", "rgba(34,211,238,0.25)"],
    4: ["#0e7490", "rgba(34,211,238,0.35)"],
    8: ["#0f766e", "rgba(45,212,191,0.4)"],
    16: ["#15803d", "rgba(74,222,128,0.4)"],
    32: ["#4d7c0f", "rgba(163,230,53,0.4)"],
    64: ["#a16207", "rgba(250,204,21,0.45)"],
    128: ["#c2410c", "rgba(251,146,60,0.5)"],
    256: ["#be123c", "rgba(251,113,133,0.5)"],
    512: ["#a21caf", "rgba(232,121,249,0.55)"],
    1024: ["#7e22ce", "rgba(192,132,252,0.6)"],
    2048: ["#4f46e5", "rgba(129,140,248,0.8)"],
  };

  const tileStyle = (v) => {
    if (!v) return "";
    const [bg, glow] = TILE_COLORS[v] || ["#e2e8f0", "rgba(255,255,255,0.8)"];
    const color = TILE_COLORS[v] ? "#fff" : "#0f172a";
    return `background:${bg}; box-shadow:0 0 16px ${glow}, inset 0 0 8px rgba(255,255,255,0.08); color:${color};`;
  };

  function emptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function spawnTile(b) {
    const empty = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) if (!b[r][c]) empty.push([r, c]);
    if (empty.length === 0) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    b[r][c] = Math.random() < 0.9 ? 2 : 4;
    spawnCell = `${r},${c}`;
  }

  // 한 행을 왼쪽으로 밀며 병합
  function slideRow(row) {
    const vals = row.filter(Boolean);
    const out = [];
    const mergedIdx = [];
    let gained = 0;
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === vals[i + 1]) {
        const merged = vals[i] * 2;
        out.push(merged);
        gained += merged;
        mergedIdx.push(out.length - 1);
        i++;
      } else {
        out.push(vals[i]);
      }
    }
    while (out.length < SIZE) out.push(0);
    return { row: out, gained, mergedIdx };
  }

  const transpose = (b) => b[0].map((_, c) => b.map((row) => row[c]));
  const reverseRows = (b) => b.map((row) => [...row].reverse());

  function move(dir) {
    if (isGameOver) return;

    // 모든 방향을 '왼쪽 밀기'로 정규화
    let work = board.map((row) => [...row]);
    if (dir === "right") work = reverseRows(work);
    else if (dir === "up") work = transpose(work);
    else if (dir === "down") work = reverseRows(transpose(work));

    let gainedTotal = 0;
    const merged = new Set();
    work = work.map((row, r) => {
      const { row: newRow, gained, mergedIdx } = slideRow(row);
      gainedTotal += gained;
      mergedIdx.forEach((c) => merged.add(`${r},${c}`));
      return newRow;
    });

    // work 좌표(r,c) → 원래 board 좌표 (정규화 변환의 역)
    const restore = (r, c) => {
      if (dir === "right") return [r, SIZE - 1 - c];
      if (dir === "up") return [c, r];
      if (dir === "down") return [SIZE - 1 - c, r];
      return [r, c];
    };

    if (dir === "right") work = reverseRows(work);
    else if (dir === "up") work = transpose(work);
    else if (dir === "down") work = transpose(reverseRows(work));

    const changed = JSON.stringify(work) !== JSON.stringify(board);
    if (!changed) return;

    mergedCells = new Set(
      [...merged].map((key) => {
        const [r, c] = key.split(",").map(Number);
        return restore(r, c).join(",");
      }),
    );

    board = work;
    score += gainedTotal;
    if (score > best) best = score;
    spawnCell = null;
    spawnTile(board);
    board = board; // reactivity
    moveCount++;

    if (!hasWon && !keepPlaying && board.flat().includes(2048)) {
      hasWon = true;
    }
    if (!canMove(board)) isGameOver = true;

    saveGame();
    if (navigator.vibrate && gainedTotal > 0) navigator.vibrate(15);
  }

  function canMove(b) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!b[r][c]) return true;
        if (c < SIZE - 1 && b[r][c] === b[r][c + 1]) return true;
        if (r < SIZE - 1 && b[r][c] === b[r + 1][c]) return true;
      }
    }
    return false;
  }

  function newGame() {
    board = emptyBoard();
    score = 0;
    moveCount = 0;
    isGameOver = false;
    hasWon = false;
    keepPlaying = false;
    mergedCells = new Set();
    spawnCell = null;
    spawnTile(board);
    spawnTile(board);
    board = board;
    saveGame();
  }

  function saveGame() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ board, score, best, isGameOver }),
      );
    } catch {
      /* storage full — 진행 저장은 포기해도 게임엔 지장 없음 */
    }
  }

  function loadGame() {
    try {
      const save = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (save && Array.isArray(save.board) && save.board.length === SIZE) {
        board = save.board;
        score = save.score || 0;
        best = save.best || 0;
        isGameOver = !!save.isGameOver;
        if (board.flat().every((v) => v === 0)) newGame();
        return;
      }
    } catch {
      localStorage.removeItem(SAVE_KEY);
    }
    newGame();
  }

  // --- 입력: 키보드 + 스와이프 ---
  const KEY_DIRS = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    a: "left",
    d: "right",
    w: "up",
    s: "down",
  };

  function handleKeydown(e) {
    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  }

  let touchStart = null;

  function handleTouchStart(e) {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function handleTouchEnd(e) {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  }

  onMount(() => {
    loadGame();
    window.addEventListener("keydown", handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
</script>

<div
  class="w-full h-full flex flex-col items-center justify-center bg-[#050505] text-white select-none px-4"
  style="touch-action: none;"
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
>
  <!-- Header -->
  <div class="w-full max-w-sm flex items-center justify-between mb-4">
    <div>
      <h1
        class="text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent"
      >
        NEON 2048
      </h1>
      <p class="text-[10px] text-gray-500 font-bold">
        밀어서 같은 숫자를 합쳐보세요!
      </p>
    </div>
    <button
      type="button"
      on:click={() => navigate(`${base}/menu`)}
      class="p-2 text-gray-400 hover:text-white bg-white/5 rounded-xl text-sm font-bold"
    >
      ✕
    </button>
  </div>

  <!-- Score Bar -->
  <div class="w-full max-w-sm grid grid-cols-3 gap-2 mb-4">
    <div class="bg-white/5 rounded-2xl p-2.5 text-center border border-white/10">
      <p class="text-[9px] text-gray-500 font-black uppercase tracking-wider">Score</p>
      <p class="text-lg font-black text-cyan-300 leading-tight">
        {score.toLocaleString()}
      </p>
    </div>
    <div class="bg-white/5 rounded-2xl p-2.5 text-center border border-white/10">
      <p class="text-[9px] text-gray-500 font-black uppercase tracking-wider">Best</p>
      <p class="text-lg font-black text-amber-300 leading-tight">
        {best.toLocaleString()}
      </p>
    </div>
    <button
      type="button"
      on:click={newGame}
      class="bg-indigo-600/80 hover:bg-indigo-600 rounded-2xl text-xs font-black active:scale-95 transition-all border border-indigo-400/30"
    >
      🔄 새 게임
    </button>
  </div>

  <!-- Board -->
  <div
    class="relative w-full max-w-sm aspect-square bg-white/5 rounded-3xl p-2.5 border border-white/10"
    style="box-shadow: 0 0 40px rgba(99,102,241,0.15);"
  >
    <div class="grid grid-cols-4 grid-rows-4 gap-2.5 w-full h-full">
      {#each board as row, r}
        {#each row as cell, c}
          <div class="relative bg-white/5 rounded-xl">
            {#if cell}
              {#key `${moveCount}-${r}-${c}-${cell}`}
                <div
                  class="absolute inset-0 rounded-xl flex items-center justify-center font-black
                    {mergedCells.has(`${r},${c}`) ? 'tile-merge' : ''}
                    {spawnCell === `${r},${c}` ? 'tile-spawn' : ''}
                    {cell >= 1024 ? 'text-lg' : cell >= 128 ? 'text-xl' : 'text-2xl'}"
                  style={tileStyle(cell)}
                >
                  {cell}
                </div>
              {/key}
            {/if}
          </div>
        {/each}
      {/each}
    </div>

    <!-- Win Overlay -->
    {#if hasWon && !keepPlaying}
      <div
        transition:fade
        class="absolute inset-0 z-10 bg-black/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center gap-4"
      >
        <span class="text-5xl" in:scale>🏆</span>
        <p class="text-2xl font-black text-fuchsia-300">2048 달성!</p>
        <div class="flex gap-2">
          <button
            type="button"
            on:click={() => (keepPlaying = true)}
            class="px-5 py-3 bg-indigo-600 rounded-2xl font-black text-sm active:scale-95"
          >
            계속하기
          </button>
          <button
            type="button"
            on:click={newGame}
            class="px-5 py-3 bg-white/10 rounded-2xl font-black text-sm active:scale-95"
          >
            새 게임
          </button>
        </div>
      </div>
    {/if}

    <!-- Game Over Overlay -->
    {#if isGameOver}
      <div
        transition:fade
        class="absolute inset-0 z-10 bg-black/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center gap-4"
      >
        <span class="text-5xl">💥</span>
        <p class="text-2xl font-black text-rose-300">게임 오버!</p>
        <p class="text-sm text-gray-400 font-bold">
          점수: {score.toLocaleString()}
        </p>
        <button
          type="button"
          on:click={newGame}
          class="px-6 py-3 bg-indigo-600 rounded-2xl font-black text-sm active:scale-95"
        >
          🔄 다시 도전
        </button>
      </div>
    {/if}
  </div>

  <p class="text-[10px] text-gray-600 font-bold mt-4">
    ⬅️➡️⬆️⬇️ 스와이프 또는 방향키로 조작
  </p>
</div>

<style>
  .tile-spawn {
    animation: spawn 0.18s ease-out;
  }
  .tile-merge {
    animation: merge 0.22s ease-out;
  }
  @keyframes spawn {
    from {
      transform: scale(0.4);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
  @keyframes merge {
    0% {
      transform: scale(1);
    }
    45% {
      transform: scale(1.18);
    }
    100% {
      transform: scale(1);
    }
  }
</style>
