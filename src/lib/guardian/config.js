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
};

// Enemy HP multiplier at wave index w (0-based): 1 + linear*w + square*w*w.
// Gentle at first so the early upgrades get used, steep at the end.
export const HP_GROWTH = { linear: 0.08, square: 0.0235 };
export const SPEED_GROWTH = 0.045;

// What an elite enemy gets on top of its type's numbers
export const ELITE = { hp: 3, speed: 1.1, size: 1.25, coins: 3, leak: 1 };

// Each group: [type, count, seconds between spawns, delay before the group starts, elite?].
// A string is a boss wave, naming an entry of BOSSES.
export const WAVES = [
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

// A phase applies while the boss HP fraction is at or below `below`
export const BOSSES = {
  midboss: {
    hp: 360,
    radius: 46,
    y: 136,
    warn: 2.5,
    phases: [
      { below: 1, speed: 44, shellEvery: 1.9, shells: 1, addEvery: 5, add: "drone" },
      { below: 0.5, speed: 60, shellEvery: 1.5, shells: 2, addEvery: 4, add: "drone" },
    ],
  },
  boss: {
    hp: 2300,
    radius: 62,
    y: 150,
    warn: 3,
    phases: [
      { below: 1, speed: 38, shellEvery: 1.5, shells: 1, addEvery: 4, add: "drone" },
      { below: 0.66, speed: 50, shellEvery: 1.1, shells: 2, addEvery: 2.8, add: "dart" },
      { below: 0.33, speed: 70, shellEvery: 0.8, shells: 3, addEvery: 2.2, add: "dart" },
    ],
  },
};

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

// How often a card of each rarity is offered
export const RARITY = {
  common: { label: "일반", weight: 6 },
  rare: { label: "희귀", weight: 3 },
  epic: { label: "전설", weight: 1 },
};

// desc(level) says what taking the card gives when it is currently at `level`
export const UPGRADES = {
  damage: { label: "고출력 탄", icon: "💥", rarity: "common", max: 5, desc: (lv) => `공격력 ${1 + lv} → ${2 + lv}` },
  rate: { label: "속사", icon: "⚡", rarity: "common", max: 5, desc: () => "발사 속도 22% 증가" },
  shield: { label: "보호막", icon: "🛡️", rarity: "common", max: 3, desc: () => `기지로 들어온 적을 ${SHIELD_CHARGES}번 막아 줌` },
  bounty: { label: "코인 부스터", icon: "🪙", rarity: "common", max: 2, desc: () => "코인을 50% 더 얻음" },
  multi: { label: "다중 포신", icon: "🔱", rarity: "rare", max: 2, desc: (lv) => `한 번에 ${lv + 2}발 발사` },
  pierce: { label: "관통탄", icon: "🎯", rarity: "rare", max: 3, desc: (lv) => `탄이 적 ${lv + 1}기를 뚫고 지나감` },
  cryo: { label: "냉각탄", icon: "❄️", rarity: "rare", max: 2, desc: (lv) => `맞은 적이 ${CRYO_SECONDS}초간 ${CRYO_SLOW_PCT[lv]}% 느려짐` },
  blast: { label: "폭발탄", icon: "🧨", rarity: "rare", max: 2, desc: (lv) => (lv ? "폭발 범위가 넓어짐" : "맞은 자리가 폭발해 주변 적도 피해") },
  chain: { label: "연쇄 번개", icon: "🌩️", rarity: "epic", max: 2, desc: (lv) => `맞은 적 근처 ${lv + 1}기에게 번개가 튐` },
  crit: { label: "과충전", icon: "🔆", rarity: "epic", max: 2, desc: (lv) => `${CRIT_EVERY[lv]}발마다 ${CRIT_MULT}배 피해 강화탄` },
};
