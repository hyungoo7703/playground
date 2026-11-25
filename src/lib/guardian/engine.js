// Neon Guardian rules. No DOM in here: the screen draws the state and plays the
// returned events, and the same code can be stepped headless to check balance.
import {
  FIELD,
  PLAYER,
  ENEMIES,
  MODES,
  BOSSES,
  ELITE,
  UPGRADES,
  RARITY,
  GUARD_RATIO,
  RATE_STEP,
  SHIELD_CHARGES,
  BOUNTY_STEP,
  CRYO_SLOW_PCT,
  CRYO_SECONDS,
  BLAST_RADIUS,
  BLAST_RATIO,
  CHAIN_RANGE,
  CHAIN_RATIO,
  CRIT_EVERY,
  CRIT_MULT,
  REROLL_COST,
  REROLL_STEP,
  DRONE_COUNT,
  DRONE_EVERY,
  DRONE_RATIO,
  LASER_EVERY,
  LASER_MULT,
  LASER_WIDTH,
  MISSILE_EVERY,
  MISSILE_MULT,
  MISSILE_RADIUS,
  MISSILE_SPEED,
  VORTEX_EVERY,
  VORTEX_SECONDS,
  VORTEX_RADIUS,
  VORTEX_PULL,
  VORTEX_REACH,
  VORTEX_TICK,
  FAN_EXTRA,
  RAIL_SPEED,
  CLUSTER,
  TEMPEST_JUMPS,
  TEMPEST_RANGE,
  STRIKE_EVERY,
  STRIKE_MULT,
  STRIKE_RADIUS,
  STRIKE_DELAY,
  CHRONO_PACE,
  HASTE_STEP,
  MEND_HP,
  CACHE_COINS,
  SPEED_CAP,
  ENDLESS,
  BOSS_OPENING,
  SHOP,
  FREEZE,
} from "./config.js";

const DRONE_ORBIT = 34;
const DRONE_TURN = 1.8; // rad per second
const MISSILE_TURN = 7;
const HELD_PACE = 0.15; // how much of its own movement an enemy keeps inside a vortex

// Bump when a change to the state or the cards would break a run saved before it
const SAVE_VERSION = 1;

// mulberry32, with its position kept in the state so that a saved run carries on with the same dice
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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** A run as text, to carry on with later. */
export function saveGame(state) {
  // `rand` and `rules` are put back by loadGame; a railgun bullet's endless pierce has no JSON form
  return JSON.stringify({ version: SAVE_VERSION, state }, (key, value) =>
    key === "rand" || key === "rules" ? undefined : value === Infinity ? "Infinity" : value,
  );
}

/** The run `saveGame` wrote, or null when the text is not one this version can carry on with. */
export function loadGame(text) {
  try {
    const { version, state } = JSON.parse(text, (key, value) => (value === "Infinity" ? Infinity : value));
    if (version !== SAVE_VERSION || !MODES[state.mode]) return null;
    state.rules = MODES[state.mode];
    return addDice(state);
  } catch {
    return null;
  }
}

export function createGame(mode = "normal", seed = Date.now()) {
  const state = addDice({
    seed: seed >>> 0,
    mode,
    rules: MODES[mode],
    phase: "playing", // playing | upgrade | over | clear
    wave: 0,
    time: 0,
    waveTime: 0,
    hp: PLAYER.hp,
    shield: 0,
    coins: 0,
    bombCost: PLAYER.bombCost,
    rerollCost: REROLL_COST,
    shots: 0,
    levels: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])),
    aim: 0,
    cooldown: 0,
    bullets: [],
    enemies: [],
    missiles: [],
    vortices: [],
    strikes: [],
    wells: [], // the Titan's gravity wells
    isSealed: false, // the Titan's seals are up: no automatic weapons
    queue: [],
    choices: [],
    droneAngle: 0,
    droneT: 0,
    droneNext: 0,
    laserT: 0,
    missileT: 0,
    vortexT: 0,
    strikeT: 0,
    frozenUntil: 0,
    freezeCost: FREEZE.cost,
    // Current prices, where the mode has a shop
    shop: MODES[mode].hasShop ? Object.fromEntries(Object.entries(SHOP).map(([item, [price]]) => [item, price])) : null,
    hasExtraPick: false, // bought: the next card taken does not end the pick
    bossType: null, // the boss of this wave, if it is a boss wave
    bossWarn: 0,
    bossPending: false, // a boss wave whose boss has not appeared yet
    richDraft: false, // the next card pick offers no common cards
    nextId: 1,
  });
  startWave(state, []);
  return state;
}

/** Where drone `index` is right now. */
export function dronePosition(state, index) {
  const angle = state.droneAngle + (index * Math.PI * 2) / DRONE_COUNT[state.levels.drones - 1];
  return { x: FIELD.turretX + Math.cos(angle) * DRONE_ORBIT, y: FIELD.turretY - 8 + Math.sin(angle) * DRONE_ORBIT * 0.45 };
}

// Enemy HP multiplier at a wave index
function growthAt(rules, wave) {
  const g = rules.hpGrowth;
  const late = g.late ? g.late.rate ** Math.max(0, wave - g.late.from) : 1;
  return (g.base + g.linear * wave + g.square * wave ** 2 + g.cubic * wave ** 3) * late;
}

const hpGrowth = (state) => growthAt(state.rules, state.wave);

const bulletDamage = (state) => PLAYER.damage + state.levels.damage + state.levels.power;

// The wave an endless run faces next: a boss name, or groups like the rows of a wave table
function buildWave(state) {
  const number = state.wave + 1;
  if (number % ENDLESS.bossEvery === 0) return ENDLESS.bosses[endlessBoss(state).index];
  const open = Object.keys(ENDLESS.types).filter((type) => ENDLESS.types[type].from <= number);
  // Two to five kinds at once, with a share of the budget each
  const kinds = [];
  for (let n = Math.min(open.length, 2 + Math.floor(state.rand() * 4)); n > 0; n--) {
    kinds.push(open.splice(Math.floor(state.rand() * open.length), 1)[0]);
  }
  const shares = kinds.map(() => 0.4 + state.rand());
  const total = shares.reduce((sum, share) => sum + share, 0);
  const budget = Math.min(ENDLESS.budget.max, ENDLESS.budget.base + ENDLESS.budget.perWave * state.wave);
  const seconds = Math.min(ENDLESS.seconds.max, ENDLESS.seconds.base + ENDLESS.seconds.perWave * state.wave);
  const eliteChance = Math.min(ENDLESS.eliteMax, ENDLESS.eliteChance * (number - ENDLESS.eliteFrom));
  return kinds.map((type, i) => {
    const elite = state.rand() < eliteChance;
    const cost = ENDLESS.types[type].cost * (elite ? ENDLESS.eliteCost : 1);
    const count = Math.max(1, Math.round((budget * shares[i]) / total / cost));
    return [type, count, seconds / count, state.rand() * 4, elite];
  });
}

// The boss of an endless boss wave: which of ENDLESS.bosses, which visit of it this is
// (1 = first) and how much bigger than its listed HP. Past the list the last two take turns.
function endlessBoss(state) {
  const count = (state.wave + 1) / ENDLESS.bossEvery - 1;
  const listed = ENDLESS.bosses.length;
  if (count < listed) return { index: count, visit: 1, scale: ENDLESS.bossHp[count] };
  const index = listed - 2 + ((count - listed) % 2);
  // Its first visit's scale, grown as the enemies have grown since
  const firstWave = (index + 1) * ENDLESS.bossEvery - 1;
  return {
    index,
    visit: 2 + Math.floor((count - listed) / 2),
    scale: (ENDLESS.bossHp[index] * growthAt(state.rules, state.wave)) / growthAt(state.rules, firstWave),
  };
}

function startWave(state, events) {
  state.waveTime = 0;
  const wave = state.rules.waves ? state.rules.waves[state.wave] : buildWave(state);
  state.bossType = typeof wave === "string" ? wave : null;
  if (state.bossType) {
    state.bossWarn = BOSSES[wave].warn;
    state.bossPending = true;
    events.push({ type: "bossWarn" });
    return;
  }
  state.queue = wave
    .flatMap(([type, count, gap, delay, elite]) =>
      Array.from({ length: count }, (_, i) => ({ t: (delay + i * gap) * state.rules.pace, type, elite })),
    )
    .sort((a, b) => a.t - b.t);
}

function spawn(state, type, x, y, elite = false) {
  const def = ENEMIES[type];
  const radius = def.radius * (elite ? ELITE.size : 1);
  const margin = radius + 8;
  const enemy = {
    id: state.nextId++,
    type,
    elite,
    x: x ?? margin + state.rand() * (FIELD.w - margin * 2),
    y: y ?? -radius,
    vx: 0,
    vy: def.speed * Math.min(SPEED_CAP, 1 + state.rules.speedGrowth * state.wave) * (elite ? ELITE.speed : 1),
    hp: Math.max(1, Math.round(def.hp * hpGrowth(state) * (elite ? ELITE.hp : 1))),
    radius,
    leak: def.leak + (elite && def.leak ? ELITE.leak : 0),
    coins: def.coins * (elite ? ELITE.coins : 1),
    swayPhase: state.rand() * Math.PI * 2,
  };
  if (def.holdY) {
    enemy.holdY = def.holdY[0] + state.rand() * (def.holdY[1] - def.holdY[0]);
    enemy.shellT = def.shellEvery * 0.5;
  }
  if (def.blinkEvery) enemy.blinkT = def.blinkEvery * (0.5 + state.rand());
  if (def.spawnEvery) enemy.spawnT = def.spawnEvery;
  enemy.maxHp = enemy.hp;
  enemy.baseX = enemy.x;
  state.enemies.push(enemy);
  return enemy;
}

function spawnBoss(state, events) {
  const type = state.bossType;
  const def = BOSSES[type];
  const { visit, scale: endlessScale } = state.rules.waves ? { visit: 1, scale: 1 } : endlessBoss(state);
  const scale = state.rules.bossHp * endlessScale;
  const hp = Math.round(def.hp * scale);
  state.enemies.push({
    id: state.nextId++,
    type,
    scale,
    visit,
    x: FIELD.w / 2,
    y: -def.radius,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    radius: def.radius,
    dir: 1,
    phase: -1,
    ...BOSS_OPENING,
    chargeT: 0,
    charging: 0,
    chargeTaken: 0,
    stun: 0,
  });
  state.bossPending = false;
  events.push({ type: "bossArrive" });
}

// A shell flying from (x, y) at a random spot of the base
function fireShell(state, x, y) {
  const shell = spawn(state, "shell", x, y);
  const dx = 30 + state.rand() * (FIELD.w - 60) - shell.x;
  const dy = FIELD.baseY - shell.y;
  const len = Math.hypot(dx, dy);
  shell.vx = (dx / len) * ENEMIES.shell.speed;
  shell.vy = (dy / len) * ENEMIES.shell.speed;
}

// Things that circle the boss: generators, seals
function raiseOrbiters(state, boss, type, count, hp) {
  for (let i = 0; i < count; i++) {
    const orbiter = spawn(state, type, boss.x, boss.y);
    orbiter.hp = orbiter.maxHp = Math.round(hp);
    orbiter.slot = (i * Math.PI * 2) / count;
  }
}

// The Titan and its new copies trade places, so the player cannot keep track of the real one
function splitIntoDecoys(state, boss) {
  const def = BOSSES[boss.type];
  const slots = [...def.decoyX].sort(() => state.rand() - 0.5);
  boss.x = slots[0];
  for (let i = 0; i < def.decoys; i++) {
    const decoy = spawn(state, "decoy", slots[i + 1], boss.y);
    decoy.hp = decoy.maxHp = Math.round(boss.maxHp * def.decoyHp);
    decoy.vy = 0;
    decoy.dir = state.rand() < 0.5 ? -1 : 1;
    decoy.shellT = ENEMIES.decoy.shellEvery * (0.5 + state.rand());
  }
}

function damageBase(state, amount, x, events) {
  if (state.shield > 0) {
    state.shield--;
    events.push({ type: "shield", x });
    return;
  }
  state.hp -= amount;
  events.push({ type: "leak", x });
  if (state.hp <= 0) {
    state.hp = 0;
    state.phase = "over";
    events.push({ type: "gameOver" });
  }
}

function hurt(state, enemy, amount, events) {
  if (enemy.dead || enemy.ghost) return;
  if (enemy.shielded) {
    events.push({ type: "deflect", x: enemy.x, y: enemy.y });
    return;
  }
  if (enemy.guarded) amount *= GUARD_RATIO;
  const charge = BOSSES[enemy.type]?.charge;
  if (charge && enemy.stun > 0) {
    amount *= charge.stunDamage;
  } else if (charge && enemy.charging > 0) {
    enemy.chargeTaken += amount;
    if (enemy.chargeTaken >= enemy.maxHp * charge.need) {
      enemy.charging = 0;
      enemy.stun = charge.stun;
      events.push({ type: "chargeBreak", x: enemy.x, y: enemy.y });
    }
  }
  enemy.hp -= amount;
  if (enemy.hp > 0) return;
  enemy.dead = true;
  events.push({ type: "kill", kind: enemy.type, x: enemy.x, y: enemy.y });

  if (BOSSES[enemy.type]) {
    // Its escorts and shells go down with it
    state.enemies.forEach((e) => (e.dead = true));
    events.push({ type: "bossDead", x: enemy.x, y: enemy.y });
    if (state.rules.waves && state.wave === state.rules.waves.length - 1) {
      state.phase = "clear";
      events.push({ type: "clear" });
      return;
    }
    state.richDraft = true;
    if (state.rules.repair && state.hp < PLAYER.hp) {
      state.hp = Math.min(PLAYER.hp, state.hp + state.rules.repair);
      events.push({ type: "repair" });
    }
    return;
  }

  const def = ENEMIES[enemy.type];
  if (enemy.coins) {
    state.coins += enemy.coins * (1 + BOUNTY_STEP * state.levels.bounty);
    events.push({ type: "coin", x: enemy.x, y: enemy.y });
  }
  for (let i = 0; i < (def.split ?? 0); i++) {
    spawn(state, "mini", clamp(enemy.x + (i ? 14 : -14), 12, FIELD.w - 12), enemy.y);
  }
  if (def.boom) {
    events.push({ type: "boom", x: enemy.x, y: enemy.y, radius: def.boom });
    splash(state, enemy.x, enemy.y, def.boom, enemy.maxHp * def.boomRatio, enemy, events);
  }
}

// Damage to everything within `radius` of a point, except `skip`
function splash(state, x, y, radius, amount, skip, events) {
  for (let i = 0, n = state.enemies.length; i < n; i++) {
    const other = state.enemies[i];
    if (other === skip || other.dead) continue;
    if (Math.hypot(other.x - x, other.y - y) <= radius + other.radius) hurt(state, other, amount, events);
  }
}

// A bullet landing on `enemy`: its own damage plus whatever the bullet upgrades add
function strike(state, enemy, bullet, events) {
  const { cryo, blast, cluster, chain, tempest } = state.levels;
  if (cryo && !BOSSES[enemy.type]) {
    enemy.slowUntil = state.time + CRYO_SECONDS;
    enemy.slow = 1 - CRYO_SLOW_PCT[cryo - 1] / 100;
  }
  hurt(state, enemy, bullet.damage, events);

  if (blast) {
    const radius = BLAST_RADIUS[blast - 1];
    const amount = Math.ceil(bullet.damage * BLAST_RATIO);
    events.push({ type: "blast", x: bullet.x, y: bullet.y, radius });
    splash(state, bullet.x, bullet.y, radius, amount, enemy, events);
    const turn = state.rand() * Math.PI * 2;
    for (let i = 0; i < CLUSTER.count * cluster; i++) {
      const angle = turn + (i * Math.PI * 2) / CLUSTER.count;
      const x = bullet.x + Math.cos(angle) * radius * CLUSTER.offset;
      const y = bullet.y + Math.sin(angle) * radius * CLUSTER.offset;
      events.push({ type: "blast", x, y, radius: radius * CLUSTER.radius });
      splash(state, x, y, radius * CLUSTER.radius, amount, null, events);
    }
  }

  let from = enemy;
  const struck = [enemy.id];
  const range = CHAIN_RANGE * (tempest ? TEMPEST_RANGE : 1);
  for (let jump = 0; jump < chain + TEMPEST_JUMPS * tempest; jump++) {
    let next = null;
    let nearest = range;
    for (const other of state.enemies) {
      if (other.dead || struck.includes(other.id)) continue;
      const distance = Math.hypot(other.x - from.x, other.y - from.y) - other.radius;
      if (distance < nearest) {
        nearest = distance;
        next = other;
      }
    }
    if (!next) break;
    struck.push(next.id);
    events.push({ type: "chain", x: from.x, y: from.y, x2: next.x, y2: next.y });
    hurt(state, next, Math.ceil(bullet.damage * CHAIN_RATIO), events);
    from = next;
  }
}

// Three different cards, rarer ones offered less often
function rollChoices(state) {
  let pool = Object.keys(UPGRADES).filter((k) => {
    const card = UPGRADES[k];
    const rarity = RARITY[card.rarity];
    if (state.levels[k] >= card.max) return false;
    // A repair is no card to offer a base that has nothing to repair
    if (k === "mend" && state.hp >= PLAYER.hp) return false;
    if (state.wave + 1 < (rarity.from ?? 0)) return false;
    if (rarity.isEndlessOnly && state.rules.waves) return false;
    return !card.needs || state.levels[card.needs] >= UPGRADES[card.needs].max;
  });
  if (state.richDraft) {
    const better = pool.filter((k) => UPGRADES[k].rarity !== "common");
    if (better.length >= 3) pool = better;
  }
  const weight = (k) => RARITY[UPGRADES[k].rarity].weight;
  state.choices = [];
  while (state.choices.length < 3 && pool.length) {
    let roll = state.rand() * pool.reduce((sum, k) => sum + weight(k), 0);
    let index = pool.findIndex((k) => (roll -= weight(k)) < 0);
    if (index === -1) index = pool.length - 1;
    state.choices.push(pool.splice(index, 1)[0]);
  }
}

function stepBoss(state, boss, dt, events) {
  const def = BOSSES[boss.type];
  if (boss.y < def.y) {
    boss.y = Math.min(def.y, boss.y + 70 * dt);
    return;
  }
  const fraction = boss.hp / boss.maxHp;
  let phaseIndex = 0;
  def.phases.forEach((p, i) => {
    if (fraction <= p.below) phaseIndex = i;
  });
  const phase = def.phases[phaseIndex];
  if (phaseIndex !== boss.phase) {
    if (boss.phase >= 0) events.push({ type: "bossPhase", x: boss.x, y: boss.y });
    boss.phase = phaseIndex;
    if (phase.generators) {
      raiseOrbiters(state, boss, "generator", phase.generators, def.generatorHp * boss.scale);
      boss.shielded = true;
      events.push({ type: "generators", x: boss.x, y: boss.y });
    }
    boss.chargeT = (phase.chargeEvery ?? 0) * 0.6;
  }

  if (boss.stun > 0) {
    boss.stun -= dt;
    return;
  }
  if (boss.charging > 0) {
    boss.charging -= dt;
    if (boss.charging <= 0) {
      events.push({ type: "chargeFire", x: boss.x, y: boss.y });
      damageBase(state, def.charge.damage, boss.x, events);
    }
    return;
  }
  // No charging behind the generators: the charge could not be broken
  if (phase.chargeEvery && !boss.shielded) {
    boss.chargeT -= dt;
    if (boss.chargeT <= 0) {
      boss.chargeT = phase.chargeEvery;
      boss.charging = def.charge.seconds;
      boss.chargeTaken = 0;
      events.push({ type: "chargeStart", x: boss.x, y: boss.y });
      return;
    }
  }

  if (phase.wellEvery && (boss.wellT -= dt) <= 0) {
    boss.wellT = phase.wellEvery;
    const [left, right] = def.well.x;
    const [top, bottom] = def.well.y;
    const well = { x: left + state.rand() * (right - left), y: top + state.rand() * (bottom - top), until: state.time + def.well.seconds };
    state.wells.push(well);
    events.push({ type: "well", x: well.x, y: well.y });
  }
  // These two clocks only run while none is up, so destroying them buys the full interval
  const isUp = (type) => state.enemies.some((e) => e.type === type && !e.dead);
  if (phase.decoyEvery && !isUp("decoy") && (boss.decoyT -= dt) <= 0) {
    boss.decoyT = phase.decoyEvery;
    splitIntoDecoys(state, boss);
    events.push({ type: "decoys", x: boss.x, y: boss.y });
  }
  if (phase.sealEvery && !isUp("seal") && (boss.sealT -= dt) <= 0) {
    boss.sealT = phase.sealEvery;
    raiseOrbiters(state, boss, "seal", def.seals, boss.maxHp * def.sealHp);
    events.push({ type: "seals", x: boss.x, y: boss.y });
  }

  boss.x += boss.dir * phase.speed * dt;
  const margin = boss.radius + 6;
  if (boss.x < margin || boss.x > FIELD.w - margin) {
    boss.x = clamp(boss.x, margin, FIELD.w - margin);
    boss.dir *= -1;
  }

  boss.shellT -= dt;
  if (boss.shellT <= 0) {
    boss.shellT = phase.shellEvery;
    for (let i = 0; i < phase.shells; i++) {
      fireShell(state, boss.x + (i - (phase.shells - 1) / 2) * 34, boss.y + boss.radius * 0.6);
    }
    events.push({ type: "bossFire", x: boss.x, y: boss.y });
  }
  boss.addT -= dt;
  if (boss.addT <= 0) {
    boss.addT = phase.addEvery;
    const escorts = boss.visit > 1 ? [...phase.add, ...ENDLESS.returnEscorts] : phase.add;
    spawn(state, escorts[Math.floor(state.rand() * escorts.length)]);
  }
}

// The enemy the automatic weapons go for: the one nearest the base, bosses last
function pickTarget(state) {
  let target = null;
  let best = -Infinity;
  for (const e of state.enemies) {
    if (e.dead || e.shielded || e.ghost || e.y < 0) continue;
    const score = BOSSES[e.type] ? -1000 : e.y;
    if (score > best) {
      best = score;
      target = e;
    }
  }
  return target;
}

function shoot(state, x, y, angle, speed, extra) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  state.bullets.push({ x, y, vx: sin * speed, vy: -cos * speed, damage: 0, pierce: 0, hit: [], ...extra });
}

function openVortex(state, bullet, events) {
  bullet.dead = true;
  state.vortices.push({ x: bullet.x, y: bullet.y, until: state.time + VORTEX_SECONDS, tick: 0 });
  events.push({ type: "vortex", x: bullet.x, y: bullet.y });
}

function fireWeapons(state, dt, input, events) {
  const { levels } = state;
  const damage = bulletDamage(state);

  state.cooldown -= dt;
  if (input.firing && state.cooldown <= 0) {
    state.cooldown = PLAYER.fireInterval * RATE_STEP ** levels.rate * HASTE_STEP ** levels.haste;
    const count = 1 + levels.multi + FAN_EXTRA * levels.fan;
    state.shots++;
    const isCrit = levels.crit > 0 && state.shots % CRIT_EVERY[levels.crit - 1] === 0;
    // The twin turret repeats the volley on the other side of straight up
    for (const aim of levels.twin ? [state.aim, -state.aim] : [state.aim]) {
      for (let i = 0; i < count; i++) {
        const angle = aim + (i - (count - 1) / 2) * PLAYER.spread;
        shoot(state, FIELD.turretX + Math.sin(angle) * 28, FIELD.turretY - Math.cos(angle) * 28, angle, PLAYER.bulletSpeed * (levels.rail ? RAIL_SPEED : 1), {
          damage: damage * (isCrit ? CRIT_MULT : 1),
          pierce: levels.rail ? Infinity : levels.pierce,
          crit: isCrit,
        });
      }
    }
    events.push({ type: isCrit ? "critShot" : "shoot" });
  }

  for (const m of state.missiles) stepMissile(state, m, dt, damage, events);
  state.missiles = state.missiles.filter((m) => m.life > 0 && m.y > -40);
  for (const s of state.strikes) {
    s.left -= dt;
    if (s.left > 0) continue;
    events.push({ type: "strike", x: s.x, y: s.y, radius: STRIKE_RADIUS });
    splash(state, s.x, s.y, STRIKE_RADIUS, damage * STRIKE_MULT[levels.strike - 1], null, events);
  }
  state.strikes = state.strikes.filter((s) => s.left > 0);

  // What is already in the air flies on, but a sealed turret starts nothing by itself
  const hasEnemies = state.enemies.length > 0;
  if (state.isSealed || !hasEnemies) return;

  if (levels.laser) {
    state.laserT -= dt;
    if (state.laserT <= 0 && input.firing) {
      state.laserT = LASER_EVERY[levels.laser - 1];
      const sin = Math.sin(state.aim);
      const cos = Math.cos(state.aim);
      for (let i = 0, n = state.enemies.length; i < n; i++) {
        const e = state.enemies[i];
        const rx = e.x - FIELD.turretX;
        const ry = e.y - FIELD.turretY;
        if (rx * sin - ry * cos > 0 && Math.abs(rx * cos + ry * sin) <= e.radius + LASER_WIDTH) {
          hurt(state, e, damage * LASER_MULT[levels.laser - 1], events);
        }
      }
      events.push({ type: "laser", angle: state.aim });
    }
  }

  if (levels.vortex) {
    state.vortexT -= dt;
    if (state.vortexT <= 0 && input.firing) {
      state.vortexT = VORTEX_EVERY[levels.vortex - 1];
      shoot(state, FIELD.turretX, FIELD.turretY - 28, state.aim, PLAYER.bulletSpeed * 0.6, { vortex: true, reach: VORTEX_REACH });
      events.push({ type: "vortexShot" });
    }
  }

  if (levels.strike) {
    state.strikeT -= dt;
    if (state.strikeT <= 0) {
      state.strikeT = STRIKE_EVERY[levels.strike - 1];
      // Aim at whichever enemy has the most company
      let centre = null;
      let most = -1;
      for (const e of state.enemies) {
        if (e.y < 0) continue;
        const company = state.enemies.filter((o) => Math.hypot(o.x - e.x, o.y - e.y) <= STRIKE_RADIUS).length;
        if (company > most) {
          most = company;
          centre = e;
        }
      }
      if (centre) {
        state.strikes.push({ x: centre.x, y: centre.y + centre.vy * STRIKE_DELAY, left: STRIKE_DELAY });
        events.push({ type: "strikeMark" });
      }
    }
  }
  if (!levels.drones && !levels.missile) return;
  const target = pickTarget(state);

  if (levels.drones) {
    state.droneAngle += DRONE_TURN * dt;
    state.droneT -= dt;
    if (state.droneT <= 0 && target) {
      const count = DRONE_COUNT[levels.drones - 1];
      state.droneT = DRONE_EVERY / count;
      const from = dronePosition(state, state.droneNext++ % count);
      // Lead the target by its straight-line velocity
      const t = Math.hypot(target.x - from.x, target.y - from.y) / PLAYER.bulletSpeed;
      const angle = Math.atan2(target.x + target.vx * t - from.x, from.y - (target.y + target.vy * t));
      shoot(state, from.x, from.y, angle, PLAYER.bulletSpeed, { damage: Math.ceil(damage * DRONE_RATIO), drone: true });
      events.push({ type: "droneShot" });
    }
  }

  if (levels.missile) {
    state.missileT -= dt;
    if (state.missileT <= 0 && target) {
      state.missileT = MISSILE_EVERY[levels.missile - 1];
      state.missiles.push({ x: FIELD.turretX, y: FIELD.turretY - 20, angle: state.aim, target: target.id, life: 5 });
      events.push({ type: "missile" });
    }
  }
}

// A missile homes in on its target, or on a new one once that is gone
function stepMissile(state, m, dt, damage, events) {
  let goal = state.enemies.find((e) => e.id === m.target && !e.dead);
  if (!goal) {
    goal = pickTarget(state);
    m.target = goal?.id;
  }
  if (goal) {
    let turn = Math.atan2(goal.x - m.x, m.y - goal.y) - m.angle;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    m.angle += clamp(turn, -MISSILE_TURN * dt, MISSILE_TURN * dt);
  }
  m.x += Math.sin(m.angle) * MISSILE_SPEED * dt;
  m.y -= Math.cos(m.angle) * MISSILE_SPEED * dt;
  m.life -= dt;
  if (goal && Math.hypot(goal.x - m.x, goal.y - m.y) <= goal.radius + 8) {
    m.life = 0;
    events.push({ type: "missileHit", x: m.x, y: m.y, radius: MISSILE_RADIUS });
    hurt(state, goal, damage * MISSILE_MULT, events);
    splash(state, m.x, m.y, MISSILE_RADIUS, (damage * MISSILE_MULT) / 2, goal, events);
  }
}

/** Advance the game. `input` is { aim: rad from straight up, firing: boolean }. */
export function update(state, dt, input) {
  const events = [];
  if (state.phase !== "playing") return events;
  state.time += dt;
  state.waveTime += dt;
  state.aim = clamp(input.aim, -PLAYER.aimLimit, PLAYER.aimLimit);

  if (state.bossWarn > 0) {
    state.bossWarn -= dt;
    if (state.bossWarn <= 0) spawnBoss(state, events);
  }
  while (state.queue.length && state.queue[0].t <= state.waveTime) {
    const next = state.queue.shift();
    spawn(state, next.type, undefined, undefined, next.elite);
  }

  // Who is covered by a shielder or a mender, and whether the boss still has a generator up
  const shielders = state.enemies.filter((e) => ENEMIES[e.type]?.aura);
  const menders = state.enemies.filter((e) => ENEMIES[e.type]?.heal);
  const boss = state.enemies.find((e) => BOSSES[e.type]);
  if (boss) boss.shielded = state.enemies.some((e) => e.type === "generator");
  state.isSealed = state.enemies.some((e) => e.type === "seal");
  const isNear = (support, e, reach) => support !== e && Math.hypot(support.x - e.x, support.y - e.y) <= reach + e.radius;
  for (const e of state.enemies) {
    e.held = false;
    const def = ENEMIES[e.type];
    const isSupported = def && !def.orbitX && e.type !== "decoy";
    e.guarded = isSupported && !def.aura && shielders.some((s) => isNear(s, e, ENEMIES[s.type].aura));
    e.mended = isSupported && e.hp < e.maxHp && menders.some((m) => isNear(m, e, ENEMIES[m.type].heal));
    if (e.mended) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ENEMIES.mender.healRate * dt);
    if (def?.phaseEvery) e.ghost = Math.floor(state.time / def.phaseEvery + e.swayPhase) % 2 === 1;
  }

  fireWeapons(state, dt, input, events);

  state.wells = state.wells.filter((well) => well.until > state.time);
  for (const b of state.bullets) {
    for (const well of state.wells) {
      const dx = well.x - b.x;
      const dy = well.y - b.y;
      const distance = Math.hypot(dx, dy);
      const pull = BOSSES.titan.well;
      if (distance > pull.radius || distance < 1) continue;
      // Turn the bullet without speeding it up
      const speed = Math.hypot(b.vx, b.vy);
      b.vx += (dx / distance) * pull.pull * dt;
      b.vy += (dy / distance) * pull.pull * dt;
      const now = Math.hypot(b.vx, b.vy);
      b.vx *= speed / now;
      b.vy *= speed / now;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -20 || b.y > FIELD.h + 20 || b.x < -20 || b.x > FIELD.w + 20) b.dead = true;
    else if (b.vortex && (b.reach -= PLAYER.bulletSpeed * 0.6 * dt) <= 0) openVortex(state, b, events);
  }

  for (const v of state.vortices) {
    v.tick -= dt;
    const isTick = v.tick <= 0;
    if (isTick) v.tick = VORTEX_TICK[0];
    for (let i = 0, n = state.enemies.length; i < n; i++) {
      const e = state.enemies[i];
      if (e.dead || BOSSES[e.type] || ENEMIES[e.type].orbitX || e.type === "decoy") continue;
      const dx = v.x - e.x;
      const dy = v.y - e.y;
      const distance = Math.hypot(dx, dy);
      if (distance > VORTEX_RADIUS + e.radius) continue;
      e.held = true;
      const step = Math.min(distance, VORTEX_PULL * dt) / (distance || 1);
      e.x += dx * step;
      e.y += dy * step;
      if (isTick) hurt(state, e, bulletDamage(state) * VORTEX_TICK[1], events);
    }
  }
  state.vortices = state.vortices.filter((v) => v.until > state.time);

  // Frozen, nothing on the field moves or acts; the time warp slows everything but bosses
  const isFrozen = state.frozenUntil > state.time;
  const worldPace = isFrozen ? 0 : state.levels.chrono ? CHRONO_PACE[state.levels.chrono - 1] : 1;

  // Index loop: bosses and carriers append new enemies while this runs
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.dead) continue;
    if (BOSSES[e.type]) {
      if (!isFrozen) stepBoss(state, e, dt, events);
      continue;
    }
    const def = ENEMIES[e.type];
    if (def.orbitX) {
      const angle = e.slot + state.time * def.turn;
      e.x = clamp(boss.x + Math.cos(angle) * def.orbitX, e.radius, FIELD.w - e.radius);
      e.y = boss.y + 26 + Math.sin(angle) * def.orbitY;
      continue;
    }
    if (e.type === "decoy") {
      if (isFrozen) continue;
      e.x += e.dir * def.speed * dt;
      const margin = e.radius + 6;
      if (e.x < margin || e.x > FIELD.w - margin) {
        e.x = clamp(e.x, margin, FIELD.w - margin);
        e.dir *= -1;
      }
      if ((e.shellT -= dt) <= 0) {
        e.shellT = def.shellEvery;
        fireShell(state, e.x, e.y + e.radius * 0.6);
      }
      continue;
    }
    const pace = worldPace * (e.slowUntil > state.time ? e.slow : 1) * (e.held ? HELD_PACE : 1);
    if (def.spawnEvery && e.y > 0 && (e.spawnT -= dt * pace) <= 0) {
      e.spawnT = def.spawnEvery;
      spawn(state, "mini", clamp(e.x + (state.rand() - 0.5) * 30, 12, FIELD.w - 12), e.y + e.radius);
    }
    if (def.holdY && e.y >= e.holdY) {
      e.shellT -= dt * pace;
      if (e.shellT <= 0) {
        e.shellT = def.shellEvery;
        fireShell(state, e.x, e.y + e.radius * 0.6);
        events.push({ type: "shellFire", x: e.x, y: e.y });
      }
      continue;
    }
    e.y += e.vy * dt * pace;
    if (def.sway) {
      const offset = Math.sin(e.swayPhase + state.time * def.swayRate) * def.sway;
      // Dragged by a vortex, it carries on swaying from wherever it was left
      if (e.held) e.baseX = e.x - offset;
      else e.x = clamp(e.baseX + offset, e.radius, FIELD.w - e.radius);
    } else {
      e.x += e.vx * dt * pace;
    }
    if (def.blinkEvery && !e.held && (e.blinkT -= dt * pace) <= 0) {
      e.blinkT = def.blinkEvery;
      const jump = (def.blink[0] + state.rand() * (def.blink[1] - def.blink[0])) * (state.rand() < 0.5 ? -1 : 1);
      // Bounce off the wall rather than blink on the spot
      const side = e.x + jump < e.radius || e.x + jump > FIELD.w - e.radius ? -jump : jump;
      const x = clamp(e.x + side, e.radius, FIELD.w - e.radius);
      events.push({ type: "blink", x: e.x, y: e.y, x2: x, y2: e.y });
      e.x = x;
    }
    if (e.y >= FIELD.baseY) {
      e.dead = true;
      damageBase(state, e.leak, e.x, events);
    }
  }

  for (const b of state.bullets) {
    if (b.dead) continue;
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.dead || e.ghost || b.hit.includes(e.id)) continue;
      const reach = e.radius + 4;
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      if (dx * dx + dy * dy > reach * reach) continue;
      if (b.vortex) {
        openVortex(state, b, events);
        break;
      }
      b.hit.push(e.id);
      events.push({ type: "hit", x: b.x, y: b.y });
      strike(state, e, b, events);
      if (b.pierce-- <= 0) {
        b.dead = true;
        break;
      }
    }
  }

  state.bullets = state.bullets.filter((b) => !b.dead);
  state.enemies = state.enemies.filter((e) => !e.dead);

  const waveDone =
    state.phase === "playing" &&
    !state.bossPending &&
    state.queue.length === 0 &&
    state.enemies.length === 0;
  if (waveDone) {
    rollChoices(state);
    state.bullets = [];
    state.missiles = [];
    state.vortices = [];
    state.strikes = [];
    state.wells = [];
    state.phase = "upgrade";
    events.push({ type: "waveClear" });
  }
  return events;
}

/** Take one of `state.choices` and start the next wave. */
export function pickUpgrade(state, key) {
  const events = [];
  if (state.phase !== "upgrade" || !state.choices.includes(key)) return events;
  state.levels[key]++;
  if (key === "shield") state.shield += SHIELD_CHARGES;
  if (key === "mend") state.hp = Math.min(PLAYER.hp, state.hp + MEND_HP);
  if (key === "cache") state.coins += CACHE_COINS;
  if (state.hasExtraPick) {
    state.hasExtraPick = false;
    state.choices = state.choices.filter((k) => k !== key);
    return events;
  }
  state.richDraft = false;
  state.wave++;
  state.phase = "playing";
  startWave(state, events);
  return events;
}

/** Spend coins to deal a fresh set of cards. Returns whether it happened. */
export function reroll(state) {
  if (state.phase !== "upgrade" || state.coins < state.rerollCost) return false;
  state.coins -= state.rerollCost;
  state.rerollCost += REROLL_STEP;
  rollChoices(state);
  return true;
}

/** Buy from the shop between waves: "repair", "shield" or "extra" (a second card from this hand). */
export function buy(state, item) {
  if (state.phase !== "upgrade" || !state.shop || state.coins < state.shop[item]) return false;
  if (item === "repair" && state.hp >= PLAYER.hp) return false;
  if (item === "extra" && (state.hasExtraPick || state.choices.length < 2)) return false;
  state.coins -= state.shop[item];
  state.shop[item] += SHOP[item][1];
  if (item === "repair") state.hp++;
  else if (item === "shield") state.shield++;
  else state.hasExtraPick = true;
  return true;
}

/** Spend coins to stop everything on the field for a moment. */
export function useFreeze(state) {
  const events = [];
  if (state.phase !== "playing" || !state.rules.hasFreeze || state.coins < state.freezeCost) return events;
  state.coins -= state.freezeCost;
  state.freezeCost += FREEZE.costStep;
  state.frozenUntil = state.time + FREEZE.seconds;
  events.push({ type: "freeze" });
  return events;
}

/** Spend coins to damage everything on screen. */
export function useBomb(state) {
  const events = [];
  if (state.phase !== "playing" || state.coins < state.bombCost) return events;
  state.coins -= state.bombCost;
  state.bombCost += PLAYER.bombCostStep;
  events.push({ type: "bomb" });
  const scale = state.rules.bombScales ? hpGrowth(state) : 1;
  for (let i = 0, n = state.enemies.length; i < n; i++) {
    const e = state.enemies[i];
    hurt(state, e, (BOSSES[e.type] ? PLAYER.bombBossDamage : PLAYER.bombDamage) * scale, events);
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
  return events;
}
