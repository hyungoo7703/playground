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

// Per-wave growth applied to every enemy
export const HP_GROWTH = 0.2;
export const SPEED_GROWTH = 0.045;

// Each group: [type, count, seconds between spawns, delay before the group starts]
export const WAVES = [
  [["drone", 10, 1.1, 0]],
  [["drone", 11, 0.9, 0], ["dart", 6, 1.3, 3]],
  [["drone", 14, 0.8, 0], ["carrier", 4, 2.4, 2]],
  [["dart", 14, 0.7, 0], ["drone", 11, 0.9, 2]],
  [["tank", 3, 5, 0], ["drone", 16, 0.7, 1], ["dart", 8, 1.1, 4]],
  [["carrier", 8, 1.8, 0], ["dart", 14, 0.8, 2]],
  [["tank", 4, 4, 0], ["carrier", 6, 2.2, 2], ["drone", 20, 0.6, 1]],
  [["dart", 24, 0.5, 0], ["tank", 3, 5, 3], ["drone", 14, 0.8, 2]],
  [["tank", 5, 3.2, 0], ["carrier", 8, 1.6, 1], ["dart", 20, 0.6, 3], ["drone", 20, 0.6, 0]],
  "boss",
];

// A phase applies while the boss HP fraction is at or below `below`
export const BOSS = {
  hp: 1300,
  radius: 62,
  y: 150,
  warn: 3,
  phases: [
    { below: 1, speed: 38, shellEvery: 1.5, shells: 1, addEvery: 4, add: "drone" },
    { below: 0.66, speed: 50, shellEvery: 1.1, shells: 2, addEvery: 2.8, add: "dart" },
    { below: 0.33, speed: 70, shellEvery: 0.8, shells: 3, addEvery: 2.2, add: "dart" },
  ],
};

export const UPGRADES = {
  damage: { label: "화력 강화", desc: "공격력 +1", icon: "💥", max: 5 },
  rate: { label: "연사 강화", desc: "발사 간격 18% 단축", icon: "⚡", max: 5 },
  pierce: { label: "관통탄", desc: "탄이 적을 하나 더 관통", icon: "🎯", max: 3 },
  multi: { label: "다연장", desc: "한 번에 쏘는 탄 +1", icon: "🔱", max: 2 },
  shield: { label: "방어막", desc: "적 침투 2회 무효", icon: "🛡️", max: 3 },
  bounty: { label: "현상금", desc: "코인 획득 +50%", icon: "🪙", max: 2 },
};
export const RATE_STEP = 0.82;
export const SHIELD_CHARGES = 2;
export const BOUNTY_STEP = 0.5;
