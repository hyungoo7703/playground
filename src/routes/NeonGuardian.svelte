<script>
  import { onMount, onDestroy } from "svelte";
  import { navigate } from "svelte-routing";
  import { base, currentUser } from "../lib/store.js";
  import { api } from "../lib/api.js";
  import { toast } from "../lib/feedback.js";
  import { REWARD_LABELS } from "../lib/rewards.js";
  import { createSound } from "../lib/guardian/sound.js";
  import GameExitButton from "../lib/components/GameExitButton.svelte";
  import { createGame, update, pickUpgrade, useBomb, reroll } from "../lib/guardian/engine.js";
  import { FIELD, PLAYER, ENEMIES, WAVES, BOSSES, ELITE, UPGRADES, RARITY } from "../lib/guardian/config.js";

  const IMG = `${base}/images/guardian`;
  const SND = `${base}/sounds`;

  const MUSIC = "retro-color-moon.mp3";
  // name: [file, volume, minimum ms between plays, seconds to play (0 = whole file)].
  // Several files run for seconds, so the rapid ones are cut short to keep them from piling up.
  const SOUNDS = {
    shoot: ["laser-zap.mp3", 0.18, 70, 0.18],
    critShot: ["laser-zap.mp3", 0.5, 0, 0.45],
    hit: ["punch.mp3", 0.25, 60, 0.16],
    kill: ["pop.mp3", 0.5, 40, 0.3],
    blast: ["pop.mp3", 0.3, 90, 0.22],
    chain: ["zap-synth.mp3", 0.16, 140, 0.22],
    coin: ["drop-coin.mp3", 0.3, 90, 0.4],
    upgrade: ["level-up.mp3", 0.6, 0, 0],
    reroll: ["drop-coin.mp3", 0.5, 0, 0],
    waveClear: ["power-up.mp3", 0.45, 0, 1.4],
    bomb: ["bomb-explosion.mp3", 0.7, 0, 1.8],
    shield: ["glass-clink.mp3", 0.7, 0, 0],
    leak: ["zap-synth.mp3", 0.5, 0, 0.5],
    bossWarn: ["beep-warning.mp3", 0.6, 0, 0],
    bossArrive: ["warp.mp3", 0.6, 0, 0],
    bossPhase: ["warp.mp3", 0.6, 0, 0],
    bossDead: ["epic-cinematic-explosion.mp3", 0.8, 0, 0],
    clear: ["universfield-clear-bell-chime-487898.mp3", 0.8, 0, 0],
    gameOver: ["universfield-game-over-deep-male-voice-clip-352695.mp3", 0.8, 0, 0],
  };

  const RARITY_STYLE = {
    common: "border-white/25 bg-white/10",
    rare: "border-sky-300/70 bg-sky-400/15 shadow-[0_0_18px_rgba(56,189,248,0.35)]",
    epic: "border-amber-300/80 bg-amber-400/15 shadow-[0_0_22px_rgba(251,191,36,0.45)]",
  };
  const RARITY_TEXT = { common: "text-gray-300", rare: "text-sky-300", epic: "text-amber-300" };

  // Draw size in field units and the glow colour added around each sprite
  const SPRITES = {
    drone: { file: "enemy-drone", size: 46, glow: "#ff3df2" },
    mini: { file: "enemy-drone", size: 28, glow: "#ff3df2" },
    dart: { file: "enemy-dart", size: 44, glow: "#ffe14a" },
    tank: { file: "enemy-tank", size: 72, glow: "#ff8a1f" },
    carrier: { file: "enemy-carrier", size: 54, glow: "#3dff6e" },
    boss: { file: "boss", size: 168, glow: "#27e4ff" },
    midboss: { file: "boss", size: 124, glow: "#ff5ad1" },
    turret: { file: "turret", size: 60, glow: "#27e4ff" },
  };

  const LAST_WAVE = WAVES.length;
  // A clear whose card has not been drawn yet survives closing the app
  const pendingKey = `guardian_reward_pending_${$currentUser}`;

  let screen = "loading"; // loading | start | playing | upgrade | over | clear
  let hud = { wave: 1, hp: PLAYER.hp, shield: 0, coins: 0, bombCost: PLAYER.bombCost, rerollCost: 0, choices: [], levels: {} };
  let reward = "checking"; // checking | available | claimed | error
  let hasPending = localStorage.getItem(pendingKey) === "1";
  let isMuted = false;
  let showRules = false;

  let wrap;
  let canvas;
  let ctx;
  let game = null;
  let raf = 0;
  let lastTime = 0;
  let viewScale = 1;
  let pixelRatio = 1;
  let originX = 0;
  let originY = 0;
  let images = {};
  let stamps = {};
  let sound;

  const input = { aim: 0, firing: false };
  let particles = [];
  let effects = []; // short-lived blast rings and lightning arcs
  let shake = 0;
  let flash = 0;
  let leakFlash = 0;
  let muzzle = 0;
  const lastPlayed = {};

  function play(name) {
    const [file, volume, gap, seconds] = SOUNDS[name];
    const now = performance.now();
    if (gap && now - (lastPlayed[name] ?? 0) < gap) return;
    lastPlayed[name] = now;
    sound.play(file, volume, seconds);
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `${IMG}/${file}.webp`;
    });
  }

  // Sprites are drawn once with their glow, at device resolution, then stamped each frame
  function buildStamps() {
    const pad = 10;
    for (const [key, s] of Object.entries(SPRITES)) {
      const c = document.createElement("canvas");
      c.width = c.height = Math.ceil((s.size + pad * 2) * pixelRatio);
      const g = c.getContext("2d");
      g.shadowColor = s.glow;
      g.shadowBlur = 8 * pixelRatio;
      g.drawImage(images[s.file], pad * pixelRatio, pad * pixelRatio, s.size * pixelRatio, s.size * pixelRatio);
      stamps[key] = { canvas: c, half: s.size / 2 + pad };
    }
  }

  function stamp(key, x, y, rotation = 0, scale = 1) {
    const s = stamps[key];
    const half = s.half * scale;
    if (!rotation) return ctx.drawImage(s.canvas, x - half, y - half, half * 2, half * 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(s.canvas, -half, -half, half * 2, half * 2);
    ctx.restore();
  }

  function resize() {
    if (!wrap || !canvas) return;
    const { width, height } = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    viewScale = Math.min(width / FIELD.w, height / FIELD.h);
    originX = (width - FIELD.w * viewScale) / 2;
    originY = (height - FIELD.h * viewScale) / 2;
    const ratio = viewScale * dpr;
    if (ratio !== pixelRatio) {
      pixelRatio = ratio;
      if (images.turret) buildStamps();
    }
    if (screen !== "playing") draw();
  }

  function burst(x, y, color, count, speed = 120) {
    for (let i = 0; i < count && particles.length < 320; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 0.35 + Math.random() * 0.35, color });
    }
  }

  function handle(events) {
    for (const e of events) {
      if (SOUNDS[e.type]) play(e.type);
      if (e.type === "shoot") muzzle = 0.06;
      else if (e.type === "critShot") muzzle = 0.14;
      else if (e.type === "blast") effects.push({ ...e, life: 0.22, span: 0.22 });
      else if (e.type === "chain") effects.push({ ...e, life: 0.14, span: 0.14 });
      else if (e.type === "hit") burst(e.x, e.y, "#bff6ff", 3, 80);
      else if (e.type === "kill") burst(e.x, e.y, SPRITES[e.kind]?.glow ?? "#ff5a5a", BOSSES[e.kind] ? 0 : 12);
      else if (e.type === "leak") {
        leakFlash = 0.4;
        shake = 10;
        navigator.vibrate?.(60);
      } else if (e.type === "bomb") {
        flash = 0.5;
        shake = 14;
      } else if (e.type === "bossDead") {
        burst(e.x, e.y, "#ff5a5a", 80, 260);
        burst(e.x, e.y, "#27e4ff", 60, 200);
        flash = 0.8;
        shake = 20;
      }
    }
  }

  function syncHud() {
    const coins = Math.floor(game.coins);
    const changed =
      hud.wave !== game.wave + 1 ||
      hud.hp !== game.hp ||
      hud.shield !== game.shield ||
      hud.coins !== coins ||
      hud.bombCost !== game.bombCost;
    if (changed) {
      hud = { ...hud, wave: game.wave + 1, hp: game.hp, shield: game.shield, coins, bombCost: game.bombCost };
    }
    if (game.phase === "upgrade" && hud.choices !== game.choices) {
      hud = { ...hud, choices: game.choices, levels: { ...game.levels }, rerollCost: game.rerollCost, rich: game.richDraft };
    }
    if (game.phase === screen) return;
    if (game.phase === "over" || game.phase === "clear") {
      sound.stopMusic();
      input.firing = false;
    }
    if (game.phase === "clear") {
      localStorage.setItem(pendingKey, "1");
      hasPending = true;
      checkReward();
    }
    screen = game.phase;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (screen === "playing") {
      handle(update(game, dt, input));
      syncHud();
    }
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const fx of effects) fx.life -= dt;
    effects = effects.filter((fx) => fx.life > 0);
    shake = Math.max(0, shake - 40 * dt);
    flash = Math.max(0, flash - dt);
    leakFlash = Math.max(0, leakFlash - dt);
    muzzle = Math.max(0, muzzle - dt);
    draw();
  }

  function draw() {
    if (!ctx) return;
    const dpr = pixelRatio / viewScale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const bg = images.background;
    if (bg) {
      const s = Math.max(canvas.width / bg.width, canvas.height / bg.height);
      ctx.drawImage(bg, (canvas.width - bg.width * s) / 2, (canvas.height - bg.height * s) / 2, bg.width * s, bg.height * s);
    }

    const jx = shake ? (Math.random() - 0.5) * shake : 0;
    const jy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, (originX + jx) * dpr, (originY + jy) * dpr);

    // Base line: what the enemies must not cross
    const danger = leakFlash > 0;
    ctx.fillStyle = danger ? "rgba(255,60,60,0.18)" : "rgba(39,228,255,0.07)";
    ctx.fillRect(0, FIELD.baseY, FIELD.w, FIELD.h - FIELD.baseY);
    ctx.strokeStyle = danger ? "#ff4d4d" : "#27e4ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, FIELD.baseY);
    ctx.lineTo(FIELD.w, FIELD.baseY);
    ctx.stroke();

    if (game) {
      if (game.shield > 0) {
        ctx.strokeStyle = "rgba(120,220,255,0.75)";
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.moveTo(0, FIELD.baseY - 8);
        ctx.lineTo(FIELD.w, FIELD.baseY - 8);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const e of game.enemies) {
        if (e.type === "shell") {
          ctx.fillStyle = "#ff3355";
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffd6dd";
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius * 0.45, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        const tilt =
          e.type === "dart" ? Math.cos(e.swayPhase + game.time * ENEMIES.dart.swayRate) * -0.3 : 0;
        stamp(e.type, e.x, e.y, tilt, e.elite ? ELITE.size : 1);
        if (e.elite) {
          ctx.strokeStyle = "#ff4d6d";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius + 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (e.slowUntil > game.time) {
          ctx.strokeStyle = "rgba(150,220,255,0.85)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (!BOSSES[e.type] && e.hp < e.maxHp && e.maxHp > 4) {
          const w = e.radius * 1.6;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(e.x - w / 2, e.y - e.radius - 9, w, 3);
          ctx.fillStyle = SPRITES[e.type].glow;
          ctx.fillRect(e.x - w / 2, e.y - e.radius - 9, (w * e.hp) / e.maxHp, 3);
        }
      }

      ctx.lineCap = "round";
      for (const b of game.bullets) {
        const tx = b.x - b.vx * 0.022;
        const ty = b.y - b.vy * 0.022;
        ctx.strokeStyle = b.crit ? "rgba(255,214,74,0.5)" : "rgba(39,228,255,0.35)";
        ctx.lineWidth = b.crit ? 11 : 6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = b.crit ? "#fff6c9" : "#eaffff";
        ctx.lineWidth = b.crit ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const fx of effects) {
        const t = fx.life / fx.span; // 1 → 0
        ctx.globalAlpha = t;
        if (fx.type === "blast") {
          ctx.strokeStyle = "#ffb347";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.radius * (1 - t * 0.6), 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Lightning: a line with one kink off to the side
          const mx = (fx.x + fx.x2) / 2 + (fx.y2 - fx.y) * 0.18;
          const my = (fx.y + fx.y2) / 2 - (fx.x2 - fx.x) * 0.18;
          ctx.strokeStyle = "#e6f0ff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(fx.x, fx.y);
          ctx.lineTo(mx, my);
          ctx.lineTo(fx.x2, fx.y2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // Turret: the sprite is the round base, the barrel is drawn so the aim is visible
    if (stamps.turret) stamp("turret", FIELD.turretX, FIELD.turretY);
    ctx.save();
    ctx.translate(FIELD.turretX, FIELD.turretY);
    ctx.rotate(game ? game.aim : input.aim);
    ctx.fillStyle = "#0b1730";
    ctx.strokeStyle = "#27e4ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-5, -34, 10, 28);
    ctx.fill();
    ctx.stroke();
    if (muzzle > 0) {
      ctx.fillStyle = "#eaffff";
      ctx.beginPath();
      ctx.arc(0, -38, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 3);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    const boss = game?.enemies.find((e) => BOSSES[e.type]);
    if (boss) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(30, 62, FIELD.w - 60, 7);
      ctx.fillStyle = "#ff3355";
      ctx.fillRect(30, 62, ((FIELD.w - 60) * Math.max(0, boss.hp)) / boss.maxHp, 7);
    }
    if (game?.bossWarn > 0 && Math.floor(game.bossWarn * 4) % 2 === 0) {
      ctx.fillStyle = "#ff3355";
      ctx.font = "900 34px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("WARNING", FIELD.w / 2, FIELD.h / 2 - 40);
    }
    if (flash > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, flash)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function aimAt(e) {
    const rect = wrap.getBoundingClientRect();
    const x = (e.clientX - rect.left - originX) / viewScale;
    const y = (e.clientY - rect.top - originY) / viewScale;
    input.aim = Math.atan2(x - FIELD.turretX, Math.max(8, FIELD.turretY - y));
  }

  function onPointerDown(e) {
    if (screen !== "playing") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    aimAt(e);
    input.firing = true;
  }

  function onPointerMove(e) {
    if (screen === "playing" && (input.firing || e.pointerType === "mouse")) aimAt(e);
  }

  function onPointerUp() {
    input.firing = false;
  }

  function startGame() {
    game = createGame();
    particles = [];
    effects = [];
    input.firing = false;
    hud = { ...hud, choices: [], levels: {} };
    screen = "playing";
    syncHud();
    sound.resume();
    sound.restartMusic();
  }

  function choose(key) {
    play("upgrade");
    handle(pickUpgrade(game, key));
    syncHud();
  }

  function rerollCards() {
    if (!reroll(game)) return;
    play("reroll");
    syncHud();
  }

  function bomb() {
    handle(useBomb(game));
    syncHud();
  }

  function toggleMute() {
    isMuted = !isMuted;
    sound.setMuted(isMuted);
  }

  // The card pick writes the draw into the ledger under this label; one such entry means the reward is spent
  const isDrawRecord = (item) =>
    item.receiver === $currentUser && item.title?.includes(REWARD_LABELS.guardian);

  async function checkReward() {
    reward = "checking";
    const res = await api.getLedger();
    if (!res.success) return (reward = "error");
    reward = (res.ledger || []).some(isDrawRecord) ? "claimed" : "available";
    if (reward === "claimed") {
      localStorage.removeItem(pendingKey);
      hasPending = false;
    }
  }

  function goToReward() {
    navigate(`${base}/card-pick`, { state: { reward: "guardian" } });
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      sound.suspend();
      input.firing = false;
    } else if (!raf) {
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
      sound.resume();
    }
  }

  onMount(async () => {
    ctx = canvas.getContext("2d");
    sound = createSound(SND, Object.values(SOUNDS).map(([file]) => file), MUSIC);
    checkReward();

    try {
      const files = [...new Set(Object.values(SPRITES).map((s) => s.file)), "background"];
      const loaded = await Promise.all(files.map(loadImage));
      images = Object.fromEntries(files.map((f, i) => [f, loaded[i]]));
    } catch {
      return toast("게임 이미지를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.", "error");
    }
    pixelRatio = 0;
    resize();
    screen = "start";
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  });

  onDestroy(() => {
    cancelAnimationFrame(raf);
    sound?.close();
  });
</script>

<svelte:window on:resize={resize} />
<svelte:document on:visibilitychange={onVisibility} />

<div
  bind:this={wrap}
  class="absolute inset-0 bg-[#05060f] text-white select-none overflow-hidden touch-none"
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerup={onPointerUp}
  on:pointercancel={onPointerUp}
  role="application"
  aria-label="네온 가디언"
>
  <canvas bind:this={canvas} class="absolute inset-0 w-full h-full"></canvas>

  <!-- HUD -->
  <!-- Above the overlays so leaving and muting work on every screen -->
  <div class="absolute top-0 inset-x-0 z-20 flex items-center gap-2 p-3 pointer-events-none">
    <div class="pointer-events-auto" on:pointerdown|stopPropagation>
      <GameExitButton />
    </div>
    {#if screen === "playing" || screen === "upgrade"}
      <div class="flex-1 min-w-0">
        <p class="text-[11px] font-black tracking-widest text-cyan-300">
          WAVE {hud.wave} / {LAST_WAVE}
        </p>
        <div class="flex items-center gap-1 mt-1" aria-label="기지 체력 {hud.hp}">
          {#each Array(PLAYER.hp) as _, i}
            <span class="h-2 w-3 rounded-sm {i < hud.hp ? 'bg-rose-400' : 'bg-white/15'}"></span>
          {/each}
          {#if hud.shield > 0}
            <span class="ml-1 text-[11px] font-black text-sky-300">🛡️{hud.shield}</span>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-1 text-sm font-black text-amber-300">
        <img src="{IMG}/coin.webp" alt="코인" class="w-5 h-5" />
        {hud.coins}
      </div>
    {:else}
      <div class="flex-1"></div>
    {/if}
    <button
      type="button"
      on:pointerdown|stopPropagation
      on:click={toggleMute}
      aria-label={isMuted ? "소리 켜기" : "소리 끄기"}
      class="pointer-events-auto w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white/10 border border-white/15 active:scale-90 transition-all"
    >
      {isMuted ? "🔇" : "🔊"}
    </button>
  </div>

  {#if screen === "playing"}
    <button
      type="button"
      on:pointerdown|stopPropagation
      on:click={bomb}
      disabled={hud.coins < hud.bombCost}
      aria-label="폭탄 사용, 코인 {hud.bombCost}개"
      class="absolute left-3 bottom-[max(env(safe-area-inset-bottom),12px)] flex flex-col items-center active:scale-90 transition-all disabled:opacity-35"
    >
      <img src="{IMG}/skill-bomb.webp" alt="" class="w-14 h-14" />
      <span class="flex items-center gap-0.5 text-[11px] font-black text-amber-300 -mt-1">
        <img src="{IMG}/coin.webp" alt="" class="w-3.5 h-3.5" />
        {hud.bombCost}
      </span>
    </button>
  {/if}

  <!-- Title screen: key art with the title in its dark upper third and the buttons at the bottom -->
  {#if screen === "start"}
    <!-- Full screen on phones; on a wide window the art keeps a phone-shaped column in the middle -->
    <div class="absolute inset-0 z-10 flex justify-center bg-[#05060f]" on:pointerdown|stopPropagation>
     <div class="relative h-full aspect-[9/16] max-w-full overflow-hidden">
      <img
        src="{IMG}/title.webp"
        alt=""
        class="absolute inset-0 w-full h-full object-cover object-bottom"
      />
      <div class="absolute inset-x-0 top-[11%] px-5 text-center">
        <p class="text-[11px] font-black tracking-[0.4em] text-fuchsia-300">WAVE DEFENSE</p>
        <h1 class="mt-2 text-5xl font-black text-cyan-200 drop-shadow-[0_0_22px_rgba(39,228,255,0.9)]">
          네온 가디언
        </h1>
        <p class="mt-3 text-sm text-gray-300">{LAST_WAVE}번의 공세를 막고 기지를 지켜라</p>
        <p class="mt-4 inline-block px-3 py-1.5 rounded-full text-xs font-bold text-amber-200 bg-black/50 border border-amber-300/40">
          {#if reward === "claimed"}
            클리어 보상은 이미 받았어요
          {:else}
            🎁 클리어 보상: 용돈 카드뽑기 1회
          {/if}
        </p>
      </div>
      <div
        class="absolute inset-x-0 bottom-0 px-5 pt-10 pb-[max(env(safe-area-inset-bottom),16px)] bg-gradient-to-t from-black/90 to-transparent"
      >
        <div class="max-w-xs mx-auto space-y-2">
          {#if hasPending && reward === "available"}
            <button
              type="button"
              on:click={goToReward}
              class="w-full py-3 rounded-2xl font-black text-white bg-gradient-to-r from-amber-500 to-rose-500 active:scale-95 transition-all"
            >
              🎁 아직 안 뽑은 클리어 보상 받기
            </button>
          {/if}
          <button
            type="button"
            on:click={startGame}
            class="w-full py-4 rounded-2xl font-black text-lg text-gray-900 bg-cyan-300 active:scale-95 transition-all shadow-[0_0_24px_rgba(39,228,255,0.6)]"
          >
            게임 시작
          </button>
          <button
            type="button"
            on:click={() => (showRules = true)}
            class="w-full py-2 text-sm font-bold text-gray-300 active:scale-95 transition-all"
          >
            게임 방법
          </button>
        </div>
      </div>

      {#if showRules}
        <div class="absolute inset-0 flex items-center justify-center p-5 bg-black/80">
          <div class="w-full max-w-xs">
            <h2 class="text-xl font-black text-cyan-300 text-center">게임 방법</h2>
            <ul class="mt-4 space-y-2 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-2xl p-4">
              <li>👆 화면을 누른 채 끌어서 조준하고 발사</li>
              <li>🧱 적이 아래 선을 넘으면 기지 체력 감소 (회복 없음)</li>
              <li>🃏 웨이브를 막을 때마다 강화 카드 3장 중 1장 선택</li>
              <li>💣 코인은 폭탄이나 카드 바꾸기에 사용</li>
              <li>👾 중간 보스를 넘고 {LAST_WAVE}웨이브 보스를 잡으면 클리어</li>
            </ul>
            <button
              type="button"
              on:click={() => (showRules = false)}
              class="mt-4 w-full py-3 rounded-2xl font-bold bg-white/10 border border-white/20 active:scale-95 transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      {/if}
     </div>
    </div>
  {:else if screen !== "playing"}
    <div
      class="absolute inset-0 z-10 flex items-center justify-center p-5 bg-black/70"
      on:pointerdown|stopPropagation
    >
      <div class="w-full max-w-xs text-center">
        {#if screen === "loading"}
          <p class="font-bold text-cyan-200 animate-pulse">불러오는 중...</p>
        {:else if screen === "upgrade"}
          {#if hud.rich}
            <p class="text-xs font-black tracking-widest text-amber-300">중간 보스 격파!</p>
            <h2 class="mt-1 text-2xl font-black">보상 카드를 고르세요</h2>
            <p class="mt-1 text-xs text-gray-300">이번에는 희귀 이상 카드만 나옵니다</p>
          {:else}
            <p class="text-xs font-black tracking-widest text-cyan-300">{hud.wave}웨이브 돌파!</p>
            <h2 class="mt-1 text-2xl font-black">카드 한 장을 고르세요</h2>
          {/if}
          <div class="mt-5 space-y-3">
            {#each hud.choices as key (key)}
              {@const card = UPGRADES[key]}
              <button
                type="button"
                on:click={() => choose(key)}
                class="w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left active:scale-95 transition-all {RARITY_STYLE[card.rarity]}"
              >
                {#if card.image}
                  <img src="{IMG}/{card.image}" alt="" class="w-9 h-9" />
                {:else}
                  <span class="text-3xl">{card.icon}</span>
                {/if}
                <span class="flex-1 min-w-0">
                  <span class="block text-[10px] font-black tracking-widest {RARITY_TEXT[card.rarity]}">
                    {RARITY[card.rarity].label}
                  </span>
                  <span class="block font-black">{card.label}</span>
                  <span class="block text-xs text-gray-200">{card.desc(hud.levels[key])}</span>
                </span>
                <span class="flex gap-0.5" aria-label="현재 {hud.levels[key]}단계, 최대 {card.max}단계">
                  {#each Array(card.max) as _, i}
                    <span class="w-1.5 h-4 rounded-sm {i < hud.levels[key] ? 'bg-cyan-300' : 'bg-white/20'}"></span>
                  {/each}
                </span>
              </button>
            {/each}
          </div>
          <button
            type="button"
            on:click={rerollCards}
            disabled={hud.coins < hud.rerollCost}
            class="mt-4 w-full py-3 flex items-center justify-center gap-1 rounded-2xl font-bold text-sm bg-white/10 border border-white/20 active:scale-95 transition-all disabled:opacity-40"
          >
            🎲 카드 바꾸기
            <img src="{IMG}/coin.webp" alt="코인" class="w-4 h-4 ml-1" />
            <span class="text-amber-300">{hud.rerollCost}</span>
            <span class="text-gray-400 font-medium">(보유 {hud.coins})</span>
          </button>
        {:else if screen === "over"}
          <h2 class="text-4xl font-black text-rose-400">GAME OVER</h2>
          <p class="mt-3 text-gray-300">
            {LAST_WAVE}웨이브 중 <strong class="text-white">{hud.wave}웨이브</strong>에서 기지가 무너졌습니다.
          </p>
          <button
            type="button"
            on:click={startGame}
            class="mt-6 w-full py-4 rounded-2xl font-black text-lg text-gray-900 bg-cyan-300 active:scale-95 transition-all"
          >
            다시 도전
          </button>
        {:else if screen === "clear"}
          <h2 class="text-4xl font-black text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.7)]">
            CLEAR!
          </h2>
          <p class="mt-3 text-gray-200">보스를 격파하고 기지를 지켜냈습니다.</p>
          {#if reward === "checking"}
            <p class="mt-6 text-sm text-gray-300 animate-pulse">보상 확인 중...</p>
          {:else if reward === "available"}
            <p class="mt-4 text-xs text-gray-300">
              카드는 한 번만 뽑을 수 있고, 뽑은 금액은 장부에 기록돼요.
            </p>
            <button
              type="button"
              on:click={goToReward}
              class="mt-4 w-full py-4 rounded-2xl font-black text-lg text-white bg-gradient-to-r from-amber-500 to-rose-500 active:scale-95 transition-all"
            >
              🎁 용돈 카드 뽑으러 가기
            </button>
          {:else if reward === "claimed"}
            <p class="mt-6 text-sm font-bold text-amber-200">클리어 보상은 이미 받았어요.</p>
          {:else}
            <p class="mt-6 text-sm text-rose-300">보상 정보를 확인하지 못했습니다.</p>
            <button
              type="button"
              on:click={checkReward}
              class="mt-3 w-full py-3 rounded-2xl font-bold bg-white/10 border border-white/20 active:scale-95 transition-all"
            >
              다시 확인
            </button>
          {/if}
          <button
            type="button"
            on:click={startGame}
            class="mt-3 w-full py-3 rounded-2xl font-bold text-gray-200 bg-white/10 active:scale-95 transition-all"
          >
            한 판 더
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>
