<script>
  import { onMount, onDestroy } from "svelte";
  import { navigate } from "svelte-routing";
  import { base, currentUser } from "../lib/store.js";
  import { api } from "../lib/api.js";
  import { toast } from "../lib/feedback.js";
  import { REWARD_LABELS } from "../lib/rewards.js";
  import { createSound } from "../lib/guardian/sound.js";
  import GameExitButton from "../lib/components/GameExitButton.svelte";
  import Ranking from "../lib/guardian/Ranking.svelte";
  import { createGame, saveGame, loadGame, update, pickUpgrade, useBomb, useFreeze, reroll, buy, dronePosition } from "../lib/guardian/engine.js";
  import {
    FIELD,
    PLAYER,
    ENEMIES,
    MODES,
    BOSSES,
    ELITE,
    UPGRADES,
    RARITY,
    UNLOCK_WAVE,
    TRANSCEND_WAVE,
    REPEAT_WAVE,
    ENDLESS,
    FREEZE,
    DRONE_COUNT,
    VORTEX_RADIUS,
    STRIKE_RADIUS,
    STRIKE_DELAY,
  } from "../lib/guardian/config.js";

  const IMG = `${base}/images/guardian`;
  const SND = `${base}/sounds`;

  const HARD_MUSIC = "lesiakower-cyber-day-alarm-clock-418781.mp3";
  const MUSIC = { normal: "retro-color-moon.mp3", hard: HARD_MUSIC, endless: HARD_MUSIC };
  // name: [file, volume, minimum ms between plays, seconds to play (0 = whole file)].
  // Several files run for seconds, so the rapid ones are cut short to keep them from piling up.
  const SOUNDS = {
    shoot: ["laser-zap.mp3", 0.18, 70, 0.18],
    critShot: ["laser-zap.mp3", 0.5, 0, 0.45],
    droneShot: ["laser-zap.mp3", 0.06, 110, 0.1],
    hit: ["punch.mp3", 0.25, 60, 0.16],
    kill: ["pop.mp3", 0.5, 40, 0.3],
    blast: ["pop.mp3", 0.3, 90, 0.22],
    chain: ["zap-synth.mp3", 0.16, 140, 0.22],
    boom: ["bomb-explosion.mp3", 0.4, 120, 0.8],
    missileHit: ["bomb-explosion.mp3", 0.25, 150, 0.5],
    laser: ["zap-synth.mp3", 0.45, 0, 0.6],
    vortex: ["warp.mp3", 0.45, 0, 1.2],
    strikeMark: ["beep-warning.mp3", 0.25, 0, 0.3],
    well: ["warp.mp3", 0.5, 0, 1.2],
    decoys: ["warp.mp3", 0.7, 0, 0],
    seals: ["beep-warning.mp3", 0.6, 0, 0],
    strike: ["epic-cinematic-explosion.mp3", 0.5, 0, 1],
    freeze: ["glass-clink.mp3", 0.8, 0, 0],
    buy: ["drop-coin.mp3", 0.5, 0, 0],
    blink: ["warp.mp3", 0.12, 150, 0.25],
    deflect: ["glass-clink.mp3", 0.2, 160, 0.2],
    coin: ["drop-coin.mp3", 0.3, 90, 0.4],
    upgrade: ["level-up.mp3", 0.6, 0, 0],
    reroll: ["drop-coin.mp3", 0.5, 0, 0],
    repair: ["level-up.mp3", 0.5, 0, 0],
    waveClear: ["power-up.mp3", 0.45, 0, 1.4],
    bomb: ["bomb-explosion.mp3", 0.7, 0, 1.8],
    shield: ["glass-clink.mp3", 0.7, 0, 0],
    leak: ["zap-synth.mp3", 0.5, 0, 0.5],
    bossWarn: ["beep-warning.mp3", 0.6, 0, 0],
    bossArrive: ["warp.mp3", 0.6, 0, 0],
    bossPhase: ["warp.mp3", 0.6, 0, 0],
    chargeStart: ["beep-warning.mp3", 0.7, 0, 0],
    chargeBreak: ["glass-clink.mp3", 0.9, 0, 0],
    chargeFire: ["epic-cinematic-explosion.mp3", 0.8, 0, 1.6],
    bossDead: ["epic-cinematic-explosion.mp3", 0.8, 0, 0],
    victory: ["universfield-clear-bell-chime-487898.mp3", 0.8, 0, 0],
    gameOver: ["universfield-game-over-deep-male-voice-clip-352695.mp3", 0.8, 0, 0],
  };

  const RARITY_STYLE = {
    common: "border-white/25 bg-white/10",
    rare: "border-sky-300/70 bg-sky-400/15 shadow-[0_0_18px_rgba(56,189,248,0.35)]",
    epic: "border-amber-300/80 bg-amber-400/15 shadow-[0_0_22px_rgba(251,191,36,0.45)]",
    mythic: "border-fuchsia-300/80 bg-fuchsia-500/15 shadow-[0_0_24px_rgba(232,121,249,0.5)]",
    evo: "border-emerald-300/80 bg-emerald-400/15 shadow-[0_0_24px_rgba(52,211,153,0.5)]",
    transcend: "border-rose-300/80 bg-rose-500/15 shadow-[0_0_24px_rgba(251,113,133,0.55)]",
    repeat: "border-teal-300/60 bg-teal-400/10",
  };
  const RARITY_TEXT = {
    common: "text-gray-300",
    rare: "text-sky-300",
    epic: "text-amber-300",
    mythic: "text-fuchsia-300",
    evo: "text-emerald-300",
    transcend: "text-rose-300",
    repeat: "text-teal-300",
  };

  // Draw size in field units and the glow colour added around each sprite
  const SPRITES = {
    drone: { file: "enemy-drone", size: 46, glow: "#ff3df2" },
    mini: { file: "enemy-drone", size: 28, glow: "#ff3df2" },
    dart: { file: "enemy-dart", size: 44, glow: "#ffe14a" },
    tank: { file: "enemy-tank", size: 72, glow: "#ff8a1f" },
    carrier: { file: "enemy-carrier", size: 54, glow: "#3dff6e" },
    shielder: { file: "enemy-shielder", size: 60, glow: "#7fd8ff" },
    blinker: { file: "enemy-blinker", size: 46, glow: "#b56bff" },
    artillery: { file: "enemy-artillery", size: 66, glow: "#ff4d4d" },
    bomber: { file: "enemy-bomber", size: 46, glow: "#fff07a" },
    hive: { file: "enemy-hive", size: 80, glow: "#ff7ad9" },
    phaser: { file: "enemy-phaser", size: 46, glow: "#c8fff4" },
    mender: { file: "enemy-mender", size: 52, glow: "#7dffb0" },
    generator: { file: "boss-generator", size: 42, glow: "#7fd8ff" },
    boss: { file: "boss", size: 168, glow: "#27e4ff" },
    midboss: { file: "boss", size: 124, glow: "#ff5ad1" },
    warlord: { file: "boss", size: 152, glow: "#ff9d2e" },
    final: { file: "boss-final", size: 200, glow: "#c58bff" },
    titan: { file: "boss-titan", size: 196, glow: "#ffd27a" },
    decoy: { file: "boss-titan", size: 196, glow: "#ffd27a" },
    seal: { file: "boss-generator", size: 42, glow: "#ff5a7a" },
    turret: { file: "turret", size: 60, glow: "#27e4ff" },
  };
  const BOSS_NAMES = { midboss: "중간 보스", boss: "보스 전함", warlord: "강화 전함", final: "드레드노트", titan: "보이드 타이탄" };

  // What the hard mode briefing shows
  const NEW_ENEMIES = [
    { file: "enemy-shielder", name: "방패기", text: "주변 적이 받는 피해를 절반으로 줄여요. 먼저 잡으세요." },
    { file: "enemy-blinker", name: "점멸기", text: "주기적으로 옆으로 순간이동해서 조준을 흔들어요." },
    { file: "enemy-artillery", name: "포격기", text: "화면 위쪽에 멈춰서, 격추될 때까지 기지로 포탄을 쏴요." },
    { file: "enemy-bomber", name: "자폭기", text: "죽을 때 폭발해 주변 적도 휩쓸어요. 통과하면 체력이 3 깎여요." },
  ];
  const SPECIAL_ENEMIES = [
    { file: "enemy-hive", name: "모함", text: "크고 느리지만, 격추될 때까지 소형기를 계속 내보내요." },
    { file: "enemy-phaser", name: "위상기", text: "주기적으로 반투명해지고, 그동안은 어떤 공격도 통과해요." },
    { file: "enemy-mender", name: "치유기", text: "주변 적의 체력을 계속 회복시켜요. 먼저 잡으세요." },
  ];
  const lateCards = (rarity) => Object.values(UPGRADES).filter((card) => card.rarity === rarity);
  const HARD_BOSS_WAVES = MODES.hard.waves.flatMap((wave, i) => (typeof wave === "string" ? [i + 1] : [])).join(" · ");
  // Each briefing is shown once before the first run of its mode
  const INTRO_KEY = { hard: "guardian_hard_intro_seen", endless: "guardian_endless_intro_seen" };
  const TITAN_WAVE = (ENDLESS.bosses.indexOf("titan") + 1) * ENDLESS.bossEvery;
  // The furthest endless wave reached on this device, for when the ranking cannot be loaded
  const bestKey = `guardian_endless_best_${$currentUser}`;

  // The key the card pick knows each mode's reward by
  const REWARD_KEY = { normal: "guardian", hard: "guardianHard" };
  // A clear whose card has not been drawn yet survives closing the app
  const pendingKey = {
    normal: `guardian_reward_pending_${$currentUser}`,
    hard: `guardian_hard_reward_pending_${$currentUser}`,
  };

  // A run left unfinished waits here, one per mode
  const saveKey = (key) => `guardian_save_${key}_${$currentUser}`;
  const loadRun = (key) => loadGame(localStorage.getItem(saveKey(key)));
  // Marks the history entry a run sits on, so the back button pauses before it leaves
  const runEntry = Math.random().toString(36).slice(2);

  let screen = "loading"; // loading | start | playing | upgrade | over | clear
  let mode = "normal";
  let hud = { wave: 1, hp: PLAYER.hp, shield: 0, coins: 0, bombCost: PLAYER.bombCost, rerollCost: 0, choices: [], levels: {} };
  // Per mode: checking | available | claimed | error
  let rewards = { normal: "checking", hard: "checking" };
  let pending = {
    normal: localStorage.getItem(pendingKey.normal) === "1",
    hard: localStorage.getItem(pendingKey.hard) === "1",
  };
  // The wave each mode's saved run is on, 0 without one
  let saves = Object.fromEntries(Object.keys(MODES).map((key) => [key, (loadRun(key)?.wave ?? -1) + 1]));
  let isMuted = false;
  let isPaused = false;
  let showRules = false;
  let intro = null; // null | { mode, isStart }: isStart leads into the first run of that mode
  let showRanking = false;
  let records = null; // null while loading, false when the server cannot say, else best waves per member
  let localBest = Number(localStorage.getItem(bestKey)) || 0;
  let hasSentRun = false; // this run's wave has gone to the server
  let hasResent = false;

  // Endless mode has no last wave
  $: lastWave = MODES[mode].waves?.length;
  // Each mode opens with a clear of the one before, whether or not its card has been drawn
  $: isHardOpen = rewards.normal === "claimed" || pending.normal;
  $: isEndlessOpen = rewards.hard === "claimed" || pending.hard;
  $: ranking = (records || []).filter((r) => r.wave > 0).sort((a, b) => b.wave - a.wave);

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
  let effects = []; // short-lived rings, arcs and beams
  let texts = []; // words floating up from where something happened
  let finale = null; // the explosions between the last boss dying and the clear screen
  let lastBoss = { x: FIELD.w / 2, y: 150 };
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

  // Rapid fire with every bullet upgrade can ask for hundreds of these a second
  function addEffect(event, seconds) {
    if (effects.length < 90) effects.push({ ...event, life: seconds, span: seconds });
  }

  function say(text, x, y, color = "#ffffff") {
    texts.push({ text, x, y, color, life: 1.1 });
  }

  function handle(events) {
    for (const e of events) {
      if (SOUNDS[e.type]) play(e.type);
      if (e.type === "shoot") muzzle = 0.06;
      else if (e.type === "critShot") muzzle = 0.14;
      else if (e.type === "blast") addEffect(e, 0.22);
      else if (e.type === "chain") addEffect(e, 0.14);
      else if (e.type === "blink") addEffect(e, 0.25);
      else if (e.type === "laser") addEffect(e, 0.28);
      else if (e.type === "missileHit") {
        addEffect(e, 0.3);
        burst(e.x, e.y, "#ffb347", 10, 160);
      } else if (e.type === "strike") {
        addEffect(e, 0.45);
        burst(e.x, e.y, "#ffd27a", 30, 260);
        shake = Math.max(shake, 9);
      } else if (e.type === "well") say("중력 왜곡", e.x, e.y - 20, "#8fb8ff");
      else if (e.type === "decoys") {
        say("분신!", e.x, e.y + 100, "#ffd27a");
        flash = 0.35;
      } else if (e.type === "seals") say("자동 무기 봉인", e.x, e.y + 100, "#ff8a9d");
      else if (e.type === "freeze") {
        say("시간 정지", FIELD.w / 2, FIELD.h / 2, "#bfe9ff");
      } else if (e.type === "boom") {
        addEffect(e, 0.35);
        burst(e.x, e.y, "#fff07a", 18, 220);
        shake = Math.max(shake, 6);
      } else if (e.type === "vortex") burst(e.x, e.y, "#c58bff", 14, 140);
      else if (e.type === "hit") burst(e.x, e.y, "#bff6ff", 3, 80);
      else if (e.type === "deflect") {
        const angle = Math.random() * Math.PI * 2;
        burst(e.x + Math.cos(angle) * 80, e.y + Math.sin(angle) * 80, "#7fd8ff", 2, 60);
      } else if (e.type === "kill") burst(e.x, e.y, SPRITES[e.kind]?.glow ?? "#ff5a5a", BOSSES[e.kind] ? 0 : 12);
      else if (e.type === "leak") {
        leakFlash = 0.4;
        shake = 10;
        navigator.vibrate?.(60);
      } else if (e.type === "bomb") {
        flash = 0.5;
        shake = 14;
      } else if (e.type === "generators") say("보호막 가동", e.x, e.y + 100, "#7fd8ff");
      else if (e.type === "chargeStart") say("주포 충전!", e.x, e.y + 100, "#ff8ae2");
      else if (e.type === "chargeBreak") {
        say("충전 차단!", e.x, e.y + 100, "#9dffb0");
        burst(e.x, e.y, "#ffffff", 40, 240);
        shake = 10;
      } else if (e.type === "chargeFire") {
        addEffect(e, 0.5);
        flash = 0.5;
        shake = 22;
      } else if (e.type === "repair") say(`기지 수리 +${MODES[mode].repair}`, FIELD.w / 2, FIELD.baseY - 24, "#9dffb0");
      else if (e.type === "bossDead") {
        burst(e.x, e.y, "#ff5a5a", 80, 260);
        burst(e.x, e.y, "#27e4ff", 60, 200);
        flash = 0.8;
        shake = 20;
        lastBoss = e;
      } else if (e.type === "clear") {
        finale = { left: mode === "hard" ? 2.6 : 1.2, next: 0.15 };
        // Earned already, even if the app is closed during the fireworks
        localStorage.setItem(pendingKey[mode], "1");
        pending[mode] = true;
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
      hud.bombCost !== game.bombCost ||
      hud.freezeCost !== game.freezeCost;
    if (changed) {
      hud = { ...hud, wave: game.wave + 1, hp: game.hp, shield: game.shield, coins, bombCost: game.bombCost, freezeCost: game.freezeCost };
    }
    if (game.phase === "upgrade" && hud.choices !== game.choices) syncPick();
    if (game.phase === screen || finale) return;
    if (game.phase === "over" || game.phase === "clear") {
      sound.stopMusic();
      input.firing = false;
    }
    if (mode === "endless" && game.wave + 1 > localBest) {
      localBest = game.wave + 1;
      localStorage.setItem(bestKey, String(localBest));
    }
    if (game.phase === "over") sendRecord();
    if (game.phase === "clear") {
      play("victory");
      checkReward();
    }
    saveRun();
    screen = game.phase;
  }

  // What the card pick screen shows: the hand, the levels, and the prices
  function syncPick() {
    hud = {
      ...hud,
      hp: game.hp,
      shield: game.shield,
      coins: Math.floor(game.coins),
      choices: game.choices,
      levels: { ...game.levels },
      rerollCost: game.rerollCost,
      rich: game.richDraft,
      shop: game.shop && { ...game.shop },
      hasExtraPick: game.hasExtraPick,
    };
  }

  // The wreck keeps blowing up for a moment before the clear screen comes in
  function stepFinale(dt) {
    finale.left -= dt;
    finale.next -= dt;
    if (finale.next <= 0) {
      finale.next = 0.13;
      const x = lastBoss.x + (Math.random() - 0.5) * 150;
      const y = lastBoss.y + (Math.random() - 0.5) * 110;
      burst(x, y, Math.random() < 0.5 ? "#ffd27a" : "#c58bff", 26, 240);
      addEffect({ type: "boom", x, y, radius: 30 + Math.random() * 40 }, 0.35);
      shake = 12;
      play("boom");
    }
    if (finale.left <= 0) {
      finale = null;
      flash = 0.9;
      syncHud();
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (isPaused) return;
    if (screen === "playing") {
      handle(update(game, dt, input));
      syncHud();
    }
    if (finale) stepFinale(dt);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const fx of effects) fx.life -= dt;
    effects = effects.filter((fx) => fx.life > 0);
    for (const t of texts) t.life -= dt;
    texts = texts.filter((t) => t.life > 0);
    shake = Math.max(0, shake - 40 * dt);
    flash = Math.max(0, flash - dt);
    leakFlash = Math.max(0, leakFlash - dt);
    muzzle = Math.max(0, muzzle - dt);
    draw();
  }

  function circle(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  }

  function line(x, y, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawBoss(e) {
    if (e.stun > 0) ctx.globalAlpha = 0.6 + 0.3 * Math.sin(game.time * 30);
    stamp(e.type, e.x, e.y);
    ctx.globalAlpha = 1;
    if (e.shielded) {
      circle(e.x, e.y, e.radius + 16);
      ctx.fillStyle = "rgba(127,216,255,0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(127,216,255,0.9)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (e.charging > 0) {
      const progress = 1 - e.charging / BOSSES[e.type].charge.seconds;
      // Where the shot will land
      ctx.strokeStyle = `rgba(255,120,220,${0.15 + progress * 0.45})`;
      ctx.lineWidth = 2 + progress * 12;
      line(e.x, e.y, e.x, FIELD.baseY);
      ctx.fillStyle = `rgba(255,255,255,${0.5 + progress * 0.5})`;
      circle(e.x, e.y, 10 + progress * 26);
      ctx.fill();
      ctx.strokeStyle = "#ff8ae2";
      ctx.lineWidth = 3;
      circle(e.x, e.y, 24 + (1 - progress) * 80);
      ctx.stroke();
    }
  }

  function drawEnemy(e, boss) {
    if (e.type === "shell") {
      ctx.fillStyle = "#ff3355";
      circle(e.x, e.y, e.radius);
      ctx.fill();
      ctx.fillStyle = "#ffd6dd";
      circle(e.x, e.y, e.radius * 0.45);
      ctx.fill();
      return;
    }
    if (BOSSES[e.type]) return drawBoss(e);
    const def = ENEMIES[e.type];
    if (def.aura) {
      circle(e.x, e.y, def.aura);
      ctx.fillStyle = "rgba(127,216,255,0.07)";
      ctx.fill();
      ctx.strokeStyle = "rgba(127,216,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (def.heal) {
      circle(e.x, e.y, def.heal);
      ctx.fillStyle = "rgba(125,255,176,0.06)";
      ctx.fill();
      ctx.strokeStyle = "rgba(125,255,176,0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    let turn = 0;
    if (e.type === "dart") turn = Math.cos(e.swayPhase + game.time * def.swayRate) * -0.3;
    if (def.orbitX) {
      turn = game.time * 2;
      if (boss) {
        ctx.strokeStyle = e.type === "seal" ? "rgba(255,90,122,0.6)" : "rgba(127,216,255,0.6)";
        ctx.lineWidth = 2;
        line(e.x, e.y, boss.x, boss.y);
      }
    }
    if (e.ghost) ctx.globalAlpha = 0.28;
    // The only tell of a copy: it shimmers a little
    if (e.type === "decoy") ctx.globalAlpha = 0.82 + 0.1 * Math.sin(game.time * 9 + e.swayPhase);
    stamp(e.type, e.x, e.y, turn, e.elite ? ELITE.size : 1);
    ctx.globalAlpha = 1;
    if (e.mended) {
      ctx.fillStyle = "#7dffb0";
      ctx.fillRect(e.x - 5, e.y - e.radius - 16, 10, 2.5);
      ctx.fillRect(e.x - 1.25, e.y - e.radius - 19.75, 2.5, 10);
    }
    if (e.elite) {
      ctx.strokeStyle = "#ff4d6d";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      circle(e.x, e.y, e.radius + 7);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (e.guarded) {
      ctx.strokeStyle = "rgba(127,216,255,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    if (e.slowUntil > game.time) {
      ctx.strokeStyle = "rgba(150,220,255,0.85)";
      ctx.lineWidth = 2;
      circle(e.x, e.y, e.radius + 4);
      ctx.stroke();
    }
    if (e.hp < e.maxHp && e.maxHp > 4 && e.type !== "decoy") {
      const w = e.radius * 1.6;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 9, w, 3);
      ctx.fillStyle = SPRITES[e.type].glow;
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 9, (w * e.hp) / e.maxHp, 3);
    }
  }

  function drawEffect(fx) {
    const t = fx.life / fx.span; // 1 → 0
    ctx.globalAlpha = t;
    if (fx.type === "blast" || fx.type === "missileHit") {
      ctx.strokeStyle = fx.type === "blast" ? "#ffb347" : "#ff7a3d";
      ctx.lineWidth = fx.type === "blast" ? 3 : 5;
      circle(fx.x, fx.y, fx.radius * (1 - t * 0.6));
      ctx.stroke();
    } else if (fx.type === "strike") {
      // A column of light coming down on the marked spot
      ctx.fillStyle = "rgba(255,210,122,0.5)";
      ctx.fillRect(fx.x - 16 * t, 0, 32 * t, fx.y);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      circle(fx.x, fx.y, fx.radius * (1 - t * 0.4));
      ctx.fill();
      ctx.strokeStyle = "#ffd27a";
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (fx.type === "boom") {
      ctx.fillStyle = "rgba(255,240,122,0.35)";
      circle(fx.x, fx.y, fx.radius * (1 - t * 0.5));
      ctx.fill();
      ctx.strokeStyle = "#fff07a";
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (fx.type === "chain") {
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
    } else if (fx.type === "blink") {
      ctx.strokeStyle = "#b56bff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      line(fx.x, fx.y, fx.x2, fx.y2);
      ctx.setLineDash([]);
    } else if (fx.type === "laser") {
      ctx.save();
      ctx.translate(FIELD.turretX, FIELD.turretY);
      ctx.rotate(fx.angle);
      ctx.fillStyle = "rgba(170,120,255,0.55)";
      ctx.fillRect(-13 * t, -900, 26 * t, 872);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-4 * t, -900, 8 * t, 872);
      ctx.restore();
    } else {
      // The boss's main gun going off
      ctx.fillStyle = "rgba(255,120,220,0.6)";
      ctx.fillRect(fx.x - 24 * t, fx.y, 48 * t, FIELD.baseY - fx.y);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(fx.x - 8 * t, fx.y, 16 * t, FIELD.baseY - fx.y);
    }
  }

  function drawBossBar(boss) {
    ctx.textAlign = "left";
    ctx.font = "800 10px system-ui, sans-serif";
    ctx.fillStyle = "#ffd6dd";
    ctx.fillText(BOSS_NAMES[boss.type] + (boss.visit > 1 ? ` Mk.${boss.visit}` : ""), 30, 58);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(30, 62, FIELD.w - 60, 7);
    ctx.fillStyle = boss.shielded ? "#7fd8ff" : "#ff3355";
    ctx.fillRect(30, 62, ((FIELD.w - 60) * Math.max(0, boss.hp)) / boss.maxHp, 7);

    let hint = "";
    if (boss.charging > 0) {
      const need = boss.maxHp * BOSSES[boss.type].charge.need;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(30, 72, FIELD.w - 60, 5);
      ctx.fillStyle = "#ffd27a";
      ctx.fillRect(30, 72, (FIELD.w - 60) * Math.min(1, boss.chargeTaken / need), 5);
      hint = "코어를 집중 공격해 충전을 끊으세요!";
    } else if (boss.stun > 0) hint = "충전 차단! 지금이 기회";
    else if (boss.shielded) hint = "발전기를 먼저 부수세요";
    else if (game.isSealed) hint = "봉인 수정을 부수면 자동 무기가 돌아옵니다";
    else if (game.enemies.some((e) => e.type === "decoy")) hint = "진짜는 하나! 체력 바가 줄어드는 쪽입니다";
    if (hint) {
      ctx.textAlign = "center";
      ctx.font = "800 12px system-ui, sans-serif";
      ctx.fillStyle = boss.stun > 0 ? "#9dffb0" : "#ffffff";
      ctx.fillText(hint, FIELD.w / 2, 90);
    }
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
    if (mode === "hard") {
      ctx.fillStyle = "rgba(150,0,50,0.16)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    line(0, FIELD.baseY, FIELD.w, FIELD.baseY);

    const boss = game?.enemies.find((e) => BOSSES[e.type]);
    if (game) {
      if (game.shield > 0) {
        ctx.strokeStyle = "rgba(120,220,255,0.75)";
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        line(0, FIELD.baseY - 8, FIELD.w, FIELD.baseY - 8);
        ctx.setLineDash([]);
      }

      for (const v of game.vortices) {
        ctx.globalAlpha = Math.min(1, (v.until - game.time) * 2);
        ctx.fillStyle = "rgba(24,0,48,0.55)";
        circle(v.x, v.y, VORTEX_RADIUS);
        ctx.fill();
        ctx.strokeStyle = "#c58bff";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const start = game.time * 5 + i * 2.1;
          ctx.beginPath();
          ctx.arc(v.x, v.y, VORTEX_RADIUS * (0.3 + i * 0.3), start, start + 2.2);
          ctx.stroke();
        }
        ctx.fillStyle = "#000000";
        circle(v.x, v.y, 9);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const well of game.wells) {
        const { radius } = BOSSES.titan.well;
        ctx.globalAlpha = Math.min(1, (well.until - game.time) * 2);
        ctx.fillStyle = "rgba(20,40,110,0.3)";
        circle(well.x, well.y, radius);
        ctx.fill();
        ctx.strokeStyle = "#8fb8ff";
        ctx.lineWidth = 1.5;
        // Rings falling into the centre
        for (let i = 0; i < 3; i++) {
          circle(well.x, well.y, radius * (1 - ((game.time * 0.6 + i / 3) % 1)));
          ctx.stroke();
        }
        ctx.fillStyle = "#0a1030";
        circle(well.x, well.y, 12);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const e of game.enemies) drawEnemy(e, boss);

      for (const s of game.strikes) {
        const closing = s.left / STRIKE_DELAY;
        ctx.strokeStyle = "#ffd27a";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        circle(s.x, s.y, STRIKE_RADIUS);
        ctx.stroke();
        ctx.setLineDash([]);
        circle(s.x, s.y, STRIKE_RADIUS * closing);
        ctx.stroke();
      }
      if (game.frozenUntil > game.time) {
        ctx.fillStyle = "rgba(150,215,255,0.14)";
        ctx.fillRect(0, 0, FIELD.w, FIELD.baseY);
      }

      ctx.lineCap = "round";
      for (const b of game.bullets) {
        if (b.vortex) {
          ctx.fillStyle = "#1a0033";
          ctx.strokeStyle = "#c58bff";
          ctx.lineWidth = 2;
          circle(b.x, b.y, 8);
          ctx.fill();
          ctx.stroke();
          continue;
        }
        const tx = b.x - b.vx * 0.022;
        const ty = b.y - b.vy * 0.022;
        ctx.strokeStyle = b.crit ? "rgba(255,214,74,0.5)" : b.drone ? "rgba(120,255,160,0.35)" : "rgba(39,228,255,0.35)";
        ctx.lineWidth = b.crit ? 11 : b.drone ? 4 : 6;
        line(tx, ty, b.x, b.y);
        ctx.strokeStyle = b.crit ? "#fff6c9" : b.drone ? "#d9ffe2" : "#eaffff";
        ctx.lineWidth = b.crit ? 4 : b.drone ? 1.5 : 2;
        line(tx, ty, b.x, b.y);
      }

      for (const m of game.missiles) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.angle);
        ctx.fillStyle = "#ff7a3d";
        circle(0, 9, 3.5);
        ctx.fill();
        ctx.fillStyle = "#ffe3a8";
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(4.5, 6);
        ctx.lineTo(-4.5, 6);
        ctx.fill();
        ctx.restore();
      }

      for (const fx of effects) drawEffect(fx);
      ctx.globalAlpha = 1;
    }

    // Turret: the sprite is the round base, the barrel is drawn so the aim is visible
    if (stamps.turret) stamp("turret", FIELD.turretX, FIELD.turretY);
    const aim = game ? game.aim : input.aim;
    for (const angle of game?.levels.twin ? [aim, -aim] : [aim]) {
      ctx.save();
      ctx.translate(FIELD.turretX, FIELD.turretY);
      ctx.rotate(angle);
      ctx.fillStyle = "#0b1730";
      ctx.strokeStyle = "#27e4ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-5, -34, 10, 28);
      ctx.fill();
      ctx.stroke();
      if (muzzle > 0) {
        ctx.fillStyle = "#eaffff";
        circle(0, -38, 7);
        ctx.fill();
      }
      ctx.restore();
    }

    if (game?.levels.drones) {
      for (let i = 0; i < DRONE_COUNT[game.levels.drones - 1]; i++) {
        const { x, y } = dronePosition(game, i);
        ctx.fillStyle = "#0b1730";
        ctx.strokeStyle = "#9dffb0";
        ctx.lineWidth = 2;
        circle(x, y, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#d9ffe2";
        circle(x, y, 2);
        ctx.fill();
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 3);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.textAlign = "center";
    ctx.font = "900 16px system-ui, sans-serif";
    for (const t of texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y - (1.1 - t.life) * 28);
    }
    ctx.globalAlpha = 1;

    if (boss) drawBossBar(boss);
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
    if (screen !== "playing" || isPaused) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    aimAt(e);
    input.firing = true;
  }

  function onPointerMove(e) {
    if (screen === "playing" && !isPaused && (input.firing || e.pointerType === "mouse")) aimAt(e);
  }

  function onPointerUp() {
    input.firing = false;
  }

  // Keeps the run for later while it is still going, and forgets it once it has ended
  function saveRun() {
    if (!game) return;
    const isLive = game.phase === "playing" || game.phase === "upgrade";
    if (isLive) localStorage.setItem(saveKey(mode), saveGame(game));
    else localStorage.removeItem(saveKey(mode));
    saves[mode] = isLive ? game.wave + 1 : 0;
  }

  function startGame(nextMode = mode, saved = null) {
    mode = nextMode;
    game = saved ?? createGame(mode);
    hasSentRun = false;
    particles = [];
    effects = [];
    texts = [];
    finale = null;
    isPaused = false;
    input.firing = false;
    hud = { ...hud, choices: [], levels: {} };
    screen = "playing";
    syncHud();
    sound.resume();
    sound.playMusic(MUSIC[mode]);
    if (history.state?.guardian !== runEntry) history.pushState({ ...history.state, guardian: runEntry }, "");
    // A run picked up in the middle of a wave waits for the player
    if (saved?.phase === "playing") {
      setPaused(true);
      draw();
    }
  }

  // The first run of a mode with a briefing starts from it
  function startWithIntro(nextMode) {
    if (localStorage.getItem(INTRO_KEY[nextMode])) startGame(nextMode);
    else intro = { mode: nextMode, isStart: true };
  }

  function closeIntro() {
    localStorage.setItem(INTRO_KEY[intro.mode], "1");
    const { mode: nextMode, isStart } = intro;
    intro = null;
    if (isStart) startGame(nextMode);
  }

  function setPaused(value) {
    isPaused = value;
    input.firing = false;
    if (value) {
      saveRun();
      return sound.suspend();
    }
    lastTime = performance.now();
    sound.resume();
  }

  // The back button, or a button standing in for it: a run in full swing pauses,
  // one that is paused or over goes back to the title
  function onBack() {
    if (!game || history.state?.guardian === runEntry) return;
    if (isPaused || screen === "over" || screen === "clear") return backToTitle();
    history.pushState({ ...history.state, guardian: runEntry }, "");
    setPaused(true);
  }

  function backToTitle() {
    saveRun();
    sendRecord();
    sound.stopMusic();
    if (isPaused) setPaused(false);
    game = null;
    screen = "start";
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

  function freeze() {
    handle(useFreeze(game));
    syncHud();
  }

  function buyItem(item) {
    if (!buy(game, item)) return;
    play("buy");
    syncPick();
  }

  // The server keeps each member's furthest wave; an old backend does not know the action
  async function loadRecords() {
    const res = await api.getGuardianRecords();
    records = res.success ? res.records : false;
    // A best the server never got (closed tab, failed save) goes up now, once
    const mine = (records || []).find((r) => r.user_name === $currentUser)?.wave ?? 0;
    if (records && localBest > mine && !hasResent) {
      hasResent = true;
      await api.saveGuardianRecord(localBest);
      loadRecords();
    }
  }

  // An endless run is over, by defeat or by leaving: its wave goes to the ranking
  async function sendRecord() {
    if (mode !== "endless" || !game || hasSentRun) return;
    hasSentRun = true;
    await api.saveGuardianRecord(game.wave + 1);
    loadRecords();
  }

  function toggleMute() {
    isMuted = !isMuted;
    sound.setMuted(isMuted);
  }

  // The card pick writes the draw into the ledger under the reward's label; one such entry means it is spent
  async function checkReward() {
    rewards = { normal: "checking", hard: "checking" };
    const res = await api.getLedger();
    if (!res.success) return (rewards = { normal: "error", hard: "error" });
    for (const key of Object.keys(REWARD_KEY)) {
      const isClaimed = (res.ledger || []).some(
        (item) => item.receiver === $currentUser && item.title?.includes(REWARD_LABELS[REWARD_KEY[key]]),
      );
      rewards[key] = isClaimed ? "claimed" : "available";
      if (isClaimed) {
        localStorage.removeItem(pendingKey[key]);
        pending[key] = false;
      }
    }
  }

  function goToReward(key) {
    navigate(`${base}/card-pick`, { state: { reward: REWARD_KEY[key] } });
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      // Coming back to a run in full swing would cost base HP
      if (screen === "playing") isPaused = true;
      saveRun();
      sound.suspend();
      input.firing = false;
    } else if (!raf) {
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
      if (!isPaused) sound.resume();
    }
  }

  onMount(async () => {
    ctx = canvas.getContext("2d");
    sound = createSound(SND, [...new Set(Object.values(SOUNDS).map(([file]) => file))]);
    checkReward();
    loadRecords();

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
    // Leaving mid-run
    saveRun();
    if (screen === "playing" || screen === "upgrade") sendRecord();
    cancelAnimationFrame(raf);
    sound?.close();
  });
</script>

<svelte:window on:resize={resize} on:popstate={onBack} />
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
  <!-- Above the overlays so muting works on every screen -->
  <div class="absolute top-0 inset-x-0 z-20 flex items-center gap-2 p-3 pointer-events-none">
    {#if screen === "playing" || screen === "upgrade"}
      <div class="flex-1 min-w-0">
        <p class="text-[11px] font-black tracking-widest {mode === 'normal' ? 'text-cyan-300' : 'text-rose-300'}">
          {mode === "normal" ? "" : `${mode.toUpperCase()} `}WAVE {hud.wave}{lastWave ? ` / ${lastWave}` : ""}
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
      <div class="pointer-events-auto" on:pointerdown|stopPropagation>
        <GameExitButton />
      </div>
      <div class="flex-1"></div>
    {/if}
    {#if screen === "playing"}
      <button
        type="button"
        on:pointerdown|stopPropagation
        on:click={() => setPaused(true)}
        aria-label="일시정지"
        class="pointer-events-auto w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white/10 border border-white/15 active:scale-90 transition-all"
      >
        ⏸
      </button>
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
    {#if MODES[mode].hasFreeze}
      <button
        type="button"
        on:pointerdown|stopPropagation
        on:click={freeze}
        disabled={hud.coins < hud.freezeCost}
        aria-label="시간 정지 사용, 코인 {hud.freezeCost}개"
        class="absolute left-[76px] bottom-[max(env(safe-area-inset-bottom),12px)] flex flex-col items-center active:scale-90 transition-all disabled:opacity-35"
      >
        <img src="{IMG}/skill-freeze.webp" alt="" class="w-14 h-14" />
        <span class="flex items-center gap-0.5 text-[11px] font-black text-amber-300 -mt-1">
          <img src="{IMG}/coin.webp" alt="" class="w-3.5 h-3.5" />
          {hud.freezeCost}
        </span>
      </button>
    {/if}
  {/if}

  <!-- Over the card pick as well, which the back button can pause too -->
  {#if isPaused && (screen === "playing" || screen === "upgrade")}
    <div
      class="absolute inset-0 z-[15] flex items-center justify-center p-5 {screen === 'upgrade' ? 'bg-[#05060f]' : 'bg-black/70'}"
      on:pointerdown|stopPropagation
    >
      <div class="w-full max-w-xs text-center">
        <h2 class="text-3xl font-black text-cyan-200">일시정지</h2>
        <p class="mt-2 text-sm text-gray-300">{lastWave ? `${lastWave}웨이브 중 ` : ""}{hud.wave}웨이브 진행 중</p>
        <button
          type="button"
          on:click={() => setPaused(false)}
          class="mt-6 w-full py-4 rounded-2xl font-black text-lg text-gray-900 bg-cyan-300 active:scale-95 transition-all"
        >
          계속하기
        </button>
        <button
          type="button"
          on:click={() => history.back()}
          class="mt-3 w-full py-3 rounded-2xl font-bold text-gray-200 bg-white/10 active:scale-95 transition-all"
        >
          저장하고 처음 화면으로
        </button>
        <p class="mt-3 text-xs text-gray-400">나갔다 와도 여기서부터 이어할 수 있어요</p>
      </div>
    </div>
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
        <p class="mt-3 text-sm text-gray-300">몰려오는 공세를 막고 기지를 지켜라</p>
        <div class="mt-4 flex flex-col items-center gap-1.5">
          {#each isHardOpen ? ["normal", "hard"] : ["normal"] as key}
            <p class="px-3 py-1.5 rounded-full text-xs font-bold text-amber-200 bg-black/50 border border-amber-300/40">
              {#if rewards[key] === "claimed"}
                {key === "hard" ? "하드" : "일반"} 클리어 보상은 이미 받았어요
              {:else if rewards[key] === "checking"}
                ⏳ {key === "hard" ? "하드" : "일반"} 클리어 보상 확인 중…
              {:else}
                🎁 {key === "hard" ? "하드" : "일반"} 클리어 보상: 용돈 카드뽑기 1회
              {/if}
            </p>
          {/each}
        </div>
      </div>
      <div
        class="absolute inset-x-0 bottom-0 px-5 pt-10 pb-[max(env(safe-area-inset-bottom),16px)] bg-gradient-to-t from-black/90 to-transparent"
      >
        <div class="max-w-xs mx-auto space-y-2">
          {#each ["normal", "hard"] as key}
            {#if pending[key] && rewards[key] === "available"}
              <button
                type="button"
                on:click={() => goToReward(key)}
                class="w-full py-3 rounded-2xl font-black text-white bg-gradient-to-r from-amber-500 to-rose-500 active:scale-95 transition-all"
              >
                🎁 아직 안 뽑은 {key === "hard" ? "하드" : "일반"} 클리어 보상 받기
              </button>
            {/if}
          {/each}
          <div class="flex gap-2">
            <button
              type="button"
              on:click={() => (saves.normal ? startGame("normal", loadRun("normal")) : startGame("normal"))}
              class="flex-1 py-4 rounded-2xl font-black text-lg text-gray-900 bg-cyan-300 active:scale-95 transition-all shadow-[0_0_24px_rgba(39,228,255,0.6)]"
            >
              {#if saves.normal}
                ▶ 이어하기 <span class="text-sm font-bold opacity-70">· {saves.normal}웨이브</span>
              {:else}
                게임 시작 <span class="text-sm font-bold opacity-70">· {MODES.normal.waves.length}웨이브</span>
              {/if}
            </button>
            {#if saves.normal}
              <button type="button" on:click={() => startGame("normal")} class="shrink-0 px-4 rounded-2xl text-sm font-bold text-gray-200 bg-black/60 border border-white/20 active:scale-95 transition-all">새로</button>
            {/if}
          </div>
          {#if isHardOpen}
            <div class="flex gap-2">
              <button
                type="button"
                on:click={() => (saves.hard ? startGame("hard", loadRun("hard")) : startWithIntro("hard"))}
                class="flex-1 py-4 rounded-2xl font-black text-lg text-white bg-gradient-to-r from-rose-600 to-fuchsia-600 active:scale-95 transition-all shadow-[0_0_24px_rgba(244,63,94,0.6)]"
              >
                {#if saves.hard}
                  🔥 하드 이어하기 <span class="text-sm font-bold opacity-80">· {saves.hard}웨이브</span>
                {:else}
                  🔥 하드 모드 <span class="text-sm font-bold opacity-80">· {MODES.hard.waves.length}웨이브</span>
                {/if}
              </button>
              {#if saves.hard}
                <button type="button" on:click={() => startGame("hard")} class="shrink-0 px-4 rounded-2xl text-sm font-bold text-gray-200 bg-black/60 border border-white/20 active:scale-95 transition-all">새로</button>
              {/if}
            </div>
          <!-- Until the ledger has answered, a mode that looks locked may not be -->
          {:else if rewards.normal === "checking"}
            <p class="w-full py-3 rounded-2xl text-center text-sm font-bold text-gray-300 bg-black/50 border border-white/10">
              ⏳ 클리어 여부를 확인하는 중…
            </p>
          {:else if rewards.normal === "error"}
            <button
              type="button"
              on:click={checkReward}
              class="w-full py-3 rounded-2xl text-sm font-bold text-amber-200 bg-black/50 border border-amber-300/30 active:scale-95 transition-all"
            >
              ⚠️ 클리어 여부를 확인하지 못했어요 · 다시 확인
            </button>
          {:else}
            <p class="w-full py-3 rounded-2xl text-center text-sm font-bold text-gray-400 bg-black/50 border border-white/10">
              🔒 하드 모드는 일반 모드를 클리어하면 열려요
            </p>
          {/if}
          {#if isEndlessOpen}
            <div class="flex gap-2">
              <button
                type="button"
                on:click={() => (saves.endless ? startGame("endless", loadRun("endless")) : startWithIntro("endless"))}
                class="flex-1 py-4 rounded-2xl font-black text-lg text-white bg-gradient-to-r from-violet-600 to-indigo-600 active:scale-95 transition-all shadow-[0_0_24px_rgba(139,92,246,0.6)]"
              >
                {#if saves.endless}
                  ♾️ 무한 이어하기 <span class="text-sm font-bold opacity-80">· {saves.endless}웨이브</span>
                {:else}
                  ♾️ 무한 모드
                  {#if localBest}<span class="text-sm font-bold opacity-80">· 최고 {localBest}웨이브</span>{/if}
                {/if}
              </button>
              {#if saves.endless}
                <button type="button" on:click={() => startGame("endless")} class="shrink-0 px-4 rounded-2xl text-sm font-bold text-gray-200 bg-black/60 border border-white/20 active:scale-95 transition-all">새로</button>
              {/if}
            </div>
          {:else if !isHardOpen}
            <!-- The line above already speaks for both -->
          {:else if rewards.hard === "checking"}
            <p class="w-full py-3 rounded-2xl text-center text-sm font-bold text-gray-300 bg-black/50 border border-white/10">
              ⏳ 클리어 여부를 확인하는 중…
            </p>
          {:else if rewards.hard === "error"}
            <button
              type="button"
              on:click={checkReward}
              class="w-full py-3 rounded-2xl text-sm font-bold text-amber-200 bg-black/50 border border-amber-300/30 active:scale-95 transition-all"
            >
              ⚠️ 클리어 여부를 확인하지 못했어요 · 다시 확인
            </button>
          {/if}
          <div class="flex">
            <button
              type="button"
              on:click={() => (showRules = true)}
              class="flex-1 py-2 text-sm font-bold text-gray-300 active:scale-95 transition-all"
            >
              게임 방법
            </button>
            {#if isEndlessOpen}
              <button
                type="button"
                on:click={() => (showRanking = true)}
                class="flex-1 py-2 text-sm font-bold text-amber-200 active:scale-95 transition-all"
              >
                🏆 무한 모드 랭킹
              </button>
            {/if}
          </div>
        </div>
      </div>

      {#if showRules}
        <div class="absolute inset-0 flex items-center justify-center p-5 bg-black/80">
          <div class="w-full max-w-xs">
            <h2 class="text-xl font-black text-cyan-300 text-center">게임 방법</h2>
            <ul class="mt-4 space-y-2 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-2xl p-4">
              <li>👆 화면을 누른 채 끌어서 조준하고 발사</li>
              <li>🧱 적이 아래 선을 넘으면 기지 체력 감소</li>
              <li>🃏 웨이브를 막을 때마다 강화 카드 3장 중 1장 선택</li>
              <li>💣 코인은 폭탄이나 카드 바꾸기에 사용</li>
              <li>👾 중간 보스를 넘고 마지막 보스를 잡으면 클리어</li>
            </ul>
            {#if isHardOpen}
              <button
                type="button"
                on:click={() => {
                  showRules = false;
                  intro = { mode: "hard", isStart: false };
                }}
                class="mt-3 w-full py-3 rounded-2xl font-bold text-rose-200 bg-rose-500/15 border border-rose-300/40 active:scale-95 transition-all"
              >
                🔥 하드 모드 안내 보기
              </button>
            {/if}
            {#if isEndlessOpen}
              <button
                type="button"
                on:click={() => {
                  showRules = false;
                  intro = { mode: "endless", isStart: false };
                }}
                class="mt-3 w-full py-3 rounded-2xl font-bold text-violet-200 bg-violet-500/15 border border-violet-300/40 active:scale-95 transition-all"
              >
                ♾️ 무한 모드 안내 보기
              </button>
            {/if}
            <button
              type="button"
              on:click={() => (showRules = false)}
              class="mt-3 w-full py-3 rounded-2xl font-bold bg-white/10 border border-white/20 active:scale-95 transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      {/if}

      {#if showRanking}
        <div class="absolute inset-0 flex items-center justify-center p-5 bg-black/85">
          <div class="w-full max-w-xs">
            <h2 class="text-xl font-black text-amber-200 text-center">🏆 무한 모드 랭킹</h2>
            <div class="mt-4"><Ranking {ranking} {records} {localBest} me={$currentUser} /></div>
            <button
              type="button"
              on:click={() => (showRanking = false)}
              class="mt-4 w-full py-3 rounded-2xl font-bold bg-white/10 border border-white/20 active:scale-95 transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      {/if}

      <!-- Mode briefing: shown before the first run of the mode, later from the rules sheet -->
      {#if intro?.mode === "endless"}
        <div class="absolute inset-0 flex flex-col bg-[#070812]">
          <div class="mt-14 flex-1 overflow-y-auto touch-pan-y px-5 pt-2 pb-4">
            <p class="text-[11px] font-black tracking-[0.4em] text-violet-300 text-center">ENDLESS MODE</p>
            <h2 class="mt-1 text-3xl font-black text-center text-white">무한 모드 안내</h2>

            <h3 class="mt-6 text-sm font-black text-cyan-300">규칙</h3>
            <ul class="mt-2 space-y-1.5 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-2xl p-4">
              <li>♾️ 끝이 없어요. 얼마나 멀리 가는지가 기록이에요</li>
              <li>👾 {ENDLESS.bossEvery}웨이브마다 보스, 뒤로 갈수록 더 강해져서 돌아와요</li>
              <li>🔧 보스를 잡으면 기지 체력 {MODES.endless.repair} 회복</li>
              <li>🏆 최고 기록은 가족 랭킹에 올라가요</li>
            </ul>

            <h3 class="mt-6 text-sm font-black text-amber-300">코인 쓸 곳</h3>
            <ul class="mt-2 space-y-1.5 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-2xl p-4">
              <li>🛒 웨이브 사이 상점: 기지 수리, 보호막, 카드 한 장 더 고르기</li>
              <li>⏱️ 시간 정지: 화면의 적이 {FREEZE.seconds}초 동안 멈춰요 (폭탄 옆 버튼)</li>
              <li>💣 폭탄과 카드 바꾸기는 그대로</li>
            </ul>

            <h3 class="mt-6 text-sm font-black text-teal-300">반복 카드 · {REPEAT_WAVE}웨이브를 넘기면 등장</h3>
            <ul class="mt-2 space-y-2">
              {#each lateCards("repeat") as card}
                <li class="flex items-center gap-3 p-3 rounded-2xl border {RARITY_STYLE.repeat}">
                  {#if card.image}
                    <img src="{IMG}/{card.image}" alt="" class="w-9 h-9 shrink-0" />
                  {:else}
                    <span class="text-3xl w-10 text-center shrink-0">{card.icon}</span>
                  {/if}
                  <span class="min-w-0">
                    <span class="block font-black">{card.label}</span>
                    <span class="block text-xs text-gray-200">{card.desc(0)} · 계속 다시 나와요</span>
                  </span>
                </li>
              {/each}
            </ul>

            <h3 class="mt-6 text-sm font-black text-cyan-300">특수 적 · {ENDLESS.types.hive.from}웨이브부터</h3>
            <ul class="mt-2 space-y-2">
              {#each SPECIAL_ENEMIES as enemy}
                <li class="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                  <img src="{IMG}/{enemy.file}.webp" alt="" class="w-14 h-14 shrink-0" />
                  <span class="min-w-0">
                    <span class="block font-black">{enemy.name}</span>
                    <span class="block text-xs text-gray-300">{enemy.text}</span>
                  </span>
                </li>
              {/each}
            </ul>

            <h3 class="mt-6 text-sm font-black text-amber-300">{TITAN_WAVE}웨이브 보스 · 보이드 타이탄</h3>
            <div class="mt-2 flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
              <img src="{IMG}/boss-titan.webp" alt="" class="w-16 h-16 shrink-0" />
              <ul class="min-w-0 space-y-1 text-xs text-gray-300">
                <li><strong class="text-white">중력 왜곡</strong> · 중력장 근처를 지나는 내 탄이 휘어요</li>
                <li><strong class="text-white">분신</strong> · 셋으로 갈라지고 진짜는 하나뿐이에요</li>
                <li><strong class="text-white">무기 봉인</strong> · 수정을 부술 때까지 자동 무기가 꺼져요</li>
              </ul>
            </div>

            <h3 class="mt-6 text-sm font-black text-rose-300">초월 무기 · {TRANSCEND_WAVE}웨이브를 넘기면 등장</h3>
            <ul class="mt-2 space-y-2">
              {#each lateCards("transcend") as card}
                <li class="flex items-center gap-3 p-3 rounded-2xl border {RARITY_STYLE.transcend}">
                  <span class="text-3xl w-10 text-center shrink-0">{card.icon}</span>
                  <span class="min-w-0">
                    <span class="block font-black">{card.label}</span>
                    <span class="block text-xs text-gray-200">{card.desc(0)}</span>
                  </span>
                </li>
              {/each}
            </ul>
          </div>
          <div class="px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] bg-black/60">
            <button
              type="button"
              on:click={closeIntro}
              class="w-full max-w-xs mx-auto block py-4 rounded-2xl font-black text-lg text-white bg-gradient-to-r from-violet-600 to-indigo-600 active:scale-95 transition-all"
            >
              {intro.isStart ? "출격" : "닫기"}
            </button>
            {#if intro.isStart}
              <p class="mt-2 text-[11px] text-gray-400 text-center">이 안내는 게임 방법에서 다시 볼 수 있어요.</p>
            {/if}
          </div>
        </div>
      {:else if intro}
        <div class="absolute inset-0 flex flex-col bg-[#070812]">
          <div class="mt-14 flex-1 overflow-y-auto touch-pan-y px-5 pt-2 pb-4">
            <p class="text-[11px] font-black tracking-[0.4em] text-rose-300 text-center">HARD MODE</p>
            <h2 class="mt-1 text-3xl font-black text-center text-white">하드 모드 안내</h2>

            <h3 class="mt-6 text-sm font-black text-cyan-300">달라지는 규칙</h3>
            <ul class="mt-2 space-y-1.5 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-2xl p-4">
              <li>🌊 {MODES.hard.waves.length}웨이브, 보스는 {HARD_BOSS_WAVES}웨이브</li>
              <li>🔧 보스를 잡으면 기지 체력 {MODES.hard.repair} 회복</li>
              <li>💣 폭탄은 웨이브가 오를수록 강해짐</li>
              <li>⏸ 오른쪽 위 버튼으로 일시정지</li>
              <li>🎁 클리어하면 용돈 카드뽑기 1회 추가</li>
            </ul>

            <h3 class="mt-6 text-sm font-black text-cyan-300">새로운 적</h3>
            <ul class="mt-2 space-y-2">
              {#each NEW_ENEMIES as enemy}
                <li class="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                  <img src="{IMG}/{enemy.file}.webp" alt="" class="w-14 h-14 shrink-0" />
                  <span class="min-w-0">
                    <span class="block font-black">{enemy.name}</span>
                    <span class="block text-xs text-gray-300">{enemy.text}</span>
                  </span>
                </li>
              {/each}
            </ul>

            <h3 class="mt-6 text-sm font-black text-cyan-300">보스의 새 패턴</h3>
            <ul class="mt-2 space-y-2">
              <li class="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <img src="{IMG}/boss-generator.webp" alt="" class="w-14 h-14 shrink-0" />
                <span class="min-w-0">
                  <span class="block font-black">보호막 발전기</span>
                  <span class="block text-xs text-gray-300">
                    보스 주위를 도는 발전기가 남아 있으면 보스는 피해를 받지 않아요. 발전기부터 부수세요.
                  </span>
                </span>
              </li>
              <li class="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <img src="{IMG}/boss-final.webp" alt="" class="w-14 h-14 shrink-0" />
                <span class="min-w-0">
                  <span class="block font-black">주포 충전</span>
                  <span class="block text-xs text-gray-300">
                    마지막 보스 드레드노트가 멈춰서 주포를 충전해요. 그동안 코어에 화력을 모아 게이지를 채우면 충전이 끊기고
                    보스가 잠시 무방비가 돼요. 못 끊으면 기지 체력이 {BOSSES.final.charge.damage} 깎여요.
                  </span>
                </span>
              </li>
            </ul>

            <h3 class="mt-6 text-sm font-black text-fuchsia-300">신화 무기 · {UNLOCK_WAVE}웨이브를 넘기면 등장</h3>
            <ul class="mt-2 space-y-2">
              {#each lateCards("mythic") as card}
                <li class="flex items-center gap-3 p-3 rounded-2xl border {RARITY_STYLE.mythic}">
                  <span class="text-3xl w-10 text-center shrink-0">{card.icon}</span>
                  <span class="min-w-0">
                    <span class="block font-black">{card.label}</span>
                    <span class="block text-xs text-gray-200">{card.desc(0)}</span>
                  </span>
                </li>
              {/each}
            </ul>

            <h3 class="mt-6 text-sm font-black text-emerald-300">진화 · 해당 카드를 끝까지 올리면 등장</h3>
            <ul class="mt-2 space-y-2">
              {#each lateCards("evo") as card}
                <li class="flex items-center gap-3 p-3 rounded-2xl border {RARITY_STYLE.evo}">
                  <span class="text-3xl w-10 text-center shrink-0">{card.icon}</span>
                  <span class="min-w-0">
                    <span class="block font-black">{card.label}</span>
                    <span class="block text-xs text-gray-200">{card.desc(0)}</span>
                  </span>
                </li>
              {/each}
            </ul>
            <p class="mt-3 text-xs text-gray-400 text-center">진화도 {UNLOCK_WAVE}웨이브를 넘긴 뒤부터 나와요.</p>
          </div>
          <div class="px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] bg-black/60">
            <button
              type="button"
              on:click={closeIntro}
              class="w-full max-w-xs mx-auto block py-4 rounded-2xl font-black text-lg text-white bg-gradient-to-r from-rose-600 to-fuchsia-600 active:scale-95 transition-all"
            >
              {intro.isStart ? "출격" : "닫기"}
            </button>
            {#if intro.isStart}
              <p class="mt-2 text-[11px] text-gray-400 text-center">이 안내는 게임 방법에서 다시 볼 수 있어요.</p>
            {/if}
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
            <p class="text-xs font-black tracking-widest text-amber-300">보스 격파!</p>
            <h2 class="mt-1 text-2xl font-black">보상 카드를 고르세요</h2>
            <p class="mt-1 text-xs text-gray-300">
              {hud.wave === UNLOCK_WAVE ? "신화 무기와 진화 카드가 풀렸어요" : "이번에는 희귀 이상 카드만 나옵니다"}
            </p>
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
                {#if card.max > 12}
                  {#if hud.levels[key]}<span class="text-xs font-black text-teal-200">×{hud.levels[key]}</span>{/if}
                {:else}
                  <span class="flex gap-0.5" aria-label="현재 {hud.levels[key]}단계, 최대 {card.max}단계">
                    {#each Array(card.max) as _, i}
                      <span class="{card.max > 6 ? 'w-1' : 'w-1.5'} h-4 rounded-sm {i < hud.levels[key] ? 'bg-cyan-300' : 'bg-white/20'}"></span>
                    {/each}
                  </span>
                {/if}
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
          {#if hud.shop}
            <!-- Endless mode's shop: prices go up with every purchase -->
            <div class="mt-2 grid grid-cols-3 gap-2">
              {#each [["repair", "🔧", "수리 +1"], ["shield", "🛡️", "보호막 +1"], ["extra", "🃏", "한 장 더"]] as [item, icon, label]}
                <button
                  type="button"
                  on:click={() => buyItem(item)}
                  disabled={hud.coins < hud.shop[item] ||
                    (item === "repair" && hud.hp >= PLAYER.hp) ||
                    (item === "extra" && (hud.hasExtraPick || hud.choices.length < 2))}
                  class="py-2 rounded-xl text-xs font-bold bg-white/10 border border-white/20 active:scale-95 transition-all disabled:opacity-40"
                >
                  <span class="block">{icon} {label}</span>
                  <span class="flex items-center justify-center gap-0.5 text-amber-300">
                    <img src="{IMG}/coin.webp" alt="코인" class="w-3.5 h-3.5" />
                    {hud.shop[item]}
                  </span>
                </button>
              {/each}
            </div>
            {#if hud.hasExtraPick}
              <p class="mt-2 text-xs font-bold text-teal-200">이번에는 카드를 두 장 고릅니다.</p>
            {/if}
          {/if}
        {:else if screen === "over"}
          <h2 class="text-4xl font-black text-rose-400">GAME OVER</h2>
          {#if mode === "endless"}
            <p class="mt-3 text-gray-300">
              <strong class="text-2xl text-white">{hud.wave}웨이브</strong>까지 버텼습니다.
            </p>
            <p class="mt-1 text-sm font-bold text-amber-200">
              {hud.wave >= localBest ? "🎉 내 최고 기록!" : `내 최고 기록 ${localBest}웨이브`}
            </p>
            <div class="mt-4"><Ranking {ranking} {records} {localBest} me={$currentUser} /></div>
          {:else}
            <p class="mt-3 text-gray-300">
              {lastWave}웨이브 중 <strong class="text-white">{hud.wave}웨이브</strong>에서 기지가 무너졌습니다.
            </p>
          {/if}
          <button
            type="button"
            on:click={() => startGame()}
            class="mt-6 w-full py-4 rounded-2xl font-black text-lg text-gray-900 bg-cyan-300 active:scale-95 transition-all"
          >
            다시 도전
          </button>
          <button
            type="button"
            on:click={() => history.back()}
            class="mt-3 w-full py-3 rounded-2xl font-bold text-gray-200 bg-white/10 active:scale-95 transition-all"
          >
            처음 화면으로
          </button>
        {:else if screen === "clear"}
          <h2 class="text-4xl font-black text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.7)]">
            {mode === "hard" ? "HARD CLEAR!" : "CLEAR!"}
          </h2>
          <p class="mt-3 text-gray-200">
            {mode === "hard" ? `최종 보스를 격파하고 ${lastWave}번의 공세를 모두 막아냈습니다.` : "보스를 격파하고 기지를 지켜냈습니다."}
          </p>
          {#if rewards[mode] === "checking"}
            <p class="mt-6 text-sm text-gray-300 animate-pulse">보상 확인 중...</p>
          {:else if rewards[mode] === "available"}
            <p class="mt-4 text-xs text-gray-300">
              카드는 한 번만 뽑을 수 있고, 뽑은 금액은 장부에 기록돼요.
            </p>
            <button
              type="button"
              on:click={() => goToReward(mode)}
              class="mt-4 w-full py-4 rounded-2xl font-black text-lg text-white bg-gradient-to-r from-amber-500 to-rose-500 active:scale-95 transition-all"
            >
              🎁 용돈 카드 뽑으러 가기
            </button>
          {:else if rewards[mode] === "claimed"}
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
            on:click={() => startGame()}
            class="mt-3 w-full py-3 rounded-2xl font-bold text-gray-200 bg-white/10 active:scale-95 transition-all"
          >
            한 판 더
          </button>
          <button
            type="button"
            on:click={() => history.back()}
            class="mt-2 w-full py-2 text-sm font-bold text-gray-300 active:scale-95 transition-all"
          >
            처음 화면으로
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>
