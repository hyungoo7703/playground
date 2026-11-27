<script>
  import { onMount, onDestroy } from "svelte";
  import { navigate } from "svelte-routing";
  import { base, currentUser } from "../lib/store.js";
  import { api } from "../lib/api.js";
  import { toast } from "../lib/feedback.js";
  import { hasDrawn } from "../lib/rewards.js";
  import GameExitButton from "../lib/components/GameExitButton.svelte";
  import Ranking from "../lib/rune/Ranking.svelte";
  import { createSound } from "../lib/rune/sound.js";
  import {
    createGame,
    saveGame,
    loadGame,
    update,
    summon,
    summonPrice,
    summonOdds,
    moveUnit,
    craft,
    sell,
    upgrade,
    upgradePrice,
    readyRecipes,
    slotCenter,
    strength,
  } from "../lib/rune/engine.js";
  import { makeShot, drawShot, drawBolt } from "../lib/rune/shots.js";
  import { FIELD, TRACK, GRID, RULES, TIERS, TIER, MERGE, UPGRADES, UNITS, RECIPES, ENEMIES, BOSSES } from "../lib/rune/config.js";

  const IMG = `${base}/images/rune`;
  const SND = `${base}/sound`;
  // The slice of the field the canvas shows: the road, the slots inside it and room for whoever walks it
  const VIEW = { y: 58, h: 458 };
  const SLOTS = GRID.cols * GRID.rows;
  const TIER_COLOR = { common: "#c3cad6", rare: "#4aa8ff", epic: "#b77bff", legendary: "#ffb23e", mythic: "#ff5f8a" };

  // name: [file, volume, least ms between two plays, seconds to cut a long file at]
  const SOUNDS = {
    summon: ["universfield-magic-teleport-whoosh-352764.mp3", 0.45, 80, 1.2],
    rare: ["shidenbeatsmusic-sound-effect-twinklesparkle-115095.mp3", 0.6, 0, 0],
    epic: ["emand_edroff-fairy-dust-magical-chime-576279.mp3", 0.7, 0, 3],
    riser: ["koiroylers-small-riser-351977.mp3", 0.8, 0, 0],
    legendary: ["breakzstudios-epic-cinematic-reveal-logo-201065.mp3", 0.9, 0, 6],
    mythic: ["dragon-studio-heavenly-choir-515273.mp3", 0.9, 0, 7],
    jackpot: ["dragon-studio-angel-choir-463220.mp3", 0.8, 0, 4],
    merge: ["daviddumaisaudio-magical-spell-cast-190272.mp3", 0.5, 80, 0],
    fail: ["freesound_community-fizzle-101872.mp3", 0.6, 0, 1.5],
    sword: ["54427377-sword-slash-476148.mp3", 0.1, 240, 0.5],
    bow: ["freesound_community-bow_release-85040.mp3", 0.12, 220, 0],
    volley: ["djartmusic-many-arrows-flying-by-306037.mp3", 0.1, 700, 1],
    magic: ["dragon-studio-epic-spell-impact-478364.mp3", 0.08, 280, 0.6],
    nature: ["rescopicsound-elemental-magic-spell-impact-outgoing-228342.mp3", 0.08, 420, 0.7],
    fire: ["koiroylers-fireball-impact-351961.mp3", 0.1, 380, 0.9],
    ice: ["dragon-studio-ice-spell-impact-448563.mp3", 0.1, 420, 0.9],
    lightning: ["dragon-studio-lightning-spell-386163.mp3", 0.1, 320, 0],
    meteor: ["freesound_community-missile-45075.mp3", 0.12, 900, 1.5],
    horn: ["kave_msri-war-horn-sfx-319881.mp3", 0.6, 0, 3],
    roar: ["dragon-studio-epic-dragon-roar-364481.mp3", 0.7, 0, 0],
    bossSummon: ["dragon-studio-deep-sea-monster-roar-329857.mp3", 0.35, 0, 2],
    fanfare: ["universfield-victory-fanfare-152480.mp3", 0.7, 0, 0],
    alarm: ["alexis_gaming_cam-alarme-342932.mp3", 0.3, 3200, 0],
    over: ["calango_fx_official-game-over-401236.mp3", 0.7, 0, 0],
    anvil: ["freesound_community-anvil-hit-1-103967.mp3", 0.5, 0, 0],
    luck: ["freesound_community-anvil-hit-2-14845.mp3", 0.5, 0, 0],
    timeStop: ["universfield-magic-spell-278824.mp3", 0.4, 0, 1.5],
    treasure: ["pwlpl-power-up-game-sound-effect-359227.mp3", 0.6, 0, 1.6],
  };
  const MUSIC = "openmindaudio-cinematic-action-epic-trailer-iron-vanguard-part-1-short-preview-488562.mp3";
  // How much louder an attack is for each tier above common
  const LOUDER = [1, 1.1, 1.3, 1.7, 2.2];
  const BUMP = 0.16; // seconds a unit's move with its attack lasts
  // The help one unit gives others, in the order its marks are drawn: who gives it, its colour, what it raises
  const BUFFS = {
    near: { giver: "paladin", color: "#ffe27a", what: "공격력" },
    power: { giver: "seraph", color: "#ff7aa2", what: "공격력" },
    haste: { giver: "valkyrie", color: "#9fe8ff", what: "공속" },
  };
  const BLOCK = 0.3; // seconds the guard that turned a hit away shows
  const GUARD = { armor: { color: "#c9d3e3", label: "중갑" }, ward: { color: "#c79bff", label: "마법저항" } };
  // What an enemy is washed over with while something has hold of it
  const TINT = { stopped: "#d6f1ff", slowed: "#3f9dff", enraged: "#ff3b3b" };

  // How each unit's attack sounds
  const VOICE = {
    swordsman: "sword", rogue: "sword", knight: "sword", paladin: "sword", valkyrie: "sword",
    archer: "bow", sniper: "bow", ranger: "volley",
    apprentice: "magic", chronomancer: "magic", seraph: "magic", archmage: "meteor",
    pyromancer: "fire", dragonknight: "fire", elderdragon: "fire",
    cryomancer: "ice", stormcaller: "lightning",
    druid: "nature", alchemist: "nature", worldtree: "nature",
  };
  const UNIT_TEXT = {
    swordsman: "가까운 적을 빠르게 벤다",
    archer: "멀리서 한 명씩 쏜다",
    apprentice: "마법탄을 쏜다",
    rogue: "아주 빠른 공격, 15% 확률로 3배 치명타",
    knight: "묵직한 일격, 15% 확률로 기절",
    ranger: "한 번에 3명을 쏜다",
    pyromancer: "주변까지 태우는 폭발",
    cryomancer: "맞은 적을 30% 느리게",
    paladin: "둘레 8칸 아군의 공격력 +25% (성기사가 여럿이어도 겹치지 않음)",
    sniper: "어디든 닿는 저격. 방어 무시, 가장 튼튼한 적부터",
    stormcaller: "5명까지 튀는 번개",
    druid: "맹독: 초당 최대 체력의 4% (보스는 0.6%)",
    dragonknight: "넓게 휩쓰는 화염창",
    archmage: "적이 가장 몰린 곳에 운석",
    valkyrie: "아군 전체 공격 속도 +15% (여럿이어도 겹치지 않음)",
    alchemist: "적을 잡을 때마다 골드 +1 (여럿이어도 겹치지 않음)",
    elderdragon: "거대한 화염 숨결",
    chronomancer: "모든 적 35% 감속, 12초마다 2초간 시간 정지 (여럿이어도 겹치지 않음)",
    seraph: "아군 전체 공격력 +40% (여럿이어도 겹치지 않음), 방어 무시",
    worldtree: "한 번에 6명 공격, 웨이브마다 골드 +50 (골드는 여럿이어도 겹치지 않음)",
  };
  const ENEMY_TEXT = {
    slime: "평범하다",
    goblin: "빠르다",
    bat: "약하지만 떼로 온다",
    orc: "중갑: 물리 피해 60% 감소",
    wraith: "마법저항: 마법 피해 60% 감소",
    shaman: "주변 적을 계속 회복시킨다",
    golem: "아주 튼튼하고, 물리·마법 모두 30% 감소",
    thief: "한 바퀴 반을 돌면 도망간다. 잡으면 큰 골드",
    ogre: "물리 30% 감소. 체력이 절반 아래로 가면 폭주",
    lich: "마법 50% 감소. 6초마다 아군 3명을 얼린다",
    hydra: "초당 최대 체력의 1.2%를 재생",
    demon: "물리·마법 40% 감소. 박쥐 떼를 부른다",
  };

  const saveKey = `rune_save_${$currentUser}`;
  const bestKey = `rune_best_${$currentUser}`;
  const seenKey = `rune_seen_${$currentUser}`;
  const INTRO_KEY = "rune_intro_seen";
  // Marks the history entry a run sits on, so the back button pauses before it leaves
  const runEntry = Math.random().toString(36).slice(2);
  // Which window holds the run: the last one to start it or pick it up. Any other window still
  // showing it has an older copy, and playing that on would be a way to take an outcome back.
  const ownerKey = `rune_owner_${$currentUser}`;
  const isMine = () => localStorage.getItem(ownerKey) === runEntry;

  // Shown one at a time under the loading bar
  const TIPS = [
    "같은 유닛 두 개를 겹치면 윗등급에 도전해요.",
    "신화는 뽑기로 나오지 않아요. 도감에 적힌 세 유닛을 모으세요.",
    "중갑은 마법으로, 마법저항은 물리로 뚫으세요.",
    "유닛을 누르면 사거리가 보여요. 가장자리는 길에 가까워요.",
    "행운을 올리면 희귀 이상이 더 자주 나와요.",
    "보스는 60초 안에 잡아야 해요. 화력을 아껴 두지 마세요.",
    "40웨이브의 마왕을 쓰러뜨리면 클리어예요.",
  ];
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  const IMAGE_FILES = [...Object.keys(UNITS), ...Object.keys(ENEMIES), ...Object.keys(BOSSES), "background", "circle"];
  const EFFECT_FILES = Object.values(SOUNDS).map(([file]) => file);
  const TOTAL = IMAGE_FILES.length + EFFECT_FILES.length;

  let screen = "loading"; // loading | ready | start | playing | over
  let loadedCount = 0; // images and sound effects in, of TOTAL
  let hasFailedToLoad = false;
  let hud = { wave: 1, gold: 0, count: 0, price: 0, isFull: false, levels: {}, prices: {}, ready: [], boss: null, odds: {} };
  let hudSign = "";
  let isMuted = false;
  let isPaused = false;
  let speed = 1;
  let showRules = false;
  let startsAfterRules = false;
  let showBook = false;
  let showRanking = false;
  // The first clear earns one allowance card pick. A clear whose card has not been drawn yet
  // survives closing the app.
  const pendingKey = `rune_reward_pending_${$currentUser}`;
  let reward = "checking"; // checking | available | claimed | error
  let isRewardPending = localStorage.getItem(pendingKey) === "1";
  let showClear = false;
  let reveal = null; // the full-screen arrival of a legendary or a mythic: { key, tier, isShown, title }
  let banner = null; // a line across the top for an epic: { text, color }
  let info = null; // the unit tapped: { slot, key }
  let records = null; // null while loading, false when the server cannot say, else best waves per member
  let localBest = Number(localStorage.getItem(bestKey)) || 0;
  let savedWave = loadGame(localStorage.getItem(saveKey))?.wave ?? 0;
  // What this player has come across so far, on any run: it fills in the book
  let seen = { units: [], enemies: [], crafted: [], ...JSON.parse(localStorage.getItem(seenKey) || "{}") };
  let hasSentRun = false;
  let hasResent = false;

  $: ranking = (records || []).filter((r) => r.wave > 0).sort((a, b) => b.wave - a.wave);
  $: danger = hud.count >= RULES.enemyLimit * RULES.dangerAt;
  // Everything is in: wait for the tap that also lets the sound start
  $: if (screen === "loading" && loadedCount >= TOTAL) screen = "ready";

  let wrap;
  let canvas;
  let ctx;
  let game = null;
  let raf = 0;
  let lastTime = 0;
  let scale = 1;
  let dpr = 1;
  let originX = 0;
  let originY = 0;
  let images = {};
  let sound;
  let revealTimer;
  let bannerTimer;
  let observer;

  let drag = null; // { slot, key, x, y, hasMoved }
  let particles = [];
  let effects = []; // short-lived shots, rings, arcs and the fading shapes of the fallen
  let texts = []; // words floating up from where something happened
  let bumps = {}; // slot -> { life, x, y }: the move a unit makes as it attacks, and the seconds left of it
  let hits = {}; // enemy id -> seconds left of its flinch at being hit
  let shake = 0; // field px the picture is jolted by, dying away
  let blocks = {}; // enemy id -> { life, kind }: the armor or ward it just showed
  let told = {}; // enemy id -> seconds until its guard is spelled out in words again
  let toldAny = 0; // seconds until any guard is
  const tints = {};
  let flash = null; // { color, life }
  const lastPlayed = {};

  function play(name, louder = 1) {
    const [file, volume, gap, seconds] = SOUNDS[name];
    const now = performance.now();
    if (gap && now - (lastPlayed[name] ?? 0) < gap) return;
    lastPlayed[name] = now;
    sound.play(file, volume * louder, seconds);
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `${IMG}/${file}.webp`;
    });
  }

  function resize() {
    if (!wrap || !canvas) return;
    const { width, height } = wrap.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    scale = Math.min(width / FIELD.w, height / VIEW.h);
    originX = (width - FIELD.w * scale) / 2;
    originY = (height - VIEW.h * scale) / 2;
    draw();
  }

  function remember(kind, key) {
    if (seen[kind].includes(key)) return;
    seen[kind] = [...seen[kind], key];
    localStorage.setItem(seenKey, JSON.stringify(seen));
  }

  function burst(x, y, color, count, power = 110) {
    for (let i = 0; i < count && particles.length < 320; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = power * (0.3 + Math.random() * 0.7);
      particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 0.3 + Math.random() * 0.35, color });
    }
  }

  // An enemy's picture washed over with a colour
  function tinted(type, color) {
    const key = type + color;
    if (!tints[key]) {
      const img = images[type];
      const copy = document.createElement("canvas");
      copy.width = copy.height = Math.min(img.width, 160);
      const c = copy.getContext("2d");
      c.drawImage(img, 0, 0, copy.width, copy.height);
      c.globalCompositeOperation = "source-atop";
      c.globalAlpha = 0.55;
      c.fillStyle = color;
      c.fillRect(0, 0, copy.width, copy.height);
      tints[key] = copy;
    }
    return tints[key];
  }

  // An enemy taking a hit from a unit: it flinches, or shows the armor or ward that turned part of it away
  function strike(id, key, seconds) {
    const enemy = game?.enemies.find((e) => e.id === id);
    if (!enemy) return;
    const def = ENEMIES[enemy.type] ?? BOSSES[enemy.type];
    const kind = UNITS[key].type === "phys" ? "armor" : "ward";
    if (UNITS[key].pierce || !def[kind]) return (hits[id] = seconds);
    blocks[id] = { life: BLOCK, kind };
    // Spelled out once in a while, not at every blow
    if (told[id] > 0 || toldAny > 0) return;
    told[id] = 3;
    toldAny = 0.4;
    say(`${GUARD[kind].label} -${Math.round(def[kind] * 100)}%`, enemy.x, enemy.y - def.size * 1.15 - 12, GUARD[kind].color, 11, 0.9);
  }

  function addEffect(effect, seconds) {
    if (effects.length < 140) effects.push({ ...effect, life: seconds, span: seconds });
  }

  function say(text, x, y, color = "#ffffff", size = 14, seconds = 1.2) {
    if (texts.length < 60) texts.push({ text, x, y, color, size, life: seconds, span: seconds });
  }

  // A new unit on the board: the rarer, the louder
  function arrive(e, how) {
    const { x, y } = slotCenter(e.slot);
    const color = TIER_COLOR[e.tier];
    const name = UNITS[e.key].name;
    remember("units", e.key);
    if (e.tier === "mythic") remember("crafted", e.key);
    addEffect({ type: "ring", x, y, color, radius: 38 }, 0.45);
    burst(x, y, color, e.tier === "common" ? 6 : 16);
    info = null;
    if (e.tier === "legendary" || e.tier === "mythic") {
      const title = how === "craft" ? "신화 강림" : how === "merge" ? "승급 대성공!" : "전설 소환!";
      reveal = { key: e.key, tier: e.tier, isShown: false, title };
      play("riser");
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => {
        reveal = { ...reveal, isShown: true };
        play(e.tier);
        navigator.vibrate?.([40, 60, 120]);
      }, 1700);
    } else if (e.tier === "epic") {
      play(e.jackpot ? "jackpot" : "epic");
      flash = { color, life: 0.5 };
      banner = { text: `${e.jackpot ? "두 단계 승급! " : ""}영웅 · ${name}`, color };
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => (banner = null), 1800);
    } else if (e.tier === "rare") {
      play(how === "summon" ? "rare" : "merge");
    } else {
      play("summon");
    }
  }

  function handle(events) {
    for (const e of events) {
      if (e.type === "attack") {
        const shot = makeShot(e, slotCenter(e.slot));
        const from = slotCenter(e.slot);
        const reach = Math.hypot(e.x - from.x, e.y - from.y) || 1;
        bumps[e.slot] = { life: BUMP, x: ((e.x - from.x) / reach) * shot.kick, y: ((e.y - from.y) / reach) * shot.kick };
        addEffect(shot, shot.seconds);
        if (e.crit) say("치명타!", e.x, e.y - 16, "#fff36b", 11);
        play(VOICE[e.key], LOUDER[shot.rank]);
      } else if (e.type === "chain") {
        addEffect({ ...e, color: "#fff36b" }, 0.16);
        strike(e.id, e.key, 0.16);
      }
      else if (e.type === "kill") {
        // It stays a moment, so that what killed it has something to land on
        addEffect({ ...e, type: "ghost" }, 0.22);
        burst(e.x, e.y, "#d9f7c4", 5, 70);
      } else if (e.type === "gold") {
        if (e.amount >= 5) say(`+${Math.floor(e.amount)}`, e.x, e.y - 10, "#ffd866");
      } else if (e.type === "summon") arrive(e, "summon");
      else if (e.type === "craft") arrive(e, "craft");
      else if (e.type === "merge") {
        if (e.failed) {
          const { x, y } = slotCenter(e.slot);
          say("실패…", x, y - 22, "#ff9d9d", 16);
          play("fail");
          remember("units", e.key);
          info = null;
        } else arrive(e, "merge");
      } else if (e.type === "wave") {
        say(`WAVE ${e.wave}`, FIELD.w / 2, VIEW.y + 46, "#ffffff", 22);
      } else if (e.type === "bossWarn") {
        play("horn");
        say("보스 접근!", FIELD.w / 2, VIEW.y + 72, "#ff7a7a", 20);
      } else if (e.type === "bossArrive") {
        play("roar");
        flash = { color: "#ff3355", life: 0.6 };
        shake = 4;
      } else if (e.type === "bossDead") {
        play("fanfare");
        shake = 5;
        addEffect({ ...e, type: "ghost" }, 0.7);
        burst(e.x, e.y, "#ffd866", 60, 240);
        flash = { color: "#ffd866", life: 0.6 };
      } else if (e.type === "clear") {
        play("mythic");
        showClear = true;
        if (reward !== "claimed") {
          localStorage.setItem(pendingKey, "1");
          isRewardPending = true;
        }
        saveRun();
        // Not through sendRecord: the run goes on, and its last wave is still to be sent
        api.saveRuneRecord(game.wave).then(loadRecords);
        checkReward();
      } else if (e.type === "bossSummon") play("bossSummon");
      else if (e.type === "thief") {
        say("보물 고블린 등장!", FIELD.w / 2, VIEW.y + 72, "#ffd866", 16);
        play("rare");
      } else if (e.type === "thiefCaught") {
        play("treasure");
        burst(e.x, e.y, "#ffd866", 30, 180);
      } else if (e.type === "thiefGone") say("도망갔다…", e.x, e.y - 12, "#c9c9c9");
      else if (e.type === "freeze") {
        const { x, y } = slotCenter(e.slot);
        addEffect({ type: "ring", x, y, color: "#8fe3ff", radius: 30 }, 0.4);
        play("ice");
      } else if (e.type === "timeStop") {
        say("시간 정지", FIELD.w / 2, VIEW.y + VIEW.h / 2, "#bfe9ff", 20);
        play("timeStop");
        // It goes out from the sage over the whole field
        addEffect({ type: "ring", ...slotCenter(game.units.find((u) => u.key === "chronomancer").slot), color: "#bfe9ff", radius: 440 }, 0.8);
        flash = { color: "#9fe8ff", life: 0.45 };
        shake = 2;
      } else if (e.type === "sell") play("merge");
    }
  }

  // What the buttons and gauges show. Rebuilt only when one of them would read differently.
  function sync() {
    const boss = game.enemies.find((e) => BOSSES[e.type]);
    // An enemy goes into the book once it is on the road
    for (const e of game.enemies) remember("enemies", e.type);
    const next = {
      wave: game.wave,
      isCleared: !!game.cleared,
      gold: Math.floor(game.gold),
      count: game.enemies.length,
      price: summonPrice(game),
      isFull: game.units.length >= SLOTS,
      levels: game.levels,
      prices: Object.fromEntries(Object.keys(UPGRADES).map((key) => [key, upgradePrice(game, key)])),
      ready: readyRecipes(game),
      boss: boss && { name: BOSSES[boss.type].name, hp: Math.ceil((100 * boss.hp) / boss.maxHp), left: Math.max(0, Math.ceil(game.bossDeadline - game.time)) },
      odds: summonOdds(game),
    };
    const sign = JSON.stringify(next);
    if (sign !== hudSign) {
      hudSign = sign;
      hud = { ...next, levels: { ...game.levels } };
    }
    if (game.wave > localBest) {
      localBest = game.wave;
      localStorage.setItem(bestKey, String(localBest));
    }
    if (game.phase === "over" && screen === "playing") {
      screen = "over";
      sound.stopMusic();
      play("over");
      drag = null;
      info = null;
      saveRun();
      sendRecord();
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (isPaused) return;
    // Nothing moves while a legendary is arriving, the book is open or the clear is being announced
    if (screen === "playing" && !reveal && !showBook && !showClear) {
      handle(update(game, dt * speed));
      if (game.enemies.length >= RULES.enemyLimit * RULES.dangerAt && game.phase === "playing") play("alarm");
      sync();
    }
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const fx of effects) {
      fx.life -= dt;
      if (fx.type === "shot" && !fx.hasLanded && fx.span - fx.life >= fx.fly) {
        // The better the unit, the harder it lands
        fx.hasLanded = true;
        burst(fx.x2, fx.y2, fx.color, 3 + fx.rank * 3 + (fx.splash ? 8 : 0) + (fx.crit ? 5 : 0), 70 + fx.rank * 30);
        for (const id of fx.ids) strike(id, fx.key, 0.1 + fx.rank * 0.03);
        shake = Math.max(shake, fx.shake);
        if (fx.rank >= 3 && fx.dealt) say(String(Math.round(fx.dealt)), fx.x2 + (fx.seed - 0.5) * 22, fx.y2 - 18, fx.isCut ? "#9aa3b2" : TIER_COLOR[TIERS[fx.rank]], (7 + fx.rank * 1.7) * (fx.isCut ? 0.85 : 1), 0.7);
      }
    }
    effects = effects.filter((fx) => fx.life > 0);
    for (const t of texts) t.life -= dt;
    texts = texts.filter((t) => t.life > 0);
    for (const slot in bumps) if ((bumps[slot].life -= dt) <= 0) delete bumps[slot];
    for (const id in hits) if ((hits[id] -= dt) <= 0) delete hits[id];
    for (const id in blocks) if ((blocks[id].life -= dt) <= 0) delete blocks[id];
    for (const id in told) if ((told[id] -= dt) <= 0) delete told[id];
    toldAny -= dt;
    shake = Math.max(0, shake - dt * 14);
    if (flash && (flash.life -= dt) <= 0) flash = null;
    draw();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawUnit(key, x, y, size, alpha = 1) {
    const color = TIER_COLOR[UNITS[key].tier];
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.4, size * 0.4, size * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.drawImage(images[key], x - size / 2, y - size / 2 - 3, size, size);
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0b120e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = scale * dpr;
    ctx.setTransform(k, 0, 0, k, originX * dpr, originY * dpr - VIEW.y * k);
    if (shake) ctx.translate((Math.random() - 0.5) * 2 * shake, (Math.random() - 0.5) * 2 * shake);
    if (images.background) ctx.drawImage(images.background, 0, 0, FIELD.w, FIELD.w * (images.background.height / images.background.width));

    // The road
    const sideX = TRACK.right - TRACK.left;
    const sideY = TRACK.bottom - TRACK.top;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = TRACK.width + 6;
    ctx.strokeRect(TRACK.left, TRACK.top, sideX, sideY);
    // It reddens as it fills, and throbs once the end is near
    const full = game ? Math.min(1, game.enemies.length / RULES.enemyLimit) : 0;
    const heat = Math.max(0, (full - 0.4) / 0.6);
    if (full >= RULES.dangerAt) {
      ctx.strokeStyle = `rgba(255,60,80,${0.35 + 0.3 * Math.sin(performance.now() / 140)})`;
      ctx.lineWidth = TRACK.width + 14;
      ctx.strokeRect(TRACK.left, TRACK.top, sideX, sideY);
    }
    ctx.strokeStyle = `rgb(${74 + 70 * heat},${67 - 30 * heat},${85 - 35 * heat})`;
    ctx.lineWidth = TRACK.width;
    ctx.strokeRect(TRACK.left, TRACK.top, sideX, sideY);
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.strokeRect(TRACK.left, TRACK.top, sideX, sideY);
    ctx.setLineDash([]);
    // Where they come in
    if (images.circle) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(images.circle, TRACK.left - 21, TRACK.top - 21, 42, 42);
      ctx.globalAlpha = 1;
    }

    // Slots
    const over = drag?.hasMoved ? slotAt(drag.x, drag.y) : null;
    for (let slot = 0; slot < SLOTS; slot++) {
      const c = slotCenter(slot);
      roundRect(c.x - c.w / 2 + 2, c.y - c.h / 2 + 2, c.w - 4, c.h - 4, 9);
      ctx.fillStyle = slot === over ? "rgba(255,255,255,0.18)" : "rgba(8,12,10,0.42)";
      ctx.fill();
      ctx.strokeStyle = slot === info?.slot ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (!game) return;

    // The slots round a paladin, where its blessing reaches. One being carried shows where it would.
    const color = BUFFS.near.color;
    for (const unit of game.units) {
      if (!UNITS[unit.key].near) continue;
      const at = drag?.hasMoved && drag.slot === unit.slot ? (over ?? unit.slot) : unit.slot;
      for (let slot = 0; slot < SLOTS; slot++) {
        const isNext = slot !== at && Math.abs((slot % GRID.cols) - (at % GRID.cols)) <= 1 && Math.abs(Math.floor(slot / GRID.cols) - Math.floor(at / GRID.cols)) <= 1;
        if (!isNext) continue;
        const c = slotCenter(slot);
        roundRect(c.x - c.w / 2 + 2, c.y - c.h / 2 + 2, c.w - 4, c.h - 4, 9);
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // The reach of the unit being looked at or carried
    const shown = drag?.hasMoved ? { key: drag.key, slot: over ?? drag.slot } : info;
    if (shown) {
      const c = slotCenter(shown.slot);
      ctx.beginPath();
      ctx.arc(c.x, c.y, UNITS[shown.key].range, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Time stood still lies over the whole field
    const isStopped = game.stopUntil > game.time;
    if (isStopped) {
      ctx.fillStyle = "rgba(150,215,255,0.12)";
      ctx.fillRect(0, VIEW.y, FIELD.w, VIEW.h);
    }
    const now = performance.now();

    // Enemies, the lower ones in front
    for (const e of [...game.enemies].sort((a, b) => a.y - b.y)) {
      const boss = BOSSES[e.type];
      const def = boss ?? ENEMIES[e.type];
      const size = def.size * 2.3;
      const isStunned = !boss && e.stunUntil > game.time;
      const state = isStopped && !boss ? "stopped" : e.slowUntil > game.time ? "slowed" : def.enrage && e.hp < e.maxHp * def.enrage[0] ? "enraged" : null;
      const img = state ? tinted(e.type, TINT[state]) : images[e.type];
      ctx.save();
      ctx.translate(e.x, e.y);
      // Drawn facing left: turned round on the two sides where they walk right or down
      if (e.side < 2) ctx.scale(-1, 1);
      // Just hit: it swells and whitens for a moment
      const flinch = hits[e.id] ?? 0;
      const shown = size * (1 + flinch * 1.2);
      ctx.drawImage(img, -shown / 2, -shown / 2 - 4, shown, shown);
      if (flinch) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, flinch * 6);
        ctx.drawImage(img, -shown / 2, -shown / 2 - 4, shown, shown);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      const w = size * 0.7;
      const top = e.y - size / 2 - 8;
      if (e.hp < e.maxHp) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(e.x - w / 2, top, w, 3.5);
        ctx.fillStyle = e.poisonUntil > game.time ? "#8dff8a" : boss ? "#ff5a6e" : "#ffd24a";
        ctx.fillRect(e.x - w / 2, top, w * Math.max(0, e.hp / e.maxHp), 3.5);
      }
      // What it is guarded by, always on show: a shield for armor, a gem for ward
      let badgeX = e.x - w / 2 - 6;
      for (const kind of ["armor", "ward"]) {
        if (!def[kind]) continue;
        ctx.fillStyle = GUARD[kind].color;
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (kind === "armor") {
          ctx.moveTo(badgeX - 3.5, top - 2.5);
          ctx.lineTo(badgeX + 3.5, top - 2.5);
          ctx.lineTo(badgeX + 3.5, top + 2);
          ctx.lineTo(badgeX, top + 6);
          ctx.lineTo(badgeX - 3.5, top + 2);
        } else {
          ctx.moveTo(badgeX, top - 3.5);
          ctx.lineTo(badgeX + 3.5, top + 1.5);
          ctx.lineTo(badgeX, top + 6.5);
          ctx.lineTo(badgeX - 3.5, top + 1.5);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        badgeX -= 9;
      }
      // The guard that just turned a hit away, shown round it in its own colour
      const block = blocks[e.id];
      if (block) {
        ctx.globalAlpha = block.life / BLOCK;
        ctx.strokeStyle = GUARD[block.kind].color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y - 4, size * 0.56, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // Stunned: stars going round its head
      if (isStunned) {
        ctx.fillStyle = "#fff36b";
        for (let i = 0; i < 3; i++) {
          const a = now / 160 + (i * Math.PI * 2) / 3;
          const sx = e.x + Math.cos(a) * size * 0.32;
          const sy = top - 5 + Math.sin(a) * 3;
          ctx.beginPath();
          ctx.moveTo(sx, sy - 3.2);
          ctx.lineTo(sx + 1.1, sy - 1.1);
          ctx.lineTo(sx + 3.2, sy);
          ctx.lineTo(sx + 1.1, sy + 1.1);
          ctx.lineTo(sx, sy + 3.2);
          ctx.lineTo(sx - 1.1, sy + 1.1);
          ctx.lineTo(sx - 3.2, sy);
          ctx.lineTo(sx - 1.1, sy - 1.1);
          ctx.fill();
        }
      }
      // Poisoned: bubbles coming off it
      if (e.poisonUntil > game.time) {
        ctx.fillStyle = "#8dff8a";
        for (let i = 0; i < 3; i++) {
          const rise = (now / 700 + i / 3 + e.id * 0.37) % 1;
          ctx.globalAlpha = 1 - rise;
          ctx.beginPath();
          ctx.arc(e.x + (i - 1) * size * 0.24, e.y - size * 0.1 - rise * size * 0.6, 1 + 2 * (1 - rise), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    // Units
    for (const unit of game.units) {
      const c = slotCenter(unit.slot);
      const isCarried = drag?.hasMoved && drag.slot === unit.slot;
      const bump = bumps[unit.slot];
      const moved = bump ? bump.life / BUMP : 0;
      drawUnit(unit.key, c.x + (bump?.x ?? 0) * moved, c.y + (bump?.y ?? 0) * moved, 46 * (1 + moved * 0.1), isCarried ? 0.3 : 1);
      if (unit.stunUntil > game.time) {
        roundRect(c.x - c.w / 2 + 2, c.y - c.h / 2 + 2, c.w - 4, c.h - 4, 9);
        ctx.fillStyle = "rgba(143,227,255,0.45)";
        ctx.fill();
      }
      // A mark in the corner of its slot for each kind of help it is getting
      const got = strength(game, unit);
      let markX = c.x - c.w / 2 + 9.5;
      const markY = c.y - c.h / 2 + 9.5;
      for (const kind in BUFFS) {
        if (!got[kind]) continue;
        ctx.beginPath();
        ctx.arc(markX, markY, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(8,10,12,0.9)";
        ctx.fill();
        ctx.strokeStyle = ctx.fillStyle = BUFFS[kind].color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        if (kind === "near") {
          // An arrow up
          ctx.moveTo(markX, markY - 3.4);
          ctx.lineTo(markX + 3.2, markY + 0.4);
          ctx.lineTo(markX + 1.2, markY + 0.4);
          ctx.lineTo(markX + 1.2, markY + 3.2);
          ctx.lineTo(markX - 1.2, markY + 3.2);
          ctx.lineTo(markX - 1.2, markY + 0.4);
          ctx.lineTo(markX - 3.2, markY + 0.4);
          ctx.fill();
        } else if (kind === "power") {
          // A four-pointed star
          for (let i = 0; i < 8; i++) {
            const r = i % 2 ? 1.3 : 3.8;
            ctx.lineTo(markX + Math.sin((i * Math.PI) / 4) * r, markY - Math.cos((i * Math.PI) / 4) * r);
          }
          ctx.fill();
        } else {
          // Two chevrons: faster
          for (const dx of [-2.6, 0.4]) {
            ctx.moveTo(markX + dx, markY - 2.8);
            ctx.lineTo(markX + dx + 2.6, markY);
            ctx.lineTo(markX + dx, markY + 2.8);
          }
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        markX += 12;
      }
    }

    for (const fx of effects) {
      const t = fx.life / fx.span;
      if (fx.type === "ghost") {
        const size = (ENEMIES[fx.kind] ?? BOSSES[fx.kind]).size * 2.3 * (0.7 + 0.3 * t);
        ctx.globalAlpha = Math.min(1, t * 1.5);
        ctx.save();
        ctx.translate(fx.x, fx.y);
        if (fx.side < 2) ctx.scale(-1, 1);
        ctx.drawImage(images[fx.kind], -size / 2, -size / 2 - 4, size, size);
        ctx.restore();
        continue;
      }
      // Light adds up where shots cross
      ctx.globalCompositeOperation = "lighter";
      if (fx.type === "shot") drawShot(ctx, fx, fx.span - fx.life);
      else if (fx.type === "chain") drawBolt(ctx, fx.x, fx.y, fx.x2, fx.y2, fx.color, t);
      else if (fx.type === "ring") {
        ctx.globalAlpha = t;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius * (1 - t * 0.7), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 3);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    for (const t of texts) {
      // It pops in a size too big, then rises and fades
      const left = t.life / t.span;
      const y = t.y - (1 - left) * 22;
      ctx.globalAlpha = Math.min(1, left * 2.4);
      ctx.font = `900 ${t.size * (1 + Math.max(0, left - 0.8) * 1.5)}px system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText(t.text, t.x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, y);
    }
    ctx.globalAlpha = 1;

    // The unit in hand, and what dropping it here would try for
    if (drag?.hasMoved) {
      drawUnit(drag.key, drag.x, drag.y - 14, 56, 0.9);
      const under = over != null && over !== drag.slot && game.units.find((u) => u.slot === over);
      const odds = MERGE.odds[UNITS[drag.key].tier];
      if (under?.key === drag.key && odds) {
        const next = TIERS[TIERS.indexOf(UNITS[drag.key].tier) + 1];
        ctx.font = "900 13px system-ui, sans-serif";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        const label = `${TIER[next].label} 승급 ${Math.round(odds * 100)}%`;
        ctx.strokeText(label, drag.x, drag.y - 50);
        ctx.fillStyle = TIER_COLOR[next];
        ctx.fillText(label, drag.x, drag.y - 50);
      }
    }

    if (flash) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = flash.life * 0.5;
      ctx.fillStyle = flash.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  function fieldPoint(e) {
    const rect = wrap.getBoundingClientRect();
    return { x: (e.clientX - rect.left - originX) / scale, y: (e.clientY - rect.top - originY) / scale + VIEW.y };
  }

  function slotAt(x, y) {
    for (let slot = 0; slot < SLOTS; slot++) {
      const c = slotCenter(slot);
      if (Math.abs(x - c.x) <= c.w / 2 && Math.abs(y - c.y) <= c.h / 2) return slot;
    }
    return null;
  }

  function onPointerDown(e) {
    if (screen !== "playing" || isPaused || reveal) return;
    const point = fieldPoint(e);
    const slot = slotAt(point.x, point.y);
    const unit = slot != null && game.units.find((u) => u.slot === slot);
    if (!unit) return (info = null);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag = { slot, key: unit.key, ...point, startX: point.x, startY: point.y, hasMoved: false };
  }

  function onPointerMove(e) {
    if (!drag) return;
    const point = fieldPoint(e);
    const hasMoved = drag.hasMoved || Math.hypot(point.x - drag.startX, point.y - drag.startY) > 8;
    drag = { ...drag, ...point, hasMoved };
  }

  function onPointerUp() {
    if (!drag) return;
    const { slot, key, x, y, hasMoved } = drag;
    drag = null;
    if (!hasMoved) return (info = info?.slot === slot ? null : { slot, key });
    const to = slotAt(x, y);
    if (to == null || to === slot) return;
    info = null;
    act(() => moveUnit(game, slot, to));
  }

  // Every move the player makes is saved at once: no pull or merge can be undone by going back
  // to an older save
  function act(move) {
    if (!isMine()) return dropRun();
    handle(move());
    sync();
    saveRun();
  }

  function doSummon() {
    act(() => summon(game));
  }

  function doUpgrade(key) {
    act(() => {
      if (upgrade(game, key)) play(key === "luck" ? "luck" : "anvil");
      return [];
    });
  }

  function doCraft(key) {
    showBook = false;
    act(() => craft(game, key));
  }

  function doSell() {
    const { slot } = info;
    info = null;
    act(() => sell(game, slot));
  }

  function closeReveal() {
    if (!reveal?.isShown) return;
    reveal = null;
    lastTime = performance.now();
  }

  // Keeps the run for later while it is still going, and forgets it once it has ended
  function saveRun() {
    if (!game || !isMine()) return;
    if (game.phase === "playing") localStorage.setItem(saveKey, saveGame(game));
    else localStorage.removeItem(saveKey);
    savedWave = game.phase === "playing" ? game.wave : 0;
  }

  function startGame(saved = null) {
    game = saved ?? createGame();
    hasSentRun = false;
    particles = [];
    effects = [];
    texts = [];
    bumps = {};
    showClear = false;
    hits = {};
    blocks = {};
    told = {};
    shake = 0;
    drag = null;
    info = null;
    reveal = null;
    banner = null;
    isPaused = false;
    hudSign = "";
    screen = "playing";
    localStorage.setItem(ownerKey, runEntry);
    sync();
    sound.resume();
    sound.playMusic(MUSIC);
    if (history.state?.rune !== runEntry) history.pushState({ ...history.state, rune: runEntry }, "");
    // A run picked up again waits for the player
    if (saved) setPaused(true);
    draw();
  }

  // The first run starts from the rules
  function startFresh() {
    if (localStorage.getItem(INTRO_KEY)) return startGame();
    startsAfterRules = true;
    showRules = true;
  }

  function closeRules() {
    showRules = false;
    if (!startsAfterRules) return;
    startsAfterRules = false;
    localStorage.setItem(INTRO_KEY, "1");
    startGame();
  }

  function setPaused(value) {
    if (!value && !isMine()) return dropRun();
    isPaused = value;
    drag = null;
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
    if (!game || history.state?.rune === runEntry) return;
    if (showBook) showBook = false;
    else if (showClear) showClear = false;
    else if (isPaused || screen === "over") return backToTitle();
    else setPaused(true);
    history.pushState({ ...history.state, rune: runEntry }, "");
  }

  function backToTitle() {
    saveRun();
    sendRecord();
    leaveRun();
  }

  // Browsers only let sound start from a tap: this one opens the title and its music
  function enter() {
    if (screen !== "ready") return;
    sound.resume();
    sound.playMusic(MUSIC);
    screen = "start";
  }

  function leaveRun() {
    clearTimeout(revealTimer);
    sound.playMusic(MUSIC);
    // A run dropped while this window is in the background stays quiet until it is looked at again
    if (!document.hidden) sound.resume();
    isPaused = false;
    showBook = false;
    reveal = null;
    drag = null;
    info = null;
    game = null;
    screen = "start";
    draw();
  }

  // Another window has picked this run up: the copy here is out of date and is not saved over it
  function dropRun() {
    toast("다른 창에서 이 판을 이어서 하고 있어요. 이 창의 판은 닫았습니다.", "info");
    leaveRun();
    savedWave = loadGame(localStorage.getItem(saveKey))?.wave ?? 0;
    if (history.state?.rune === runEntry) history.back();
  }

  function onStorage(e) {
    if (e.key === ownerKey && game && screen === "playing") dropRun();
    else if (e.key === saveKey && !game) savedWave = loadGame(e.newValue)?.wave ?? 0;
  }

  // The server keeps each member's furthest wave; a backend from before this game does not know the action
  async function loadRecords() {
    const res = await api.getRuneRecords();
    records = res.success ? res.records : false;
    // A best the server never got (closed tab, failed save) goes up now, once
    const mine = (records || []).find((r) => r.user_name === $currentUser)?.wave ?? 0;
    if (records && localBest > mine && !hasResent) {
      hasResent = true;
      await api.saveRuneRecord(localBest);
      loadRecords();
    }
  }

  // A run is over, by defeat or by leaving: its wave goes to the ranking
  async function sendRecord() {
    if (!game || hasSentRun) return;
    hasSentRun = true;
    await api.saveRuneRecord(game.wave);
    loadRecords();
  }

  async function checkReward() {
    reward = "checking";
    const res = await api.getLedger();
    if (!res.success) return (reward = "error");
    const isClaimed = hasDrawn(res.ledger || [], $currentUser, "rune");
    reward = isClaimed ? "claimed" : "available";
    if (isClaimed) {
      localStorage.removeItem(pendingKey);
      isRewardPending = false;
    }
  }

  function goToReward() {
    saveRun();
    navigate(`${base}/card-pick`, { state: { reward: "rune" } });
  }

  function toggleMute() {
    isMuted = !isMuted;
    sound.setMuted(isMuted);
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      // Coming back to a run in full swing would cost it dearly
      if (screen === "playing") isPaused = true;
      saveRun();
      sound.suspend();
      drag = null;
    } else if (!raf) {
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
      if (!isPaused) sound.resume();
      if (game && screen === "playing" && !isMine()) dropRun();
    }
  }

  onMount(async () => {
    // No pull-to-refresh and no rubber band under the game
    document.documentElement.style.overscrollBehavior = "none";
    checkReward();
    ctx = canvas.getContext("2d");
    sound = createSound(SND, EFFECT_FILES, () => loadedCount++);
    loadRecords();
    try {
      const loaded = await Promise.all(
        IMAGE_FILES.map(async (file) => {
          const image = await loadImage(file);
          loadedCount++;
          return image;
        }),
      );
      images = Object.fromEntries(IMAGE_FILES.map((file, i) => [file, loaded[i]]));
    } catch {
      return (hasFailedToLoad = true);
    }
    // The board gets what the HUD and the buttons leave, which changes from screen to screen
    observer = new ResizeObserver(resize);
    observer.observe(wrap);
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  });

  onDestroy(() => {
    document.documentElement.style.overscrollBehavior = "";
    // Leaving mid-run
    saveRun();
    if (screen === "playing") sendRecord();
    clearTimeout(revealTimer);
    clearTimeout(bannerTimer);
    cancelAnimationFrame(raf);
    observer?.disconnect();
    sound?.close();
  });

  const percent = (value) => `${+(value * 100).toFixed(1)}%`;
  // What a unit gives the rest of the board. Only the strongest of a kind counts, so a second unit
  // of the same sort adds its own attacks and nothing more.
  const GIFTS = ["near", "power", "haste", "chill", "bounty", "income"];
  const twins = (key) => (GIFTS.some((gift) => UNITS[key][gift]) ? game.units.filter((u) => u.key === key).length : 0);

  // What the board adds to a unit in words, and what its attack comes to with all of it
  function helped(unit) {
    const got = strength(game, unit);
    const parts = [];
    if (got.trained) parts.push(`강화 +${Math.round(got.trained * 100)}%`);
    for (const kind in BUFFS) {
      if (got[kind]) parts.push(`${UNITS[BUFFS[kind].giver].name} ${BUFFS[kind].what} +${Math.round(got[kind] * 100)}%`);
    }
    return parts.length ? `▲ 지금 공격력 ${Math.round(got.damage)} · ${got.every.toFixed(2)}초마다 (${parts.join(", ")})` : "";
  }

  const stats = (key) => {
    const unit = UNITS[key];
    return `${unit.type === "phys" ? "물리" : "마법"} ${unit.damage} · ${unit.every}초마다 · 사거리 ${unit.range >= 300 ? "전체" : unit.range}`;
  };
</script>

<svelte:window on:popstate={onBack} on:storage={onStorage} />
<svelte:document on:visibilitychange={onVisibility} />

<div class="absolute inset-0 flex flex-col bg-[#0b120e] text-white select-none overflow-hidden overflow-clip touch-none" role="application" aria-label="룬 가디언">
  <!-- HUD -->
  <div class="relative z-20 flex items-center gap-2 px-3 pt-3 pb-2">
    {#if screen === "playing"}
      <p class="flex-1 min-w-0 text-sm font-black tracking-widest text-amber-200">
        WAVE {hud.wave}{#if !hud.isCleared}<span class="text-[11px] opacity-60"> / {RULES.clearWave}</span>{/if}
      </p>
      <div class="flex items-center gap-1 text-sm font-black text-amber-300">
        <img src="{IMG}/gold.webp" alt="골드" class="w-5 h-5" />
        {hud.gold}
      </div>
      <button
        type="button"
        on:click={() => (speed = speed === 1 ? 2 : 1)}
        aria-label="게임 속도 {speed}배"
        class="w-10 h-10 shrink-0 rounded-full text-xs font-black bg-white/10 border border-white/15 active:scale-90 transition-all {speed === 2 ? 'text-amber-300' : ''}"
      >
        ×{speed}
      </button>
      <button
        type="button"
        on:click={() => setPaused(true)}
        aria-label="일시정지"
        class="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white/10 border border-white/15 active:scale-90 transition-all"
      >
        ⏸
      </button>
    {:else}
      <GameExitButton />
      <div class="flex-1"></div>
    {/if}
    <button
      type="button"
      on:click={toggleMute}
      aria-label={isMuted ? "소리 켜기" : "소리 끄기"}
      class="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white/10 border border-white/15 active:scale-90 transition-all"
    >
      {isMuted ? "🔇" : "🔊"}
    </button>
  </div>
  {#if screen === "playing"}
    <!-- How full the road is: the run ends when it fills -->
    <div
      class="relative z-20 mx-3 mb-2 h-6 rounded-full overflow-hidden bg-black/50 border {danger ? 'border-rose-400' : 'border-white/15'}"
      aria-label="길 위의 적 {hud.count}마리, {RULES.enemyLimit}마리가 되면 패배"
    >
      <div
        class="h-full transition-all {danger ? 'bg-rose-500 animate-pulse' : hud.count >= RULES.enemyLimit / 2 ? 'bg-amber-500' : 'bg-emerald-500'}"
        style="width: {Math.min(100, (hud.count / RULES.enemyLimit) * 100)}%"
      ></div>
      <p class="absolute inset-0 flex items-center justify-between px-3 text-xs font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        <span>👾 적 {hud.count} / {RULES.enemyLimit}</span>
        <span class={danger ? "text-white" : "text-white/70"}>{danger ? "⚠ 곧 가득 찹니다!" : "가득 차면 패배"}</span>
      </p>
    </div>
  {/if}

  <!-- The board -->
  <div
    bind:this={wrap}
    class="relative flex-1 min-h-0 touch-none"
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={onPointerUp}
    on:pointercancel={() => (drag = null)}
  >
    <canvas bind:this={canvas} class="absolute inset-0 w-full h-full"></canvas>
    {#if screen === "playing" && hud.boss}
      <div class="absolute top-1 inset-x-3 pointer-events-none">
        <div class="flex justify-between text-[11px] font-black text-rose-200">
          <span>👑 {hud.boss.name}</span>
          <span class={hud.boss.left <= 15 ? "text-rose-400 animate-pulse" : ""}>⏱ {hud.boss.left}초</span>
        </div>
        <div class="mt-0.5 h-2 rounded-full bg-black/60 overflow-hidden border border-rose-300/40">
          <div class="h-full bg-rose-500" style="width: {hud.boss.hp}%"></div>
        </div>
      </div>
    {/if}
    {#if banner}
      <p
        class="absolute top-10 inset-x-0 text-center text-xl font-black pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] animate-bounce"
        style="color: {banner.color}"
      >
        {banner.text}
      </p>
    {/if}
  </div>

  <!-- Controls -->
  {#if screen === "playing"}
    <div class="relative z-10 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),10px)] space-y-2 bg-black/40">
      <div class="flex gap-2">
        <button
          type="button"
          on:click={doSummon}
          disabled={hud.gold < hud.price || hud.isFull}
          class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-lg text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-[0_0_20px_rgba(168,85,247,0.5)] active:scale-95 transition-all disabled:opacity-40 disabled:shadow-none"
        >
          <img src="{IMG}/crystal.webp" alt="" class="w-7 h-7" />
          {hud.isFull ? "자리 없음" : "소환"}
          <span class="flex items-center gap-0.5 text-sm text-amber-200">
            <img src="{IMG}/gold.webp" alt="" class="w-4 h-4" />{hud.price}
          </span>
        </button>
        <button
          type="button"
          on:click={() => (showBook = true)}
          class="shrink-0 px-4 rounded-2xl text-sm font-black border active:scale-95 transition-all {hud.ready.length
            ? 'text-gray-900 bg-amber-300 border-amber-200 animate-pulse'
            : 'text-amber-100 bg-white/10 border-white/15'}"
        >
          📖 {hud.ready.length ? "조합 가능!" : "도감"}
        </button>
      </div>
      <div class="grid grid-cols-3 gap-2">
        {#each [["phys", "⚔️"], ["magic", "🔮"], ["luck", "🍀"]] as [key, emoji]}
          <button
            type="button"
            on:click={() => doUpgrade(key)}
            disabled={hud.prices[key] == null || hud.gold < hud.prices[key]}
            class="py-2 rounded-xl text-[11px] font-bold bg-white/10 border border-white/15 active:scale-95 transition-all disabled:opacity-40"
          >
            <span class="block text-xs font-black">{emoji} {UPGRADES[key].label} <span class="text-amber-200">Lv{hud.levels[key]}</span></span>
            {#if hud.prices[key] == null}
              <span class="text-gray-300">최대</span>
            {:else}
              <span class="inline-flex items-center gap-0.5 text-amber-200">
                <img src="{IMG}/gold.webp" alt="" class="w-3 h-3" />{hud.prices[key]}
              </span>
            {/if}
          </button>
        {/each}
      </div>
      <p class="text-center text-[10px] text-gray-400">
        소환 확률 ·
        {#each ["rare", "epic", "legendary"] as tier}
          <span style="color: {TIER_COLOR[tier]}">{TIER[tier].label} {percent(hud.odds[tier] ?? 0)}</span>{" "}
        {/each}
      </p>
      {#if info}
        <!-- Over the foot of the board, so that looking at a unit does not resize it -->
        <div
          class="absolute bottom-full inset-x-3 mb-1 flex items-center gap-2 p-2 rounded-2xl bg-[#14181a]/95 border shadow-lg"
          style="border-color: {TIER_COLOR[UNITS[info.key].tier]}"
        >
          <img src="{IMG}/{info.key}.webp" alt="" class="w-11 h-11 shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-black truncate">
              <span style="color: {TIER_COLOR[UNITS[info.key].tier]}">{TIER[UNITS[info.key].tier].label}</span>
              {UNITS[info.key].name}
            </p>
            <p class="text-[11px] text-gray-300">{stats(info.key)}</p>
            <!-- `hud` is named so that an upgrade bought with the card open is counted at once -->
            {#if hud && helped(info)}
              <p class="text-[11px] font-bold" style="color: {BUFFS.near.color}">{helped(info)}</p>
            {/if}
            <p class="text-[11px] text-amber-100">{UNIT_TEXT[info.key]}</p>
            {#if hud && twins(info.key) > 1}
              <p class="text-[11px] font-bold text-rose-300">
                ⚠ {UNITS[info.key].name} {twins(info.key)}명: 위 효과는 한 번만 적용돼요.
              </p>
            {/if}
          </div>
          <button
            type="button"
            on:click={doSell}
            class="shrink-0 px-3 py-2 rounded-xl text-xs font-black text-amber-200 bg-black/40 border border-amber-300/40 active:scale-95 transition-all"
          >
            판매 +{TIER[UNITS[info.key].tier].sell}
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- A legendary or a mythic arrives -->
  {#if reveal}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85" on:click={closeReveal}>
      <div class="relative w-64 h-64 flex items-center justify-center">
        <img
          src="{IMG}/circle.webp"
          alt=""
          class="absolute inset-0 w-full h-full {reveal.isShown ? 'opacity-60' : 'opacity-90'}"
          style="animation: rune-spin {reveal.isShown ? 14 : 1.1}s linear infinite; filter: drop-shadow(0 0 26px {TIER_COLOR[reveal.tier]});"
        />
        {#if reveal.isShown}
          <img
            src="{IMG}/{reveal.key}.webp"
            alt=""
            class="relative w-52 h-52"
            style="animation: rune-pop 0.5s cubic-bezier(0.2, 1.6, 0.4, 1); filter: drop-shadow(0 0 22px {TIER_COLOR[reveal.tier]});"
          />
        {/if}
      </div>
      {#if reveal.isShown}
        <p class="mt-6 text-sm font-black tracking-[0.3em]" style="color: {TIER_COLOR[reveal.tier]}">{reveal.title}</p>
        <h2 class="mt-1 text-4xl font-black" style="color: {TIER_COLOR[reveal.tier]}; text-shadow: 0 0 22px {TIER_COLOR[reveal.tier]}">
          {UNITS[reveal.key].name}
        </h2>
        <p class="mt-3 px-8 text-center text-sm text-gray-200">{UNIT_TEXT[reveal.key]}</p>
        <p class="mt-8 text-xs text-gray-400 animate-pulse">화면을 눌러 계속</p>
      {:else}
        <p class="mt-6 text-lg font-black text-gray-200 animate-pulse">무언가 온다…</p>
      {/if}
    </div>
  {/if}

  <!-- The book: recipes, odds, and what has been met so far -->
  {#if showBook}
    <div class="absolute inset-0 z-30 flex flex-col bg-[#0b0a14]">
      <div class="flex items-center justify-between px-4 pt-4">
        <h2 class="text-xl font-black text-amber-200">
          📖 도감
          {#if game}<span class="ml-1 text-xs font-bold text-gray-400">보는 동안 게임은 멈춰요</span>{/if}
        </h2>
        <button type="button" on:click={() => (showBook = false)} class="px-4 py-2 rounded-xl font-bold bg-white/10 active:scale-95 transition-all">
          닫기
        </button>
      </div>
      <div class="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 pb-6 space-y-5">
        <section>
          <h3 class="mt-3 text-sm font-black" style="color: {TIER_COLOR.mythic}">신화 조합식</h3>
          <p class="text-[11px] text-gray-400">아래 세 유닛이 판 위에 동시에 있으면 만들 수 있어요. 무엇이 나오는지는 만들어 봐야 알아요.</p>
          <div class="mt-2 space-y-2">
            {#each Object.entries(RECIPES) as [key, parts]}
              {@const isKnown = seen.crafted.includes(key)}
              <div class="p-2.5 rounded-2xl bg-white/5 border border-white/10">
                <div class="flex items-center gap-2">
                  <img src="{IMG}/{key}.webp" alt="" class="w-12 h-12 shrink-0" style={isKnown ? "" : "filter: brightness(0) drop-shadow(0 0 3px #ff5f8a)"} />
                  <div class="flex-1 min-w-0">
                    <p class="font-black" style="color: {TIER_COLOR.mythic}">{isKnown ? UNITS[key].name : "???"}</p>
                    {#if isKnown}<p class="text-[11px] text-gray-300">{UNIT_TEXT[key]}</p>{/if}
                  </div>
                  {#if game && hud.ready.includes(key)}
                    <button
                      type="button"
                      on:click={() => doCraft(key)}
                      class="shrink-0 px-3 py-2 rounded-xl text-sm font-black text-gray-900 bg-amber-300 animate-pulse active:scale-95 transition-all"
                    >
                      조합하기
                    </button>
                  {/if}
                </div>
                <div class="mt-2 grid grid-cols-3 gap-1.5">
                  {#each parts as part}
                    {@const isHere = game?.units.some((u) => u.key === part)}
                    <div class="flex items-center gap-1 p-1.5 rounded-xl bg-black/40 border {isHere ? 'border-emerald-400' : 'border-white/10'}">
                      <img src="{IMG}/{part}.webp" alt="" class="w-7 h-7 shrink-0" />
                      <span class="min-w-0 text-[10px] font-bold leading-tight" style="color: {TIER_COLOR[UNITS[part].tier]}">
                        <span class="block text-[9px] opacity-70">{TIER[UNITS[part].tier].label}</span>
                        {UNITS[part].name}{isHere ? " ✓" : ""}
                      </span>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </section>
        <section>
          <h3 class="text-sm font-black text-amber-200">확률</h3>
          <ul class="mt-1 text-xs text-gray-200 space-y-1 bg-white/5 border border-white/10 rounded-2xl p-3">
            <li>
              소환:
              {#each Object.entries(hud.odds) as [tier, odds]}
                <span style="color: {TIER_COLOR[tier]}">{TIER[tier].label} {percent(odds)}</span>{" "}
              {/each}
            </li>
            <li>일반 2개 → 희귀 {percent(MERGE.odds.common)} ({percent(MERGE.jackpot)} 확률로 영웅)</li>
            <li>희귀 2개 → 영웅 {percent(MERGE.odds.rare)} · 실패하면 다른 희귀 1개</li>
            <li>영웅 2개 → 전설 {percent(MERGE.odds.epic)} · 실패하면 희귀 1개</li>
            <li>소환 값은 {RULES.summonCost[1]}번 뽑을 때마다 1골드씩 올라요.</li>
          </ul>
        </section>
        <section>
          <h3 class="text-sm font-black text-amber-200">만나 본 적</h3>
          <div class="mt-1 space-y-1.5">
            {#each [...Object.keys(ENEMIES), ...Object.keys(BOSSES)].filter((key) => seen.enemies.includes(key)) as key}
              <div class="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                <img src="{IMG}/{key}.webp" alt="" class="w-9 h-9 shrink-0" />
                <p class="text-xs">
                  <span class="font-black">{(ENEMIES[key] ?? BOSSES[key]).name}</span>
                  <span class="text-gray-300"> · {ENEMY_TEXT[key]}</span>
                </p>
              </div>
            {:else}
              <p class="text-xs text-gray-400">아직 없어요.</p>
            {/each}
          </div>
        </section>
        <section>
          <h3 class="text-sm font-black text-amber-200">얻어 본 유닛 {seen.units.length}/{Object.keys(UNITS).length}</h3>
          <div class="mt-1 space-y-1.5">
            {#each Object.keys(UNITS).filter((key) => seen.units.includes(key)) as key}
              <div class="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                <img src="{IMG}/{key}.webp" alt="" class="w-9 h-9 shrink-0" />
                <div class="min-w-0 text-xs">
                  <p class="font-black" style="color: {TIER_COLOR[UNITS[key].tier]}">{TIER[UNITS[key].tier].label} · {UNITS[key].name}</p>
                  <p class="text-gray-300">{stats(key)} · {UNIT_TEXT[key]}</p>
                </div>
              </div>
            {/each}
          </div>
        </section>
      </div>
    </div>
  {/if}

  {#if screen === "playing" && isPaused && !showClear}
    <div class="absolute inset-0 z-30 flex p-5 overflow-y-auto overscroll-contain touch-pan-y bg-black/75">
      <div class="w-full max-w-xs m-auto text-center">
        <h2 class="text-3xl font-black text-amber-200">일시정지</h2>
        <p class="mt-2 text-sm text-gray-300">{hud.wave}웨이브 진행 중</p>
        <button
          type="button"
          on:click={() => setPaused(false)}
          class="mt-6 w-full py-4 rounded-2xl font-black text-lg text-gray-900 bg-amber-300 active:scale-95 transition-all"
        >
          계속하기
        </button>
        <button
          type="button"
          on:click={() => (showRules = true)}
          class="mt-3 w-full py-3 rounded-2xl font-bold text-gray-200 bg-white/10 active:scale-95 transition-all"
        >
          게임 방법
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

  {#if screen === "playing" && showClear}
    <div class="absolute inset-0 z-30 flex p-5 overflow-y-auto overscroll-contain touch-pan-y bg-black/85">
      <div class="w-full max-w-xs m-auto text-center">
        <p class="text-[11px] font-black tracking-[0.4em] text-amber-200">WAVE {RULES.clearWave}</p>
        <h2 class="mt-1 text-5xl font-black text-amber-200" style="animation: rune-glow 2.6s ease-in-out infinite">CLEAR!</h2>
        <p class="mt-3 text-gray-200">마왕을 쓰러뜨리고 네 보스를 모두 물리쳤습니다.</p>
        {#if reward === "checking"}
          <p class="mt-6 text-sm text-gray-300 animate-pulse">보상 확인 중...</p>
        {:else if reward === "available"}
          <p class="mt-4 text-xs text-gray-300">카드는 한 번만 뽑을 수 있고, 뽑은 금액은 장부에 기록돼요. 이 판은 저장되니 뽑고 와서 이어할 수 있어요.</p>
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
          <button type="button" on:click={checkReward} class="mt-3 w-full py-3 rounded-2xl font-bold bg-white/10 border border-white/20 active:scale-95 transition-all">
            다시 확인
          </button>
        {/if}
        <button
          type="button"
          on:click={() => {
            showClear = false;
            lastTime = performance.now();
          }}
          class="mt-3 w-full py-3 rounded-2xl font-bold text-gray-200 bg-white/10 active:scale-95 transition-all"
        >
          계속 도전하기 (랭킹)
        </button>
      </div>
    </div>
  {/if}

  {#if screen === "over"}
    <div class="absolute inset-0 z-30 flex p-5 overflow-y-auto overscroll-contain touch-pan-y bg-black/80">
      <div class="w-full max-w-xs m-auto text-center">
        <h2 class="text-4xl font-black text-rose-400">GAME OVER</h2>
        <p class="mt-3 text-gray-300">
          <strong class="text-white">{hud.wave}웨이브</strong>에서
          {game?.lostTo === "boss" ? "보스를 제한 시간 안에 잡지 못했습니다." : "길이 적으로 가득 찼습니다."}
        </p>
        <div class="mt-4"><Ranking {ranking} {records} {localBest} me={$currentUser} /></div>
        <button
          type="button"
          on:click={() => startGame()}
          class="mt-6 w-full py-4 rounded-2xl font-black text-lg text-gray-900 bg-amber-300 active:scale-95 transition-all"
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
      </div>
    </div>
  {/if}

  <!-- Title screen: key art with the title in its dark upper third. First the loading bar,
       then one tap to come in, then the buttons. -->
  {#if screen === "loading" || screen === "ready" || screen === "start"}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="absolute inset-0 z-10 flex justify-center bg-[#0b0a14]" on:click={enter}>
      <div class="relative h-full aspect-[9/16] max-w-full overflow-hidden">
        <img
          src="{IMG}/title.webp"
          alt=""
          class="absolute inset-0 w-full h-full object-cover object-bottom transition-all duration-700 {screen === 'start' ? '' : 'brightness-50 scale-105'}"
        />
        <div class="absolute inset-x-0 top-[9%] px-5 text-center" style="animation: rune-rise 0.9s ease-out">
          <p class="text-[11px] font-black tracking-[0.4em] text-amber-200">RANDOM DEFENSE</p>
          <h1 class="mt-2 text-5xl font-black text-amber-100" style="animation: rune-glow 2.6s ease-in-out infinite">룬 가디언</h1>
          <p class="mt-3 text-sm text-gray-200">뽑고, 합치고, 끝까지 버텨라</p>
          {#if screen === "start" && localBest}
            <p class="mt-3 inline-block px-3 py-1.5 rounded-full text-xs font-bold text-amber-200 bg-black/50 border border-amber-300/40">
              내 최고 기록 {localBest}웨이브
            </p>
          {/if}
          {#if screen === "start"}
            <p class="mt-2 text-xs font-bold text-gray-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              🏆 {RULES.clearWave}웨이브 마왕을 쓰러뜨리면 클리어
              {#if reward === "claimed"}
                <br />🎁 클리어 보상은 이미 받았어요
              {:else if reward === "available"}
                <br />🎁 첫 클리어 보상: 용돈 카드뽑기 1회
              {/if}
            </p>
          {/if}
        </div>
        <div class="absolute inset-x-0 bottom-0 px-5 pt-10 pb-[max(env(safe-area-inset-bottom),16px)] bg-gradient-to-t from-black/90 to-transparent">
          {#if hasFailedToLoad}
            <div class="max-w-xs mx-auto pb-6 text-center">
              <p class="text-sm text-rose-200">게임을 불러오지 못했습니다. 연결을 확인해 주세요.</p>
              <button
                type="button"
                on:click={() => location.reload()}
                class="mt-3 w-full py-3 rounded-2xl font-black text-gray-900 bg-amber-300 active:scale-95 transition-all"
              >
                다시 시도
              </button>
            </div>
          {:else if screen === "loading"}
            <div class="max-w-xs mx-auto pb-6" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round((loadedCount / TOTAL) * 100)}>
              <p class="text-center text-xs text-gray-200">💡 {tip}</p>
              <div class="mt-3 h-3.5 rounded-full bg-black/70 border border-amber-200/40 overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-yellow-100 shadow-[0_0_12px_rgba(255,178,62,0.9)] transition-[width] duration-200"
                  style="width: {(loadedCount / TOTAL) * 100}%"
                ></div>
              </div>
              <div class="mt-1.5 flex justify-between text-[11px] font-bold text-amber-100">
                <span>{loadedCount < IMAGE_FILES.length ? "그림을" : "소리를"} 불러오는 중…</span>
                <span>{Math.round((loadedCount / TOTAL) * 100)}%</span>
              </div>
            </div>
          {:else if screen === "ready"}
            <div class="max-w-xs mx-auto pb-8 text-center">
              <p class="text-xl font-black text-amber-100 animate-pulse drop-shadow-[0_0_12px_rgba(255,178,62,0.9)]">화면을 눌러 시작</p>
            </div>
          {:else}
          <div class="max-w-xs mx-auto space-y-2" style="animation: rune-rise 0.5s ease-out">
              {#if isRewardPending && reward === "available"}
                <button
                  type="button"
                  on:click={goToReward}
                  class="w-full py-3 rounded-2xl font-black text-white bg-gradient-to-r from-amber-500 to-rose-500 active:scale-95 transition-all"
                >
                  🎁 클리어 보상: 용돈 카드 뽑으러 가기
                </button>
              {/if}
              {#if savedWave}
                <button
                  type="button"
                  on:click={() => startGame(loadGame(localStorage.getItem(saveKey)))}
                  class="w-full py-4 rounded-2xl font-black text-lg text-gray-900 bg-amber-300 active:scale-95 transition-all shadow-[0_0_24px_rgba(255,178,62,0.6)]"
                >
                  ▶ 이어하기 <span class="text-sm font-bold opacity-70">· {savedWave}웨이브</span>
                </button>
              {/if}
              <button
                type="button"
                on:click={startFresh}
                class="w-full rounded-2xl font-black active:scale-95 transition-all {savedWave
                  ? 'py-3 text-gray-200 bg-black/60 border border-white/20'
                  : 'py-4 text-lg text-gray-900 bg-amber-300 shadow-[0_0_24px_rgba(255,178,62,0.6)]'}"
              >
                {savedWave ? "새로 시작" : "게임 시작"}
              </button>
              <div class="flex">
                <button type="button" on:click={() => (showRules = true)} class="flex-1 py-2 text-sm font-bold text-gray-200 active:scale-95 transition-all">
                  게임 방법
                </button>
                <button type="button" on:click={() => (showBook = true)} class="flex-1 py-2 text-sm font-bold text-gray-200 active:scale-95 transition-all">
                  📖 도감
                </button>
                <button type="button" on:click={() => (showRanking = true)} class="flex-1 py-2 text-sm font-bold text-amber-200 active:scale-95 transition-all">
                  🏆 랭킹
                </button>
              </div>
          </div>
          {/if}
          <p class="mt-1 text-center text-[9px] text-gray-400">그림: AI 생성(Google Gemini) · 소리: Pixabay</p>
        </div>
      </div>
    </div>
  {/if}

  {#if showRanking}
    <div class="absolute inset-0 z-30 flex p-5 overflow-y-auto overscroll-contain touch-pan-y bg-black/85">
      <div class="w-full max-w-xs m-auto text-center">
        <h2 class="text-xl font-black text-amber-200">🏆 가족 랭킹</h2>
        <div class="mt-4"><Ranking {ranking} {records} {localBest} me={$currentUser} /></div>
        <button type="button" on:click={() => (showRanking = false)} class="mt-4 w-full py-3 rounded-2xl font-bold bg-white/10 active:scale-95 transition-all">
          닫기
        </button>
      </div>
    </div>
  {/if}

  {#if showRules}
    <div class="absolute inset-0 z-40 flex p-5 overflow-y-auto overscroll-contain touch-pan-y bg-black/90">
      <div class="w-full max-w-xs m-auto">
        <h2 class="text-xl font-black text-amber-200 text-center">게임 방법</h2>
        <ul class="mt-4 space-y-2 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-2xl p-4">
          <li>🔮 골드로 유닛을 <b>소환</b>해요. 어떤 등급이 나올지는 운이에요.</li>
          <li>✋ 유닛을 끌어서 옮기고, <b>같은 유닛 위에 놓으면 조합</b>을 시도해요. 윗등급일수록 실패할 수 있어요.</li>
          <li>👑 <b>신화</b>는 뽑기로 안 나와요. 📖 도감에 적힌 세 유닛을 판에 모으면 조합할 수 있어요.</li>
          <li>⚔️ 물리는 중갑에, 마법은 마법저항에 막혀요. 적 머리 위 <b>회색 방패</b>가 중갑, <b>보라 보석</b>이 마법저항이에요.</li>
          <li>👾 적은 길을 계속 돌아요. <b>{RULES.enemyLimit}마리</b>가 쌓이거나, 보스를 <b>{RULES.bossSeconds}초</b> 안에 못 잡으면 끝이에요.</li>
          <li>👆 유닛을 누르면 사거리와 능력이 보여요.</li>
          <li>
            ✨ 유닛 칸 왼쪽 위의 동그란 표식은 <b>받고 있는 버프</b>예요: 금색 ↑ 성기사(둘레 8칸), 분홍 ✦ 대천사, 하늘색 » 발키리. 성기사 둘레의 금색 칸에 놓으면 버프를 받아요. <b>같은 버프는 겹치지 않고</b>(성기사가 둘이어도 +25%), 종류가 다르면 함께 적용돼요.
          </li>
          <li>🏆 <b>{RULES.clearWave}웨이브의 마왕</b>을 쓰러뜨리면 클리어! 첫 클리어에는 용돈 카드뽑기 1회를 드려요. 그 뒤로도 랭킹을 위해 계속할 수 있어요.</li>
        </ul>
        <button type="button" on:click={closeRules} class="mt-4 w-full py-3 rounded-2xl font-black text-gray-900 bg-amber-300 active:scale-95 transition-all">
          {startsAfterRules ? "시작하기" : "닫기"}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  @keyframes -global-rune-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes -global-rune-rise {
    from {
      transform: translateY(14px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  @keyframes -global-rune-glow {
    0%,
    100% {
      text-shadow: 0 0 18px rgba(255, 178, 62, 0.7);
    }
    50% {
      text-shadow: 0 0 34px rgba(255, 178, 62, 1), 0 0 60px rgba(255, 120, 40, 0.6);
    }
  }
  @keyframes -global-rune-pop {
    from {
      transform: scale(0.2);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
