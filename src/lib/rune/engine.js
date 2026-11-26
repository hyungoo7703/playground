// Rune Guardian rules. No DOM in here: the screen feeds it time and taps, and draws what it returns.
import { TRACK, GRID, RULES, GROWTH, TIERS, TIER, MERGE, UPGRADES, UNITS, RECIPES, ENEMIES, WAVE, THIEF, BOSSES, BOSS_ORDER, BOSS } from "./config.js";

// Bump when a change to the state or the units would break a run saved before it
const SAVE_VERSION = 1;
const CHAIN_REACH = 75;
const CHAIN_FADE = 0.7; // damage kept from one jump to the next

const SIDE_X = TRACK.right - TRACK.left;
const SIDE_Y = TRACK.bottom - TRACK.top;
const LAP = 2 * (SIDE_X + SIDE_Y);
const SLOTS = GRID.cols * GRID.rows;
const BY_TIER = Object.fromEntries(TIERS.map((tier) => [tier, Object.keys(UNITS).filter((key) => UNITS[key].tier === tier)]));

// mulberry32, with its position kept in the state so that a saved run carries on with the same dice:
// closing the app on a bad pull brings the same pull back
function addDice(state) {
  state.rand = () => {
    state.seed = (state.seed + 0x6d2b79f5) >>> 0;
    let t = state.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return state;
}

const pick = (state, list) => list[Math.floor(state.rand() * list.length)];

/** Where something that has walked `dist` along the road is. */
export function trackPoint(dist) {
  let d = ((dist % LAP) + LAP) % LAP;
  if (d < SIDE_X) return { x: TRACK.left + d, y: TRACK.top, side: 0 };
  d -= SIDE_X;
  if (d < SIDE_Y) return { x: TRACK.right, y: TRACK.top + d, side: 1 };
  d -= SIDE_Y;
  if (d < SIDE_X) return { x: TRACK.right - d, y: TRACK.bottom, side: 2 };
  return { x: TRACK.left, y: TRACK.bottom - (d - SIDE_X), side: 3 };
}

/** The middle of unit slot `slot`. */
export function slotCenter(slot) {
  const x0 = TRACK.left + TRACK.width / 2;
  const y0 = TRACK.top + TRACK.width / 2;
  const w = (SIDE_X - TRACK.width) / GRID.cols;
  const h = (SIDE_Y - TRACK.width) / GRID.rows;
  return { x: x0 + ((slot % GRID.cols) + 0.5) * w, y: y0 + (Math.floor(slot / GRID.cols) + 0.5) * h, w, h };
}

export function createGame(seed = Date.now()) {
  const state = addDice({
    seed: seed >>> 0,
    phase: "playing", // playing | over
    lostTo: null, // "crowd" | "boss"
    wave: 0, // the wave being fought, 1 = the first
    time: 0,
    waveTime: 0,
    gold: RULES.startGold,
    levels: Object.fromEntries(Object.keys(UPGRADES).map((key) => [key, 0])),
    units: [], // { id, key, slot, wait, stunUntil }
    enemies: [],
    queue: [],
    bossDeadline: 0, // when the boss on the road wins, 0 without one
    bossWarn: 0,
    stopUntil: 0, // the time stop
    stopT: 0,
    summons: 0,
    nextId: 1,
  });
  startWave(state, []);
  return state;
}

/** A run as text, to carry on with later. */
export function saveGame(state) {
  return JSON.stringify({ version: SAVE_VERSION, state }, (key, value) => (key === "rand" ? undefined : value));
}

/** The run `saveGame` wrote, or null when the text is not one this version can carry on with. */
export function loadGame(text) {
  try {
    const { version, state } = JSON.parse(text);
    return version === SAVE_VERSION ? addDice(state) : null;
  } catch {
    return null;
  }
}

const growth = (wave) => GROWTH.rate ** (wave - 1);
const isBossWave = (wave) => wave % RULES.bossEvery === 0;
const hasUnit = (state, key) => state.units.some((u) => u.key === key);
// The strongest of a board-wide effect among the units present
const boardWide = (state, effect) => state.units.reduce((most, u) => Math.max(most, UNITS[u.key][effect] ?? 0), 0);

/** The price of the next level of an upgrade, or null when there is none left. */
export function upgradePrice(state, key) {
  const [first, step, max] = UPGRADES[key].price;
  return state.levels[key] < max ? first + step * state.levels[key] : null;
}

/** What the next summon costs. */
export function summonPrice(state) {
  const [first, every] = RULES.summonCost;
  return first + Math.floor(state.summons / every);
}

/** The chance of each tier coming out of a summon right now. */
export function summonOdds(state) {
  const odds = {};
  let rest = 1;
  for (const tier of TIERS) {
    if (TIER[tier].odds == null) continue;
    odds[tier] = TIER[tier].odds + TIER[tier].luck * state.levels.luck;
    rest -= odds[tier];
  }
  return { common: rest, ...odds };
}

/** The recipes whose three units are all on the board. */
export function readyRecipes(state) {
  return Object.keys(RECIPES).filter((key) => RECIPES[key].every((part) => hasUnit(state, part)));
}

function spawn(state, type, extra) {
  const def = ENEMIES[type] ?? BOSSES[type];
  const hp = Math.round(def.hp * growth(state.wave));
  const enemy = { id: state.nextId++, type, dist: 0, hp, maxHp: hp, slowUntil: 0, slow: 1, stunUntil: 0, poisonUntil: 0, poison: 0, ...trackPoint(0), ...extra };
  state.enemies.push(enemy);
  return enemy;
}

// What a normal wave is made of: one to three kinds sharing the budget
function buildQueue(state, budget) {
  const open = Object.keys(ENEMIES).filter((type) => ENEMIES[type].from <= state.wave);
  const kinds = [];
  const [least, most] = WAVE.kinds;
  for (let n = Math.min(open.length, least + Math.floor(state.rand() * (most - least + 1))); n > 0; n--) {
    kinds.push(open.splice(Math.floor(state.rand() * open.length), 1)[0]);
  }
  const queue = [];
  for (const type of kinds) {
    const count = Math.max(1, Math.round(budget / kinds.length / ENEMIES[type].cost));
    const start = state.rand() * 3;
    for (let i = 0; i < count; i++) queue.push({ t: start + (i * (RULES.spawnSeconds - start)) / count, type });
  }
  return queue.sort((a, b) => a.t - b.t);
}

function startWave(state, events) {
  if (state.wave > 0) {
    const [base, perWave] = RULES.waveGold;
    state.gold += base + perWave * state.wave + boardWide(state, "income");
  }
  state.wave++;
  state.waveTime = 0;
  const budget = WAVE.budget[0] + WAVE.budget[1] * state.wave;
  if (isBossWave(state.wave)) {
    state.bossWarn = RULES.bossWarn;
    state.queue = buildQueue(state, budget * BOSS.escorts).map((entry) => ({ ...entry, t: entry.t + RULES.bossWarn }));
    events.push({ type: "bossWarn" });
  } else {
    state.queue = buildQueue(state, budget);
    if (state.wave >= THIEF.from && state.rand() < THIEF.chance) {
      state.queue.push({ t: 2 + state.rand() * 8, type: "thief" });
      state.queue.sort((a, b) => a.t - b.t);
    }
  }
  events.push({ type: "wave", wave: state.wave });
}

function gainGold(state, amount, x, y, events) {
  if (!amount) return;
  state.gold += amount;
  events.push({ type: "gold", amount, x, y });
}

// Damage to one enemy, after its armor or ward
function hurt(state, enemy, amount, unit, events) {
  if (enemy.dead) return;
  const def = ENEMIES[enemy.type] ?? BOSSES[enemy.type];
  const guard = unit.pierce ? 0 : ((unit.type === "phys" ? def.armor : def.ward) ?? 0);
  enemy.hp -= amount * (1 - guard);
  if (unit.slow && !enemy.dead) {
    enemy.slow = 1 - unit.slow[0] * (BOSSES[enemy.type] ? BOSS.slowed : 1);
    enemy.slowUntil = state.time + unit.slow[1];
  }
  if (unit.stun && !BOSSES[enemy.type] && state.rand() < unit.stun[0]) enemy.stunUntil = state.time + unit.stun[1];
  if (unit.poison) {
    enemy.poison = unit.poison[BOSSES[enemy.type] ? 2 : 0];
    enemy.poisonUntil = state.time + unit.poison[1];
  }
  if (enemy.hp <= 0) kill(state, enemy, events);
}

function kill(state, enemy, events) {
  enemy.dead = true;
  const boss = BOSSES[enemy.type];
  let gold = ENEMIES[enemy.type]?.gold ?? 0;
  if (enemy.type === "thief") gold = THIEF.gold[0] + THIEF.gold[1] * state.wave;
  else if (boss) gold = RULES.bossGold[0] + RULES.bossGold[1] * state.wave;
  else gold += boardWide(state, "bounty");
  events.push({ type: boss ? "bossDead" : enemy.type === "thief" ? "thiefCaught" : "kill", kind: enemy.type, x: enemy.x, y: enemy.y });
  gainGold(state, gold, enemy.x, enemy.y, events);
  if (boss) state.bossDeadline = 0;
}

const near = (a, b, reach) => Math.hypot(a.x - b.x, a.y - b.y) <= reach;

// A unit whose wait is over hits whatever its kind of attack reaches
function attack(state, unit, events) {
  const def = UNITS[unit.key];
  const from = slotCenter(unit.slot);
  const inReach = state.enemies.filter((e) => !e.dead && near(e, from, def.range));
  if (!inReach.length) return false;

  if (def.target === "strongest") inReach.sort((a, b) => b.hp - a.hp);
  else if (def.target === "crowd") {
    const company = (e) => state.enemies.filter((o) => !o.dead && near(o, e, def.splash)).length;
    inReach.sort((a, b) => company(b) - company(a));
  } else inReach.sort((a, b) => b.dist - a.dist);

  // Its own level of training, the board-wide blessing, and a paladin in a slot next to it
  const col = unit.slot % GRID.cols;
  const row = Math.floor(unit.slot / GRID.cols);
  const blessing = state.units.reduce((most, other) => {
    const reach = UNITS[other.key].near;
    const isNext = other !== unit && Math.abs((other.slot % GRID.cols) - col) <= 1 && Math.abs(Math.floor(other.slot / GRID.cols) - row) <= 1;
    return reach && isNext ? Math.max(most, reach) : most;
  }, 0);
  const isCrit = def.crit && state.rand() < def.crit[0];
  const amount = def.damage * (1 + UPGRADES[def.type].bonus * state.levels[def.type]) * (1 + boardWide(state, "power")) * (1 + blessing) * (isCrit ? def.crit[1] : 1);

  for (const target of inReach.slice(0, def.multi ?? 1)) {
    events.push({ type: "attack", key: unit.key, slot: unit.slot, x: target.x, y: target.y, splash: def.splash, crit: isCrit });
    const struck = def.splash ? state.enemies.filter((e) => !e.dead && near(e, target, def.splash)) : [target];
    for (const e of struck) hurt(state, e, amount, def, events);

    let last = target;
    const jumped = [target.id];
    for (let jump = 0, power = amount; jump < (def.chain ?? 0); jump++) {
      const next = state.enemies
        .filter((e) => !e.dead && !jumped.includes(e.id) && near(e, last, CHAIN_REACH))
        .sort((a, b) => Math.hypot(a.x - last.x, a.y - last.y) - Math.hypot(b.x - last.x, b.y - last.y))[0];
      if (!next) break;
      power *= CHAIN_FADE;
      jumped.push(next.id);
      events.push({ type: "chain", x: last.x, y: last.y, x2: next.x, y2: next.y });
      hurt(state, next, power, def, events);
      last = next;
    }
  }
  return true;
}

function stepBoss(state, boss, dt, events) {
  const def = BOSSES[boss.type];
  if (def.regen) boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * def.regen * dt);
  if (def.freeze && (boss.actT -= dt) <= 0) {
    const [every, count, seconds] = def.freeze;
    boss.actT = every;
    const awake = state.units.filter((u) => u.stunUntil <= state.time);
    for (let n = Math.min(count, awake.length); n > 0; n--) {
      const unit = awake.splice(Math.floor(state.rand() * awake.length), 1)[0];
      unit.stunUntil = state.time + seconds;
      events.push({ type: "freeze", slot: unit.slot });
    }
  }
  if (def.summon && (boss.actT -= dt) <= 0) {
    const [every, count, type] = def.summon;
    boss.actT = every;
    for (let i = 0; i < count; i++) spawn(state, type, { dist: boss.dist - 14 * (i + 1) });
    events.push({ type: "bossSummon", x: boss.x, y: boss.y });
  }
}

function lose(state, lostTo, events) {
  state.phase = "over";
  state.lostTo = lostTo;
  events.push({ type: "over", lostTo });
}

/** Advance the game by `dt` seconds. Returns what happened, for the screen to show and sound. */
export function update(state, dt) {
  const events = [];
  if (state.phase !== "playing") return events;
  state.time += dt;
  state.waveTime += dt;

  if (state.bossWarn > 0 && (state.bossWarn -= dt) <= 0) {
    const type = BOSS_ORDER[(state.wave / RULES.bossEvery - 1) % BOSS_ORDER.length];
    const def = BOSSES[type];
    spawn(state, type, { actT: (def.freeze ?? def.summon ?? [0])[0] });
    state.bossDeadline = state.time + RULES.bossSeconds;
    events.push({ type: "bossArrive", kind: type });
  }
  while (state.queue.length && state.queue[0].t <= state.waveTime) {
    const { type } = state.queue.shift();
    spawn(state, type);
    if (type === "thief") events.push({ type: "thief" });
  }

  // The chronomancer's time stop comes round while one is on the board
  const stop = state.units.map((u) => UNITS[u.key].stop).find(Boolean);
  if (stop && state.enemies.length && (state.stopT -= dt) <= 0) {
    state.stopT = stop[0];
    state.stopUntil = state.time + stop[1];
    events.push({ type: "timeStop" });
  }
  const isStopped = state.stopUntil > state.time;
  const chill = 1 - boardWide(state, "chill");

  const healers = state.enemies.filter((e) => ENEMIES[e.type]?.heal);
  for (const e of state.enemies) {
    const boss = BOSSES[e.type];
    const def = boss ?? ENEMIES[e.type];
    if (e.poisonUntil > state.time) {
      e.hp -= e.maxHp * e.poison * dt;
      if (e.hp <= 0) {
        kill(state, e, events);
        continue;
      }
    }
    for (const healer of healers) {
      const reach = ENEMIES[healer.type];
      if (healer !== e && !healer.dead && near(healer, e, reach.heal)) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * reach.healRate * dt);
    }
    if (boss) stepBoss(state, e, dt, events);
    let pace = boss ? 1 - (1 - chill) * BOSS.slowed : chill;
    if (e.slowUntil > state.time) pace *= e.slow;
    if (!boss && (isStopped || e.stunUntil > state.time)) pace = 0;
    if (def.enrage && e.hp < e.maxHp * def.enrage[0]) pace *= def.enrage[1];
    e.dist += def.speed * pace * dt;
    Object.assign(e, trackPoint(e.dist));
    if (def.laps && e.dist >= LAP * def.laps) {
      e.dead = true;
      events.push({ type: "thiefGone", x: e.x, y: e.y });
    }
  }

  const haste = 1 + boardWide(state, "haste");
  for (const unit of state.units) {
    if (unit.stunUntil > state.time) continue;
    unit.wait -= dt * haste;
    if (unit.wait <= 0 && attack(state, unit, events)) unit.wait = UNITS[unit.key].every;
  }
  state.enemies = state.enemies.filter((e) => !e.dead);

  if (state.enemies.length >= RULES.enemyLimit) lose(state, "crowd", events);
  else if (state.bossDeadline && state.time >= state.bossDeadline) lose(state, "boss", events);
  else if (state.bossWarn <= 0 && !state.bossDeadline) {
    // On to the next wave when this one's time is up, or sooner once the road is clear
    const isCleared = !state.queue.length && !state.enemies.length;
    if (isCleared && state.waveTime < RULES.waveSeconds - RULES.breather) state.waveTime = RULES.waveSeconds - RULES.breather;
    if (state.waveTime >= RULES.waveSeconds) startWave(state, events);
  }
  return events;
}

const freeSlot = (state) => Array.from({ length: SLOTS }, (_, slot) => slot).find((slot) => !state.units.some((u) => u.slot === slot));

function place(state, key, slot) {
  const unit = { id: state.nextId++, key, slot, wait: 0, stunUntil: 0 };
  state.units.push(unit);
  return unit;
}

/** Pay for one random unit into the first empty slot. */
export function summon(state) {
  const events = [];
  const slot = freeSlot(state);
  if (state.phase !== "playing" || state.gold < summonPrice(state) || slot == null) return events;
  state.gold -= summonPrice(state);
  state.summons++;
  const odds = summonOdds(state);
  let roll = state.rand();
  // The rarest first, so that luck moves the borders between tiers and nothing else
  const tier = [...TIERS].reverse().find((t) => odds[t] != null && (roll -= odds[t]) < 0) ?? "common";
  const key = pick(state, BY_TIER[tier]);
  place(state, key, slot);
  events.push({ type: "summon", key, tier, slot });
  return events;
}

/**
 * Drag the unit in `from` to `to`: an empty slot takes it, the same kind of unit merges with it
 * (see MERGE), anything else trades places.
 */
export function moveUnit(state, from, to) {
  const events = [];
  const unit = state.units.find((u) => u.slot === from);
  if (state.phase !== "playing" || !unit || from === to || to < 0 || to >= SLOTS) return events;
  const other = state.units.find((u) => u.slot === to);
  const tier = TIERS.indexOf(UNITS[unit.key].tier);
  const odds = MERGE.odds[UNITS[unit.key].tier];
  if (other?.key === unit.key && odds) {
    const hasFailed = state.rand() >= odds;
    const isJackpot = tier === 0 && state.rand() < MERGE.jackpot;
    // Two epics that fail are both lost for a rare
    const next = TIERS[tier + (hasFailed ? (TIERS[tier] === "epic" ? -1 : 0) : isJackpot ? 2 : 1)];
    const key = pick(state, BY_TIER[next].filter((k) => k !== unit.key));
    state.units = state.units.filter((u) => u !== unit && u !== other);
    place(state, key, to);
    events.push({ type: "merge", key, tier: next, slot: to, jackpot: isJackpot, failed: hasFailed });
    return events;
  }
  if (other) other.slot = from;
  unit.slot = to;
  events.push({ type: "move", slot: to });
  return events;
}

/** Turn the three units of a recipe into its mythic, where the legendary one stood. */
export function craft(state, key) {
  const events = [];
  if (state.phase !== "playing" || !readyRecipes(state).includes(key)) return events;
  const parts = RECIPES[key].map((part) => state.units.find((u) => u.key === part));
  state.units = state.units.filter((u) => !parts.includes(u));
  place(state, key, parts[0].slot);
  events.push({ type: "craft", key, tier: "mythic", slot: parts[0].slot });
  return events;
}

/** Give up the unit in `slot` for some of its worth in gold. */
export function sell(state, slot) {
  const unit = state.units.find((u) => u.slot === slot);
  if (state.phase !== "playing" || !unit) return [];
  state.units = state.units.filter((u) => u !== unit);
  const { x, y } = slotCenter(slot);
  const events = [{ type: "sell", slot }];
  gainGold(state, TIER[UNITS[unit.key].tier].sell, x, y, events);
  return events;
}

/** Buy the next level of "phys", "magic" or "luck". Returns whether it happened. */
export function upgrade(state, key) {
  const price = upgradePrice(state, key);
  if (state.phase !== "playing" || price == null || state.gold < price) return false;
  state.gold -= price;
  state.levels[key]++;
  return true;
}
