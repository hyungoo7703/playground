import { base } from '../../store.js';

export const ASSET_PATH = `${base}/images/neon/survival`;
export const SOUND_PATH = `${base}/sounds/neon/survival`;

export const IMAGES = {
    hero: `${ASSET_PATH}/hero.png`,
    mobs: `${ASSET_PATH}/mobs.png`,
    boss: `${ASSET_PATH}/boss.png`,
    boss2: `${ASSET_PATH}/boss2.png`,
    items: `${ASSET_PATH}/EXPgems-and-coin.png`,
    main: `${ASSET_PATH}/main.png`,
    bg: `${ASSET_PATH}/background.png`,
    special: `${ASSET_PATH}/special_ability_icon.png`,
};

export const SOUNDS = {
    bgm: `${SOUND_PATH}/retro-color-moon.mp3`,
    zap: `${SOUND_PATH}/laser-zap.mp3`,
    punch: `${SOUND_PATH}/punch.mp3`,
    coin: `${SOUND_PATH}/drop-coin.mp3`,
    levelup: `${SOUND_PATH}/level-up.mp3`,
    warning: `${SOUND_PATH}/beep-warning.mp3`,
    explosion: `${SOUND_PATH}/epic-cinematic-explosion.mp3`,
};

export const WEAPONS = [
    // --- Common (80%) ---
    { id: "blaster_blue", name: "기본 블래스터", rarity: "common", color: "#00ffff", shape: "circle", weight: 80, stats: { damage: 10 } },
    { id: "blaster_red", name: "루비 레이저", rarity: "common", color: "#ff0000", shape: "circle", weight: 80, stats: { damage: 12 } },
    { id: "blaster_green", name: "에메랄드 샷", rarity: "common", color: "#00ff00", shape: "circle", weight: 80, stats: { damage: 10, speed: 1.2 } },

    // --- Rare (15%) ---
    { id: "plasma_rect", name: "플라즈마 커터", rarity: "rare", color: "#cyan", shape: "rect", weight: 15, stats: { damage: 15, pierce: 1 } },
    { id: "gold_bullet", name: "황금 탄환", rarity: "rare", color: "#ffd700", shape: "circle", style: "outline", weight: 15, stats: { damage: 20 } },

    // --- Epic (4.8%) ---
    { id: "shuriken", name: "닌자 수리검", rarity: "epic", color: "#cccccc", shape: "star", weight: 4.8, stats: { damage: 25, pierce: 2, size: 1.5 } },
    { id: "fireball", name: "화염구", rarity: "epic", color: "#ff4500", shape: "fireball", weight: 4.8, stats: { damage: 30, size: 2.0 } },

    // --- Legendary (0.2%) ---
    { id: "moonblade", name: "달빛 검기", rarity: "legendary", color: "#e0e0ff", shape: "moon", weight: 0.2, stats: { damage: 50, pierce: 3, size: 2.5 } },
    { id: "void_orb", name: "공허의 구체", rarity: "legendary", color: "#8a2be2", shape: "void", weight: 0.2, stats: { damage: 40, pierce: 5, size: 1.5, speed: 0.5 } },
];

export const SHOP_ITEMS = [
    { id: "hp", name: "최대 체력", cost: 200, icon: "❤️" },
    { id: "speed", name: "이동 속도", cost: 300, icon: "⚡" },
    { id: "magnet", name: "자석 범위", cost: 250, icon: "🧲" },
    { id: "damage", name: "기본 공격력", cost: 500, icon: "⚔️" },
];

// In-Game Level Up Options
export const IN_GAME_UPGRADES = [
    { id: "multishot", name: "멀티샷", description: "발사체가 1개 증가합니다.", icon: "🏹", type: "weapon" },
    { id: "damage", name: "공격력 강화", description: "공격력이 20% 증가합니다.", icon: "⚔️", type: "stat" },
    { id: "speed", name: "신속", description: "이동 속도가 10% 증가합니다.", icon: "👟", type: "stat" },
    { id: "pierce", name: "관통", description: "발사체가 적을 1명 더 관통합니다.", icon: "🎯", type: "weapon" },
    { id: "fireRate", name: "연사력", description: "공격 속도가 15% 빨라집니다.", icon: "⚡", type: "weapon" },
    { id: "magnet", name: "자석", description: "아이템 획득 범위가 증가합니다.", icon: "🧲", type: "stat" },
    { id: "heal", name: "응급 처치", description: "체력을 30 회복합니다.", icon: "❤️", type: "heal" },
];

export const EXP_GEMS = [
    { color: "green", value: 5, frame: 0 },
    { color: "blue", value: 15, frame: 1 },
    { color: "purple", value: 50, frame: 2 },
];

export const ULTIMATE_MAX = 100;

export function getUpgradeCost(baseCost, level) {
    // Inflation: Cost increases by 20% per level (1.2^level)
    return Math.floor(baseCost * Math.pow(1.2, level));
}
