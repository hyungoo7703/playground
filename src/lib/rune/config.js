// Every balance number for Rune Guardian lives here.

export const FIELD = { w: 360, h: 640 };
// The road is the outline of this rectangle, walked clockwise from its top-left corner
export const TRACK = { left: 30, right: 330, top: 104, bottom: 470, width: 44 };
// Unit slots fill the inside of the road, numbered row by row from the top-left
export const GRID = { cols: 5, rows: 5 };

export const RULES = {
  startGold: 100,
  summonCost: [20, 3], // the first price, and one gold more for every this many summons made
  enemyLimit: 60, // this many on the road and the run is over
  dangerAt: 0.75, // share of the limit from which the alarm is on
  waveSeconds: 28, // the next wave comes after this long, cleared or not
  spawnSeconds: 14, // a wave's enemies come in over this long
  breather: 2.5, // pause before the next wave when the road is cleared early
  waveGold: [20, 2], // for each wave survived: base, per wave number
  bossEvery: 10,
  clearWave: 40, // beating this wave's boss wins the game; the run then goes on for the ranking
  bossSeconds: 60, // a boss still alive after this long ends the run
  bossWarn: 3,
  bossGold: [150, 10],
};

// Enemy HP multiplier at wave `n` (1 = the first)
export const GROWTH = { rate: 1.15 };

// odds: chance of a summon being of this tier, the rest being common. luck: added per luck level.
export const TIERS = ["common", "rare", "epic", "legendary", "mythic"];
export const TIER = {
  common: { label: "일반", sell: 8 },
  rare: { label: "희귀", odds: 0.2, luck: 0.03, sell: 20 },
  epic: { label: "영웅", odds: 0.045, luck: 0.01, sell: 55 },
  legendary: { label: "전설", odds: 0.005, luck: 0.002, sell: 160 },
  mythic: { label: "신화", sell: 450 }, // never summoned: made from a recipe
};
// Two of the same unit try for one random unit of the next tier, at these odds. When it fails,
// one random other unit is left: of the same tier, or of the tier below after two epics.
// Two commons now and then (jackpot) skip a tier.
export const MERGE = { odds: { common: 1, rare: 0.5, epic: 0.15 }, jackpot: 0.03 };

// What gold buys besides summons: [first price, added per level bought, most levels]
export const UPGRADES = {
  phys: { label: "물리 강화", price: [40, 25, 99], bonus: 0.12 }, // damage of physical units per level
  magic: { label: "마법 강화", price: [40, 25, 99], bonus: 0.12 },
  luck: { label: "행운", price: [80, 80, 6] },
};

// damage per hit, seconds between hits, reach in px from the unit's slot.
// type: phys is cut by armor, magic by ward.
// Extras, all optional:
//   crit [chance, multiplier]      stun [chance, seconds]        multi: targets per attack
//   splash: radius around the hit  slow [share of speed, seconds] chain: jumps to nearby enemies
//   poison [share of full HP per second, seconds, the same for a boss]
//   target: "strongest" | "crowd" (default: whoever has walked furthest)
//   pierce: ignores armor and ward
//   near: damage bonus for the units in the slots around it
//   Felt by the whole board, and not stacked by a second copy:
//   haste (attack speed), power (damage), chill (enemy speed), bounty (gold per kill),
//   income (gold per wave), stop [every seconds, for seconds]
export const UNITS = {
  swordsman: { name: "검사", tier: "common", type: "phys", damage: 8, every: 0.6, range: 82 },
  archer: { name: "궁수", tier: "common", type: "phys", damage: 9, every: 0.9, range: 150 },
  apprentice: { name: "견습 마법사", tier: "common", type: "magic", damage: 12, every: 1.2, range: 130 },
  rogue: { name: "도적", tier: "common", type: "phys", damage: 4, every: 0.32, range: 86, crit: [0.15, 3] },

  knight: { name: "기사", tier: "rare", type: "phys", damage: 30, every: 0.8, range: 88, stun: [0.15, 0.7] },
  ranger: { name: "레인저", tier: "rare", type: "phys", damage: 13, every: 0.9, range: 165, multi: 3 },
  pyromancer: { name: "화염술사", tier: "rare", type: "magic", damage: 20, every: 1.3, range: 135, splash: 42 },
  cryomancer: { name: "빙결술사", tier: "rare", type: "magic", damage: 15, every: 1.0, range: 135, splash: 30, slow: [0.3, 1.5] },

  paladin: { name: "성기사", tier: "epic", type: "phys", damage: 70, every: 0.9, range: 92, near: 0.25 },
  sniper: { name: "엘프 저격수", tier: "epic", type: "phys", damage: 250, every: 2.2, range: 400, pierce: true, target: "strongest" },
  stormcaller: { name: "폭풍술사", tier: "epic", type: "magic", damage: 42, every: 1.0, range: 140, chain: 5 },
  druid: { name: "드루이드", tier: "epic", type: "magic", damage: 30, every: 1.5, range: 140, poison: [0.04, 4, 0.006] },

  dragonknight: { name: "용기사", tier: "legendary", type: "phys", damage: 210, every: 1.0, range: 115, splash: 60 },
  archmage: { name: "대마법사", tier: "legendary", type: "magic", damage: 480, every: 2.5, range: 400, splash: 70, target: "crowd" },
  valkyrie: { name: "발키리", tier: "legendary", type: "phys", damage: 170, every: 0.6, range: 125, haste: 0.15 },
  alchemist: { name: "연금술사", tier: "legendary", type: "magic", damage: 110, every: 1.0, range: 140, splash: 40, bounty: 1 },

  elderdragon: { name: "고룡", tier: "mythic", type: "magic", damage: 1100, every: 1.2, range: 170, splash: 85 },
  chronomancer: { name: "시간의 현자", tier: "mythic", type: "magic", damage: 600, every: 1.0, range: 400, chill: 0.35, stop: [12, 2] },
  seraph: { name: "대천사", tier: "mythic", type: "phys", damage: 850, every: 0.7, range: 180, pierce: true, power: 0.4 },
  worldtree: { name: "세계수의 수호자", tier: "mythic", type: "magic", damage: 650, every: 1.0, range: 400, multi: 6, income: 50 },
};

// A mythic takes one legendary, one epic and one rare, all on the board at once
export const RECIPES = {
  elderdragon: ["dragonknight", "stormcaller", "pyromancer"],
  chronomancer: ["archmage", "druid", "cryomancer"],
  seraph: ["valkyrie", "paladin", "knight"],
  worldtree: ["alchemist", "sniper", "ranger"],
};

// cost: what one of them takes out of a wave's budget. from: the first wave it can come in.
// armor / ward: share of physical / magic damage it shrugs off.
export const ENEMIES = {
  slime: { name: "슬라임", hp: 30, speed: 45, size: 15, gold: 1, cost: 1, from: 1 },
  goblin: { name: "고블린", hp: 18, speed: 85, size: 14, gold: 1, cost: 1, from: 2 },
  bat: { name: "박쥐", hp: 10, speed: 100, size: 12, gold: 0.5, cost: 0.5, from: 4 },
  orc: { name: "오크 중갑병", hp: 90, speed: 38, size: 18, gold: 3, cost: 3, from: 6, armor: 0.6 },
  wraith: { name: "망령", hp: 60, speed: 55, size: 16, gold: 3, cost: 3, from: 8, ward: 0.6 },
  // Gives every other enemy within `heal` back healRate of its full HP per second
  shaman: { name: "주술사", hp: 70, speed: 42, size: 16, gold: 4, cost: 4, from: 12, heal: 70, healRate: 0.04 },
  golem: { name: "골렘", hp: 600, speed: 28, size: 23, gold: 12, cost: 12, from: 15, armor: 0.3, ward: 0.3 },
  // Not part of any budget: runs `laps` times round and is gone, with its gold, unless it is caught
  thief: { name: "보물 고블린", hp: 130, speed: 95, size: 17, gold: 0, laps: 1.5 },
};
export const WAVE = { budget: [14, 2.2], kinds: [1, 3] }; // budget: base, per wave number
export const THIEF = { from: 5, chance: 0.18, gold: [40, 4] }; // gold: base, per wave number

// hp is at wave 1 and grows like everything else. A boss shrugs off stuns and the time stop,
// and feels only `slowed` of any slow.
export const BOSSES = {
  ogre: { name: "오우거 왕", hp: 1000, speed: 30, size: 34, armor: 0.3, enrage: [0.5, 1.8] }, // below this share of HP: speed ×
  lich: { name: "리치", hp: 1100, speed: 30, size: 32, ward: 0.5, freeze: [6, 3, 3] }, // every s, units, for s
  hydra: { name: "히드라", hp: 1500, speed: 28, size: 36, regen: 0.012 }, // share of full HP per second
  demon: { name: "마왕", hp: 1700, speed: 30, size: 38, armor: 0.4, ward: 0.4, summon: [7, 5, "bat"] }, // every s, count, what
};
export const BOSS_ORDER = ["ogre", "lich", "hydra", "demon"];
export const BOSS = { slowed: 0.4, escorts: 0.5 }; // escorts: share of a normal wave's budget that comes along
