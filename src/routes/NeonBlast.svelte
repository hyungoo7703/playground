<script>
  import { onMount, onDestroy, tick } from "svelte";
  import { gameStore, base } from "../lib/store.js";
  import { generateStage } from "../lib/neon/blast/StageData.js";
  import {
    initPhysics,
    updatePhysics,
    shootBall,
  } from "../lib/neon/blast/PhysicsEngine.js";

  let canvas,
    ctx,
    frame,
    isStarted = false;
  let isMuted = false;
  let zapAudio, bgmAudio;
  let mouseX = 200;
  let currentStageData;

  const playSfx = (name) => {
    if (isMuted) return;
    const audio = new Audio(`${base}/sounds/neon/blast/${name}.mp3`);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  function stopPersistentSounds() {
    if (zapAudio) {
      zapAudio.pause();
      zapAudio.currentTime = 0;
    }
    gameStore.update((s) => ({ ...s, wasZoneActive: false }));
  }

  async function start(isNew = true) {
    if (isNew) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          "neon_blast_save",
          JSON.stringify({ level: 1, highScore: $gameStore.highScore }),
        );
      }
      gameStore.update((s) => ({ ...s, currentLevel: 1 }));
    }
    isStarted = true;
    await tick();
    ctx = canvas.getContext("2d");
    zapAudio = new Audio(`${base}/sounds/neon/blast/zap-synth.mp3`);
    zapAudio.loop = true;
    zapAudio.volume = 0.3;
    bgmAudio = new Audio(`${base}/sounds/neon/blast/bgm.mp3`);
    bgmAudio.loop = true;
    bgmAudio.volume = 0.4;
    if (!isMuted) bgmAudio.play().catch(() => {});
    currentStageData = generateStage($gameStore.currentLevel);
    initPhysics(currentStageData);
    loop();
  }

  function handleRetry() {
    stopPersistentSounds();
    initPhysics(currentStageData);
  }
  function handleNextStage() {
    stopPersistentSounds();
    currentStageData = generateStage($gameStore.currentLevel);
    initPhysics(currentStageData);
  }

  function loop() {
    updatePhysics(canvas.width, canvas.height);
    render();
    frame = requestAnimationFrame(loop);
  }

  function render() {
    if (!ctx) return;

    // 1. Apply Shake
    ctx.save();
    if ($gameStore.shake > 0) {
      const dx = (Math.random() - 0.5) * $gameStore.shake;
      const dy = (Math.random() - 0.5) * $gameStore.shake;
      ctx.translate(dx, dy);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    $gameStore.zones.forEach((z) => {
      ctx.fillStyle = "rgba(217, 70, 239, 0.15)";
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "#d946ef";
      ctx.lineWidth = 2;
      ctx.strokeRect(z.x, z.y, z.w, z.h);
    });

    $gameStore.portals.forEach((p) => {
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#00f3ff";
      ctx.strokeStyle = "#00f3ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.entry.x, p.entry.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowColor = "#ff8800";
      ctx.strokeStyle = "#ff8800";
      ctx.beginPath();
      ctx.arc(p.exit.x, p.exit.y, 22, 0, Math.PI * 2);
      ctx.stroke();
    });

    $gameStore.rotatingBars.forEach((b) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#00ff88";
      ctx.fillStyle = "#fff";
      ctx.fillRect(-b.length / 2, -b.width / 2, b.length, b.width);
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2;
      ctx.strokeRect(-b.length / 2, -b.width / 2, b.length, b.width);
      ctx.restore();
    });

    $gameStore.movingWalls.forEach((w) => {
      ctx.fillStyle = "#fff";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#fff";
      ctx.fillRect(w.x - w.w / 2, w.y - w.h / 2, w.w, w.h);
    });

    if ($gameStore.suctionTarget) {
      ctx.shadowBlur = 50;
      ctx.shadowColor = "#ff00ff";
      ctx.fillStyle = "rgba(255, 0, 255, 0.2)";
      ctx.beginPath();
      ctx.arc(
        $gameStore.suctionTarget.x,
        $gameStore.suctionTarget.y,
        60,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    $gameStore.pegs.forEach((p) => {
      if (!p.active) return;
      const isSuction = p.type === "suction";
      const isGold = p.type === "gold";
      ctx.shadowBlur = isSuction ? 50 : isGold ? 45 : 15;
      ctx.shadowColor = p.color;
      ctx.fillStyle = isSuction ? "#d900ff" : isGold ? "#fff" : p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      if (isSuction || isGold) {
        ctx.strokeStyle = isSuction ? "#ffbbfb" : "#ffff00";
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    });

    $gameStore.balls.forEach((b) => {
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ff00ff";
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Render Particles
    if ($gameStore.particles && $gameStore.particles.length > 0) {
      $gameStore.particles.forEach((p) => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color || "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    // 3. Render Floating Texts
    if ($gameStore.floatingTexts && $gameStore.floatingTexts.length > 0) {
      ctx.textAlign = "center";
      ctx.font = "bold 16px Arial";
      $gameStore.floatingTexts.forEach((t) => {
        ctx.globalAlpha = Math.max(0, t.life); // Ensure alpha is non-negative
        ctx.fillStyle = t.color || "#fff";
        ctx.fillText(t.text, t.x, t.y);
        ctx.globalAlpha = 1;
      });
    }

    // 4. Render Combo UI (Bottom Right overlay inside canvas)
    if ($gameStore.currentCombo > 1) {
      ctx.save();
      ctx.font = "italic 900 36px Arial";
      ctx.fillStyle = "#ffff00";
      ctx.strokeStyle = "#ff00ff";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#ff00ff";
      ctx.shadowBlur = 20;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const text = `${$gameStore.currentCombo} COMBO!`;
      ctx.translate(canvas.width / 2, canvas.height / 2); // Center
      ctx.strokeText(text, -100, 0);
      ctx.fillText(text, -100, 0);
      ctx.restore();
    }

    ctx.restore(); // Restore shake transform
  }

  function handleShoot(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    shootBall((e.clientX - rect.left) * scaleX);
  }

  const onPegHit = () => playSfx("glass-clink");
  const onPortalWarp = () => playSfx("warp");
  const onPowerUp = () => playSfx("power-up");
  const onZoneStart = () => {
    if (!isMuted && zapAudio) zapAudio.play();
  };
  const onZoneStop = () => {
    if (zapAudio) {
      zapAudio.pause();
      zapAudio.currentTime = 0;
    }
  };

  onMount(() => {
    window.addEventListener("pegHit", onPegHit);
    window.addEventListener("portalWarp", onPortalWarp);
    window.addEventListener("powerUp", onPowerUp);
    window.addEventListener("zoneStart", onZoneStart);
    window.addEventListener("zoneStop", onZoneStop);
  });

  onDestroy(() => {
    window.removeEventListener("pegHit", onPegHit);
    window.removeEventListener("portalWarp", onPortalWarp);
    window.removeEventListener("powerUp", onPowerUp);
    window.removeEventListener("zoneStart", onZoneStart);
    window.removeEventListener("zoneStop", onZoneStop);
    stopPersistentSounds();
    cancelAnimationFrame(frame);
    if (bgmAudio) bgmAudio.pause();
  });
</script>

<div
  class="flex flex-col items-center w-full h-full md:h-auto md:min-h-screen bg-[#050505] text-white select-none font-sans relative overflow-hidden md:overflow-y-auto"
>
  {#if !isStarted}
    <div
      class="flex flex-col items-center justify-center min-h-[100dvh] w-full px-6 py-20 z-10"
    >
      <h1
        class="text-6xl md:text-7xl font-black text-cyan-400 drop-shadow-[0_0_20px_#22d3ee] mb-16 italic text-center leading-tight"
      >
        NEON BLAST
      </h1>
      <div class="flex flex-col gap-6 w-full max-w-sm">
        <button
          on:click={() => start(true)}
          class="w-full py-6 bg-cyan-500 rounded-full font-black text-2xl shadow-xl active:scale-95 transition-all"
          >새 게임</button
        >
        {#if $gameStore.currentLevel > 1}
          <button
            on:click={() => start(false)}
            class="w-full py-6 bg-gray-800 rounded-full font-black text-2xl border border-gray-600 active:scale-95"
            >이어하기 (LV.{$gameStore.currentLevel})</button
          >
        {/if}
      </div>
    </div>
  {:else}
    <header
      class="w-full max-w-[500px] px-5 py-1 flex justify-between items-center bg-gray-900/60 backdrop-blur-md border-b border-white/10 shrink-0 z-20"
    >
      <div class="flex flex-col">
        <span
          class="text-[10px] text-cyan-400 font-bold uppercase tracking-widest leading-none"
          >Stage {$gameStore.currentLevel}</span
        >
        <p class="text-2xl font-black italic text-white mt-1">
          {$gameStore.ballsLeft}
        </p>
      </div>
      <button
        on:click={() => {
          isMuted = !isMuted;
          if (isMuted) {
            bgmAudio.pause();
            zapAudio.pause();
          } else {
            bgmAudio.play();
          }
        }}
        class="p-2 bg-gray-800 rounded-xl border border-gray-700 active:scale-90"
      >
        {isMuted ? "🔇" : "🔊"}
      </button>
      <div class="text-right flex flex-col">
        <span
          class="text-[10px] text-magenta-500 font-bold uppercase tracking-widest leading-none"
          >Score</span
        >
        <p class="text-2xl font-black italic text-white mt-1">
          {$gameStore.score}
        </p>
      </div>
    </header>

    <main
      class="flex-1 w-full max-w-[500px] flex flex-col items-center justify-center p-1 min-h-0 relative"
    >
      <div class="mb-1 text-center shrink-0 z-10">
        <p
          class="text-yellow-400 font-black text-sm md:text-base animate-pulse"
        >
          ✨ 모든 황금 핀 제거 시 클리어! ✨
        </p>
      </div>

      <div
        class="relative w-full h-full max-h-[80dvh] md:max-h-none aspect-[2/3] touch-none"
      >
        <canvas
          bind:this={canvas}
          width="400"
          height="600"
          on:click={handleShoot}
          on:mousemove={(e) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
          }}
          class="w-full h-full rounded-[2.5rem] border-4 border-[#00f3ff] shadow-[0_0_40px_rgba(0,243,255,0.25)]"
          style="background: url('{base}/images/neon/blast/background.png') center/cover;"
        ></canvas>

        {#if $gameStore.isWin || $gameStore.isGameOver}
          <div
            class="absolute inset-0 bg-black/95 flex flex-col items-center justify-center rounded-[2.8rem] z-50 p-6 backdrop-blur-sm animate-fade-in"
          >
            <h2
              class="text-4xl md:text-5xl font-black mb-10 text-center {$gameStore.isWin
                ? 'text-yellow-400'
                : 'text-red-600'}"
            >
              {$gameStore.isWin ? "GOLDEN CLEAR!" : "FAILED"}
            </h2>
            <div class="flex flex-col gap-4 w-full max-w-[260px]">
              {#if $gameStore.isWin}
                <button
                  on:click={handleNextStage}
                  class="w-full py-4 bg-cyan-500 rounded-full font-black text-xl shadow-lg active:scale-95 transition-all"
                  >다음 레벨</button
                >
              {:else}
                <button
                  on:click={handleRetry}
                  class="w-full py-4 bg-magenta-500 rounded-full font-black text-xl shadow-lg active:scale-95 transition-all"
                  >다시 도전</button
                >
              {/if}
              <button
                on:click={() => location.reload()}
                class="w-full py-3 bg-gray-800 rounded-full font-black text-lg border border-gray-600 active:scale-95"
                >메인 메뉴</button
              >
            </div>
          </div>
        {/if}
      </div>
    </main>

    <footer
      class="w-full py-2 shrink-0 text-center text-[10px] text-gray-500 uppercase tracking-widest bg-gradient-to-t from-black to-transparent"
    >
      Neon Blast: Gravity Arena
    </footer>
  {/if}
</div>

<style>
  canvas {
    touch-action: none;
    cursor: crosshair;
  }
  .animate-fade-in {
    animation: fadeIn 0.4s ease-out;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  :global(body) {
    background-color: #050505;
    margin: 0;
    padding: 0;
    width: 100%;
    min-height: 100%;
  }
</style>
