// Every balance number for Neon Guardian lives here.

export const FIELD = { w: 360, h: 640, baseY: 588, turretX: 180, turretY: 602 };

export const PLAYER = {
  hp: 8,
  fireInterval: 0.36,
  bulletSpeed: 560,
  damage: 1,
  spread: 0.12, // rad between bullets of a multi-shot
  aimLimit: 1.35, // rad either side of straight up
  bombCost: 25,
  bombCostStep: 15,
  bombDamage: 10,
  bombBossDamage: 40,
};

// leak = base HP lost when the enemy gets through
export const ENEMIES = {
  drone: { hp: 3, speed: 40, radius: 17, leak: 1, coins: 1 },
  dart: { hp: 2, speed: 115, radius: 13, leak: 1, coins: 2, sway: 70, swayRate: 2.8 },
  tank: { hp: 26, speed: 20, radius: 25, leak: 3, coins: 5 },
  carrier: { hp: 10, speed: 30, radius: 21, leak: 2, coins: 3, split: 2 },
  mini: { hp: 2, speed: 70, radius: 10, leak: 1, coins: 1 },
  shell: { hp: 2, speed: 95, radius: 8, leak: 2, coins: 0 },
  // Halves the damage taken by every other enemy within `aura`
  shielder: { hp: 14, speed: 26, radius: 20, leak: 2, coins: 4, aura: 78 },
  // Jumps sideways by a distance in `blink` every `blinkEvery` seconds
  blinker: { hp: 5, speed: 60, radius: 14, leak: 1, coins: 3, blinkEvery: 1.5, blink: [55, 110] },
  // Stops somewhere in `holdY` and shells the base until it is shot down
  artillery: { hp: 16, speed: 55, radius: 22, leak: 0, coins: 5, holdY: [80, 170], shellEvery: 3.2 },
  // Dying, it deals boomRatio × its full HP to everything within `boom`
  bomber: { hp: 7, speed: 48, radius: 16, leak: 3, coins: 3, boom: 72, boomRatio: 1.2 },
  // Launches a mini every `spawnEvery` seconds until it is shot down
  hive: { hp: 60, speed: 16, radius: 28, leak: 4, coins: 8, spawnEvery: 2.2 },
  // Nothing can hit it during every other `phaseEvery` seconds
  phaser: { hp: 9, speed: 50, radius: 15, leak: 2, coins: 4, phaseEvery: 1.4 },
  // Gives every other enemy within `heal` back healRate of its full HP per second
  mender: { hp: 12, speed: 30, radius: 18, leak: 2, coins: 5, heal: 90, healRate: 0.1 },
  // Circles its boss, which takes no damage while one is up. Its HP comes from the boss.
  generator: { hp: 1, speed: 0, radius: 15, leak: 0, coins: 0, orbitX: 104, orbitY: 58, turn: 1.1 },
  // Circles the Titan; while one is up the automatic weapons do not fire. HP from the boss.
  seal: { hp: 1, speed: 0, radius: 15, leak: 0, coins: 0, orbitX: 118, orbitY: 66, turn: -1.4 },
  // A copy of the Titan that looks and shoots like it. HP from the boss.
  decoy: { hp: 1, speed: 40, radius: 68, leak: 0, coins: 0, shellEvery: 2.4 },
};
export const GUARD_RATIO = 0.5;

// What an elite enemy gets on top of its type's numbers
export const ELITE = { hp: 3, speed: 1.1, size: 1.25, coins: 3, leak: 1 };

// Each group: [type, count, seconds between spawns, delay before the group starts, elite?].
// A string is a boss wave, naming an entry of BOSSES.
const NORMAL_WAVES = [
  [["drone", 8, 1.3, 0]],
  [["drone", 9, 1.1, 0], ["dart", 4, 1.6, 4]],
  [["drone", 12, 0.9, 0], ["carrier", 3, 2.8, 3]],
  [["dart", 10, 0.85, 0], ["drone", 10, 1.0, 2]],
  [["tank", 2, 6, 0], ["drone", 14, 0.8, 1], ["dart", 8, 1.2, 4]],
  [["carrier", 8, 1.8, 0], ["dart", 14, 0.8, 2]],
  [["tank", 4, 4, 0], ["carrier", 6, 2.2, 2], ["drone", 20, 0.6, 1]],
  "midboss",
  [["dart", 24, 0.5, 0], ["tank", 3, 5, 3], ["drone", 16, 0.75, 2]],
  [["tank", 5, 3.2, 0], ["carrier", 8, 1.6, 1], ["drone", 22, 0.55, 0]],
  [["drone", 3, 4, 0, true], ["dart", 26, 0.45, 1], ["carrier", 8, 1.6, 2]],
  [["tank", 6, 2.8, 0], ["dart", 4, 3, 2, true], ["drone", 26, 0.5, 1]],
  [["carrier", 4, 3, 0, true], ["tank", 4, 4, 2], ["dart", 28, 0.42, 1], ["drone", 20, 0.6, 3]],
  [["tank", 3, 5, 0, true], ["carrier", 10, 1.4, 1], ["dart", 30, 0.4, 2], ["drone", 28, 0.45, 0]],
  "boss",
];

const HARD_WAVES = [
  [["drone", 10, 1.0, 0], ["dart", 4, 1.6, 4]],
  [["drone", 12, 0.9, 0], ["carrier", 3, 2.6, 3]],
  [["dart", 10, 0.85, 0], ["drone", 10, 1.0, 2]],
  [["tank", 2, 6, 0], ["drone", 14, 0.8, 1], ["dart", 8, 1.2, 4], ["bomber", 2, 6, 5]],
  [["carrier", 8, 1.8, 0], ["dart", 12, 0.8, 2], ["bomber", 3, 4, 3]],
  [["blinker", 6, 2.2, 0], ["drone", 18, 0.65, 1], ["tank", 2, 6, 3]],
  [["tank", 4, 4, 0], ["carrier", 6, 2.2, 2], ["drone", 20, 0.6, 1], ["blinker", 5, 2.5, 4]],
  "midboss",
  [["dart", 22, 0.5, 0], ["shielder", 2, 7, 2], ["drone", 16, 0.75, 2]],
  [["tank", 5, 3.2, 0], ["carrier", 8, 1.6, 1], ["drone", 20, 0.55, 0], ["bomber", 5, 3, 2]],
  [["artillery", 2, 8, 0], ["dart", 24, 0.45, 1], ["carrier", 8, 1.6, 2]],
  [["shielder", 3, 5, 0], ["tank", 5, 3, 1], ["drone", 26, 0.5, 1], ["blinker", 8, 1.8, 3]],
  [["carrier", 4, 3, 0, true], ["artillery", 2, 9, 2], ["dart", 26, 0.42, 1], ["bomber", 6, 2.6, 3]],
  [["tank", 3, 5, 0, true], ["shielder", 3, 5, 2], ["carrier", 10, 1.4, 1], ["dart", 28, 0.4, 2], ["drone", 24, 0.45, 0]],
  "boss",
  [["blinker", 14, 1.1, 0], ["drone", 30, 0.42, 0], ["artillery", 2, 8, 3]],
  [["tank", 6, 2.6, 0], ["shielder", 3, 5, 1], ["bomber", 8, 2, 2], ["dart", 24, 0.42, 1]],
  [["carrier", 12, 1.2, 0], ["blinker", 10, 1.4, 2], ["artillery", 3, 6, 1], ["drone", 24, 0.45, 3]],
  [["drone", 4, 3, 0, true], ["shielder", 4, 4, 1], ["tank", 6, 2.6, 2], ["dart", 30, 0.38, 0]],
  [["bomber", 12, 1.4, 0], ["carrier", 10, 1.3, 1], ["artillery", 3, 6, 2], ["blinker", 12, 1.2, 3]],
  [["tank", 2, 6, 0, true], ["shielder", 4, 4, 1], ["dart", 32, 0.36, 1], ["drone", 30, 0.4, 0]],
  [["artillery", 4, 5, 0], ["blinker", 6, 2, 1, true], ["carrier", 12, 1.2, 1], ["bomber", 10, 1.6, 2], ["drone", 26, 0.42, 3]],
  "warlord",
  [["shielder", 5, 3.5, 0], ["tank", 8, 2.2, 1], ["dart", 34, 0.34, 0], ["blinker", 12, 1.2, 2]],
  [["carrier", 6, 2.2, 0, true], ["artillery", 4, 5, 1], ["bomber", 12, 1.4, 2], ["drone", 34, 0.36, 0]],
  [["tank", 3, 5, 0, true], ["shielder", 4, 4, 1], ["blinker", 16, 1.0, 1], ["dart", 34, 0.34, 2]],
  [["artillery", 5, 4, 0], ["bomber", 6, 2.4, 1, true], ["carrier", 14, 1.1, 1], ["drone", 36, 0.34, 0], ["tank", 5, 3.2, 3]],
  [["shielder", 3, 5, 0, true], ["tank", 8, 2.2, 1], ["dart", 36, 0.32, 0], ["blinker", 16, 1.0, 2], ["bomber", 10, 1.6, 3]],
  [["artillery", 5, 4, 0], ["tank", 4, 4, 1, true], ["shielder", 5, 3.5, 2], ["carrier", 14, 1.0, 1], ["dart", 36, 0.32, 2], ["drone", 36, 0.34, 0], ["blinker", 12, 1.3, 4]],
  "final",
];

// Enemy HP multiplier at wave index w (0-based): base + linear*w + square*w² + cubic*w³, gentle
// at first so the early upgrades get used, steep at the end. Speed grows by speedGrowth
// per wave. pace multiplies every spawn time of the wave table. bossHp scales every boss;
// repair is the base HP given back for a boss kill. bombScales makes the bomb grow with
// the enemies so it still clears a screen late on.
// Endless mode has no wave table: ENDLESS below builds each wave. Its HP multiplier is
// further multiplied by late.rate for every wave past late.from, so no build keeps up
// for ever, and it alone has the coin shop (hasShop) and the freeze skill (hasFreeze).
export const MODES = {
  normal: {
    waves: NORMAL_WAVES,
    hpGrowth: { base: 1, linear: 0.08, square: 0.0235, cubic: 0 },
    speedGrowth: 0.045,
    pace: 1,
    bossHp: 1,
    repair: 0,
    bombScales: false,
  },
  hard: {
    waves: HARD_WAVES,
    hpGrowth: { base: 1, linear: 0.11, square: 0, cubic: 0.0018 },
    speedGrowth: 0.028,
    pace: 0.9,
    bossHp: 1,
    repair: 2,
    bombScales: true,
  },
  endless: {
    hpGrowth: { base: 1, linear: 0.11, square: 0, cubic: 0.0018, late: { from: 30, rate: 1.04 } },
    speedGrowth: 0.028,
    pace: 0.9,
    bossHp: 1,
    repair: 2,
    bombScales: true,
    hasShop: true,
    hasFreeze: true,
  },
};
export const SPEED_CAP = 2; // enemies never get faster than this multiple of their own speed

// An endless wave spends budget points (base + perWave * wave, up to max) on a few of the
// enemy types open by then (`from` is a wave number), spread over `seconds`. Every
// bossEvery-th wave is a boss: the listed ones in turn, then the last two alternating.
// A boss's HP is its own times bossHp, and past the list it grows as the enemies have
// since its first visit.
export const ENDLESS = {
  budget: { base: 10, perWave: 8.5, max: 300 },
  seconds: { base: 14, perWave: 0.3, max: 24 },
  bossEvery: 10,
  bosses: ["midboss", "boss", "warlord", "final", "titan"],
  bossHp: [1.5, 2.3, 2.4, 1.7, 1],
  returnEscorts: ["phaser", "mender"], // a returning boss also calls these in
  eliteFrom: 12,
  eliteChance: 0.012, // per wave past eliteFrom, up to eliteMax
  eliteMax: 0.4,
  eliteCost: 2.5,
  types: {
    drone: { from: 1, cost: 1 },
    dart: { from: 2, cost: 1.3 },
    carrier: { from: 3, cost: 3 },
    tank: { from: 5, cost: 6 },
    bomber: { from: 6, cost: 3 },
    blinker: { from: 8, cost: 2 },
    shielder: { from: 11, cost: 5 },
    artillery: { from: 13, cost: 6 },
    hive: { from: 50, cost: 14 },
    phaser: { from: 50, cost: 3 },
    mender: { from: 50, cost: 6 },
  },
};

// Endless mode's coin sinks: [first price, added after each purchase]
export const SHOP = { repair: [40, 25], shield: [30, 15], extra: [60, 40] };
export const FREEZE = { cost: 35, costStep: 20, seconds: 3 };

// A phase applies while the boss HP fraction is at or below `below`; `add` lists the
// escorts it calls in. `generators` are put up on entering the phase and make the boss
// immune until they are shot down. In a phase with `chargeEvery` the boss stops to charge
// its main gun: dealing `need` of its full HP in `seconds` breaks the charge and stuns it,
// otherwise the base takes `damage`.
export const BOSSES = {
  midboss: {
    hp: 360,
    radius: 46,
    y: 136,
    warn: 2.5,
    phases: [
      { below: 1, speed: 44, shellEvery: 1.9, shells: 1, addEvery: 5, add: ["drone"] },
      { below: 0.5, speed: 60, shellEvery: 1.5, shells: 2, addEvery: 4, add: ["drone"] },
    ],
  },
  boss: {
    hp: 2300,
    radius: 62,
    y: 150,
    warn: 3,
    phases: [
      { below: 1, speed: 38, shellEvery: 1.5, shells: 1, addEvery: 4, add: ["drone"] },
      { below: 0.66, speed: 50, shellEvery: 1.1, shells: 2, addEvery: 2.8, add: ["dart"] },
      { below: 0.33, speed: 70, shellEvery: 0.8, shells: 3, addEvery: 2.2, add: ["dart"] },
    ],
  },
  warlord: {
    hp: 7500,
    radius: 56,
    y: 162,
    warn: 3,
    generatorHp: 1000,
    phases: [
      { below: 1, speed: 46, shellEvery: 1.3, shells: 2, addEvery: 3.2, add: ["blinker", "dart"], generators: 2 },
      { below: 0.6, speed: 58, shellEvery: 1.0, shells: 2, addEvery: 2.6, add: ["bomber", "dart"] },
      { below: 0.3, speed: 74, shellEvery: 0.8, shells: 3, addEvery: 2.2, add: ["blinker", "bomber"], generators: 2 },
    ],
  },
  final: {
    hp: 66000,
    radius: 70,
    y: 186,
    warn: 4,
    generatorHp: 2500,
    charge: { seconds: 3.2, need: 0.025, damage: 2, stun: 2.5, stunDamage: 1.5 },
    phases: [
      { below: 1, speed: 34, shellEvery: 1.4, shells: 2, addEvery: 3.4, add: ["drone", "dart"], generators: 2 },
      { below: 0.75, speed: 46, shellEvery: 0.9, shells: 3, addEvery: 2.4, add: ["dart", "blinker"] },
      { below: 0.5, speed: 40, shellEvery: 1.2, shells: 2, addEvery: 2.8, add: ["bomber", "dart"], generators: 3, chargeEvery: 8 },
      { below: 0.25, speed: 66, shellEvery: 0.75, shells: 4, addEvery: 2, add: ["blinker", "bomber", "dart"], chargeEvery: 6 },
    ],
  },
  // The Void Titan, an endless-only boss. A phase with wellEvery drops gravity wells that
  // bend the player's bullets towards them, somewhere in well.x and well.y; with decoyEvery
  // it splits into copies that many seconds after the last one is gone, the copies and
  // itself taking the places in decoyX at random; sealEvery does the same for its seals.
  titan: {
    hp: 300000,
    radius: 68,
    y: 186,
    warn: 4,
    well: { seconds: 5, radius: 150, pull: 1500, x: [60, 300], y: [280, 430] },
    decoys: 2,
    decoyHp: 0.012, // of the Titan's full HP
    decoyX: [70, 180, 290],
    seals: 3,
    sealHp: 0.006,
    phases: [
      { below: 1, speed: 36, shellEvery: 1.3, shells: 2, addEvery: 3, add: ["phaser", "dart"], wellEvery: 7 },
      { below: 0.66, speed: 44, shellEvery: 1.1, shells: 2, addEvery: 2.6, add: ["mender", "blinker"], wellEvery: 7, decoyEvery: 14 },
      { below: 0.33, speed: 52, shellEvery: 0.9, shells: 3, addEvery: 2.2, add: ["phaser", "bomber"], wellEvery: 6, decoyEvery: 12, sealEvery: 15 },
    ],
  },
};
// Seconds from a boss settling in to its first use of each attack
export const BOSS_OPENING = { shellT: 2, addT: 3, wellT: 3, decoyT: 2, sealT: 2 };

export const RATE_STEP = 0.82; // fire interval multiplier per level
export const SHIELD_CHARGES = 2;
export const BOUNTY_STEP = 0.5;
export const CRYO_SLOW_PCT = [35, 50]; // by level
export const CRYO_SECONDS = 2;
export const BLAST_RADIUS = [38, 54]; // by level
export const BLAST_RATIO = 0.4; // share of the bullet damage dealt to enemies caught in the blast
export const CHAIN_RANGE = 120;
export const CHAIN_RATIO = 0.6;
export const CRIT_EVERY = [4, 3]; // every Nth shot, by level
export const CRIT_MULT = 3;
export const REROLL_COST = 10;
export const REROLL_STEP = 10;

// Mythic weapons. Damage numbers multiply what one bullet deals.
export const DRONE_COUNT = [2, 3]; // by level
export const DRONE_EVERY = 0.3; // seconds between the shots of one drone
export const DRONE_RATIO = 0.6;
export const LASER_EVERY = [5, 3.5];
export const LASER_MULT = [20, 32];
export const LASER_WIDTH = 10;
export const MISSILE_EVERY = [2.4, 1.6];
export const MISSILE_MULT = 12;
export const MISSILE_RADIUS = 50;
export const MISSILE_SPEED = 300;
export const VORTEX_EVERY = [9, 6.5];
export const VORTEX_SECONDS = 2.6;
export const VORTEX_RADIUS = 92;
export const VORTEX_PULL = 110; // px per second towards the centre
export const VORTEX_REACH = 300; // how far the orb flies before it opens by itself
export const VORTEX_TICK = [0.4, 2]; // seconds between ticks, damage multiplier per tick

// Evolutions
export const FAN_EXTRA = 2; // more bullets per shot
export const RAIL_SPEED = 1.4;
export const CLUSTER = { count: 3, offset: 0.9, radius: 0.7 }; // extra blasts around the first, relative to its radius
export const TEMPEST_JUMPS = 4;
export const TEMPEST_RANGE = 1.3;

// Transcendent weapons
export const STRIKE_EVERY = [6, 4]; // by level
export const STRIKE_MULT = [40, 60];
export const STRIKE_RADIUS = 85;
export const STRIKE_DELAY = 0.7; // seconds between the marker and the hit
export const CHRONO_PACE = [0.85, 0.72]; // enemy speed multiplier, by level

// Repeatable cards
export const HASTE_STEP = 0.94; // fire interval multiplier per level
export const MEND_HP = 2;
export const CACHE_COINS = 40;

// The better cards are only offered once this many waves are cleared
export const UNLOCK_WAVE = 15;
export const TRANSCEND_WAVE = 45; // a few picks ahead of the Titan at wave 50
export const REPEAT_WAVE = 30;

// How often a card of each rarity is offered, and from how many cleared waves.
// Repeatable cards have no top level and only exist where a run has no end.
export const RARITY = {
  common: { label: "일반", weight: 6 },
  rare: { label: "희귀", weight: 3 },
  epic: { label: "전설", weight: 1 },
  mythic: { label: "신화", weight: 3, from: UNLOCK_WAVE },
  evo: { label: "진화", weight: 4, from: UNLOCK_WAVE },
  transcend: { label: "초월", weight: 4, from: TRANSCEND_WAVE },
  repeat: { label: "반복", weight: 2, from: REPEAT_WAVE, isEndlessOnly: true },
};

// desc(level) says what taking the card gives when it is currently at `level`.
// An evolution is offered once the card named by `needs` is at its maximum.
export const UPGRADES = {
  damage: { label: "고출력 탄", icon: "💥", rarity: "common", max: 5, desc: (lv) => `공격력 ${1 + lv} → ${2 + lv}` },
  rate: { label: "속사", icon: "⚡", rarity: "common", max: 5, desc: () => "발사 속도 22% 증가" },
  shield: { label: "보호막", icon: "🛡️", rarity: "common", max: 3, desc: () => `기지로 들어온 적을 ${SHIELD_CHARGES}번 막아 줌` },
  bounty: { label: "코인 부스터", image: "coin.webp", rarity: "common", max: 2, desc: () => "코인을 50% 더 얻음" },
  multi: { label: "다중 포신", icon: "🔱", rarity: "rare", max: 2, desc: (lv) => `한 번에 ${lv + 2}발 발사` },
  pierce: { label: "관통탄", icon: "🎯", rarity: "rare", max: 3, desc: (lv) => `탄이 적 ${lv + 1}기를 뚫고 지나감` },
  cryo: { label: "냉각탄", icon: "❄️", rarity: "rare", max: 2, desc: (lv) => `맞은 적이 ${CRYO_SECONDS}초간 ${CRYO_SLOW_PCT[lv]}% 느려짐` },
  blast: { label: "폭발탄", icon: "🧨", rarity: "rare", max: 2, desc: (lv) => (lv ? "폭발 범위가 넓어짐" : "맞은 자리가 폭발해 주변 적도 피해") },
  chain: { label: "연쇄 번개", icon: "🌩️", rarity: "epic", max: 2, desc: (lv) => `맞은 적 근처 ${lv + 1}기에게 번개가 튐` },
  crit: { label: "과충전", icon: "🔆", rarity: "epic", max: 2, desc: (lv) => `${CRIT_EVERY[lv]}발마다 ${CRIT_MULT}배 피해 강화탄` },
  drones: { label: "궤도 드론", icon: "🛰️", rarity: "mythic", max: 2, desc: (lv) => `드론 ${DRONE_COUNT[lv]}기가 포탑을 돌며 자동 사격` },
  laser: { label: "프리즘 레이저", icon: "🌈", rarity: "mythic", max: 2, desc: (lv) => `${LASER_EVERY[lv]}초마다 조준선 위의 적을 모두 꿰뚫는 광선` },
  missile: { label: "유도 미사일", icon: "🚀", rarity: "mythic", max: 2, desc: (lv) => (lv ? "미사일을 더 자주 발사" : "기지에 가장 가까운 적을 쫓아가 폭발") },
  vortex: { label: "블랙홀탄", icon: "🌀", rarity: "mythic", max: 2, desc: (lv) => (lv ? "블랙홀을 더 자주 발사" : "적을 한곳으로 끌어모아 묶어 둠") },
  fan: { label: "스톰 캐넌", icon: "🌪️", rarity: "evo", max: 1, needs: "multi", desc: () => `다중 포신 진화: 한 번에 ${3 + FAN_EXTRA}발 발사` },
  rail: { label: "레일건", icon: "☄️", rarity: "evo", max: 1, needs: "pierce", desc: () => "관통탄 진화: 모든 적을 뚫고 탄이 빨라짐" },
  cluster: { label: "집속탄", icon: "🎆", rarity: "evo", max: 1, needs: "blast", desc: () => `폭발탄 진화: 주변에서 ${CLUSTER.count}번 더 폭발` },
  tempest: { label: "번개 폭풍", icon: "⛈️", rarity: "evo", max: 1, needs: "chain", desc: () => `연쇄 번개 진화: 번개가 ${2 + TEMPEST_JUMPS}기까지 튐` },
  strike: { label: "위성 포격", icon: "📡", rarity: "transcend", max: 2, desc: (lv) => `${STRIKE_EVERY[lv]}초마다 적이 가장 몰린 곳에 대형 포격` },
  twin: { label: "쌍둥이 포탑", icon: "♊", rarity: "transcend", max: 1, desc: () => "조준 반대편으로도 같은 탄을 동시에 발사" },
  chrono: { label: "시간 왜곡", icon: "⏳", rarity: "transcend", max: 2, desc: (lv) => `모든 적이 항상 ${Math.round((1 - CHRONO_PACE[lv]) * 100)}% 느려짐` },
  power: { label: "출력 증폭", icon: "🔋", rarity: "repeat", max: Infinity, desc: () => "공격력 +1" },
  haste: { label: "가속 장치", icon: "⏩", rarity: "repeat", max: 12, desc: () => `발사 속도 ${Math.round((1 / HASTE_STEP - 1) * 100)}% 증가` },
  mend: { label: "응급 수리", icon: "🔧", rarity: "repeat", max: Infinity, desc: () => `기지 체력 ${MEND_HP} 즉시 회복` },
  cache: { label: "코인 상자", image: "coin.webp", rarity: "repeat", max: Infinity, desc: () => `코인 ${CACHE_COINS}개 획득` },
};
